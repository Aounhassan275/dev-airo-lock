<?php

namespace App\Http\Controllers;

use App\Models\AccessRule;
use App\Models\Blog;
use App\Models\Collection;
use App\Models\Lock;
use App\Models\Page;
use App\Models\Product;
use App\Models\Store;
use App\Models\Theme;
use App\Models\User;
use App\Models\Variant;
use App\Models\Widget;
use App\Services\MetafieldService;
use App\Services\PopupTextBaker;
use App\Services\PopupTextOverrides;
use App\Services\ShopifyRetry;
use App\Services\ShopLocaleService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class AccessLockcontroller extends Controller
{
    /**
     * Refuse a save and land back on the form page with the REAL reason.
     *
     * Session flash (back()->withErrors) gets lost inside the embedded-app
     * iframe (third-party cookie partitioning), which used to leave the
     * frontend guessing — it toasted a generic "your plan may not include…"
     * for every failure. Carrying the message in the redirect URL survives
     * without cookies; withErrors is kept as a bonus for when the session
     * does work.
     */
    private function refuseToFormPage(string $message, string $kind = 'error')
    {
        $previous = url()->previous();
        // Replace any stale save_error from a prior refusal on the same page.
        $previous = preg_replace('/[?&]save_error(_kind)?=[^&]*/', '', $previous);
        $separator = str_contains($previous, '?') ? '&' : '?';

        return redirect()->to($previous . $separator . http_build_query([
            'save_error' => $message,
            'save_error_kind' => $kind,
        ]))->withErrors([$kind => $message]);
    }

    /**
     * Normalize condition groups before storing: trim values (a trailing
     * space in a passcode/secret code could never match on the storefront)
     * and default an empty signedIn value to 'loggedIn' (the UI default the
     * Polaris Select shows without actually writing it).
     */
    private function normalizeConditionGroups(?array $groups): ?array
    {
        if (!is_array($groups)) {
            return $groups;
        }

        foreach ($groups as &$group) {
            if (!is_array($group) || !isset($group['conditions']) || !is_array($group['conditions'])) {
                continue;
            }
            foreach ($group['conditions'] as &$condition) {
                if (!is_array($condition)) {
                    continue;
                }
                if (isset($condition['value']) && is_string($condition['value'])) {
                    $condition['value'] = trim($condition['value']);
                }
                if (($condition['type'] ?? '') === 'signedIn' && empty($condition['value'])) {
                    $condition['value'] = 'loggedIn';
                }
            }
            unset($condition);
        }
        unset($group);

        return $groups;
    }

    /**
     * Products for the admin picker, deduped by handle (unique per shop on
     * Shopify). The local cache can hold two rows for one product — e.g. a
     * deleted-then-recreated product whose delete webhook was missed leaves
     * the old row behind under a stale GID — which showed merchants the same
     * product twice. Freshest row wins.
     */
    private function pickerProducts($shop)
    {
        return Product::where('shop_id', $shop->id)
            ->select(['id', 'shopify_product_id', 'title', 'vendor', 'product_type', 'tags', 'category', 'image_url', 'handle', 'updated_at'])
            ->orderByDesc('updated_at')
            ->get()
            ->unique(fn ($p) => $p->handle ?: $p->shopify_product_id)
            ->values()
            ->makeHidden('updated_at');
    }

    /** Same dedupe-by-handle for collections/pages/blogs pickers. */
    private function pickerResources(string $modelClass, $shop, array $columns, string $gidColumn)
    {
        return $modelClass::where('shop_id', $shop->id)
            ->select(array_merge($columns, ['updated_at']))
            ->orderByDesc('updated_at')
            ->get()
            ->unique(fn ($r) => $r->handle ?: $r->$gidColumn)
            ->values()
            ->makeHidden('updated_at');
    }

    private function resolveResourceGidByHandle($shop, string $resourceType, ?string $handle): ?string
    {
        if (!$handle) {
            return null;
        }

        try {
            if ($resourceType === 'product') {
                $query = <<<'GQL'
                    query ProductByHandle($handle: String!) {
                      productByHandle(handle: $handle) { id title handle }
                    }
                    GQL;
                $res = \App\Services\ShopifyRetry::run(fn () => $shop->api()->graph($query, ['handle' => $handle]));
                $node = $res['body']['data']['productByHandle'] ?? null;
                $node = $node ? json_decode(json_encode($node), true) : null;
                if ($node && !empty($node['id'])) {
                    Product::updateOrCreate(
                        ['shop_id' => $shop->id, 'shopify_product_id' => $node['id']],
                        ['title' => $node['title'] ?? $handle, 'handle' => $node['handle'] ?? $handle]
                    );
                    return $node['id'];
                }
                return null;
            }

            if ($resourceType === 'collection') {
                $query = <<<'GQL'
                    query CollectionByHandle($handle: String!) {
                      collectionByHandle(handle: $handle) { id title handle }
                    }
                    GQL;
                $res = \App\Services\ShopifyRetry::run(fn () => $shop->api()->graph($query, ['handle' => $handle]));
                $node = $res['body']['data']['collectionByHandle'] ?? null;
                $node = $node ? json_decode(json_encode($node), true) : null;
                if ($node && !empty($node['id'])) {
                    Collection::updateOrCreate(
                        ['shop_id' => $shop->id, 'shopify_collection_id' => $node['id']],
                        ['title' => $node['title'] ?? $handle, 'handle' => $node['handle'] ?? $handle]
                    );
                    return $node['id'];
                }
                return null;
            }

            if ($resourceType === 'page' || $resourceType === 'blog') {
                $field = $resourceType === 'page' ? 'pages' : 'blogs';
                $query = <<<GQL
                    query ResourceByHandle(\$q: String!) {
                      {$field}(first: 1, query: \$q) {
                        nodes { id title handle }
                      }
                    }
                    GQL;
                $res = \App\Services\ShopifyRetry::run(fn () => $shop->api()->graph($query, ['q' => "handle:{$handle}"]));
                $node = $res['body']['data'][$field]['nodes'][0] ?? null;
                $node = $node ? json_decode(json_encode($node), true) : null;
                // query-based search can fuzzy-match; only trust an exact handle hit
                if ($node && !empty($node['id']) && ($node['handle'] ?? null) === $handle) {
                    $modelClass = $resourceType === 'page' ? Page::class : Blog::class;
                    $idField = $resourceType === 'page' ? 'shopify_page_id' : 'shopify_blog_id';
                    $modelClass::updateOrCreate(
                        ['shop_id' => $shop->id, $idField => $node['id']],
                        ['title' => $node['title'] ?? $handle, 'handle' => $handle]
                    );
                    return $node['id'];
                }
                return null;
            }
        } catch (\Exception $e) {
            Log::warning('Failed to resolve Shopify GID by handle', [
                'resource_type' => $resourceType,
                'handle' => $handle,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    // public function index()
    // {
    //     $shop = Auth::user()->load('plan');

    //     $locks = Lock::where('shop_id', $shop->id)
    //         ->withCount('accessRules')
    //         ->latest()
    //         ->get();

    //     $storesCount = User::count();

    //     // Enhanced Plan logic
    //     $plan = $shop->plan;
    //     $isFreemium = $shop->isFreemium();
    //     $isInTrial = $shop->isInTrial();
    //     $daysRemaining = $shop->getTrialDaysRemaining();
    //     $maxLocks = $shop->getMaxLocks();
    //     $remainingLocks = $maxLocks - $locks->count();
    //     // dd($maxLocks);
    //     // Determine plan display name
    //     $planName = 'Free Trial';
    //     if ($plan && !$isFreemium) {
    //         $planName = $plan->name;
    //     } elseif ($plan) {
    //         $planName = $plan->name ?? 'Free Trial';
    //     }

    //     return Inertia::render('Dashboard', [
    //         'locks' => $locks,
    //         'storesCount' => $storesCount,
    //         'plan' => [
    //             'name' => $planName,
    //             'maxLocks' => $maxLocks,
    //             'currentLocks' => $locks->count(),
    //             'daysRemaining' => $daysRemaining,
    //             'isTrial' => $isInTrial,
    //             'isFreemium' => $isFreemium,
    //             'hasPaidPlan' => $shop->hasPaidPlan(),
    //             'limitReached' => $locks->count() >= $maxLocks,
    //             'canCreateMore' => $locks->count() < $maxLocks,
    //             'remainingLocks' => $remainingLocks,
    //         ],
    //     ]);
    // }

    // public function lockmethod()
    // {
    //     return Inertia::render('Lockmethod');
    // }
    public function create()
    {
        $shop = Auth::user();

        // Plan gate: at the lock limit, the create page is an upsell — send
        // the merchant to pricing instead (the dashboard button is also
        // disabled client-side, but the URL must be enforced server-side).
        if (! app(\App\Services\BillingService::class)->canCreateLock($shop)) {
            return redirect()->route('prices.index', request()->query());
        }

        // The builder hosts the full widget editor, whose language section
        // offers exactly the languages the shop publishes.
        $shopLocales = app(ShopLocaleService::class)->get(Auth::user());

        $data = [
            'store' => Store::where('shop_id', $shop->id)->first(),
            'products' => $this->pickerProducts($shop),
            'variants' => Variant::where('shop_id', $shop->id)
                ->select(['id', 'variant_id', 'title', 'shopify_product_id'])
                ->get(),
            'collections' => $this->pickerResources(Collection::class, $shop, ['id', 'shopify_collection_id', 'title', 'handle', 'products_count'], 'shopify_collection_id'),
            'pages' => $this->pickerResources(Page::class, $shop, ['id', 'shopify_page_id', 'title', 'handle'], 'shopify_page_id'),
            'blogs' => $this->pickerResources(Blog::class, $shop, ['id', 'shopify_blog_id', 'title', 'handle'], 'shopify_blog_id'),
            'themes' => Theme::where('shop_id', $shop->id)
                ->select(['id', 'shopify_theme_id', 'name', 'role'])
                ->get(),
            'formWidgets' => Widget::active()
                ->where('user_id', $shop->id)
                ->where('type', 'form')
                ->select(['id', 'name', 'configuration'])
                ->get(),
            'textWidgets' => Widget::active()
                ->where('user_id', $shop->id)
                ->where('type', 'text')
                ->select(['id', 'name', 'configuration'])
                ->get(),
            // Items covered by OTHER locks, with the owning lock's name/state —
            // the builder warns that only ONE lock is enforced per item.
            'lockedItems' => AccessRule::where('access_rules.shop_id', $shop->id)
                ->join('locks', 'locks.id', '=', 'access_rules.lock_id')
                ->select(['access_rules.resource_type', 'access_rules.handle', 'access_rules.lock_id', 'locks.name as lock_name', 'locks.status as lock_active'])
                ->get(),
            // The builder hosts the full widget editor, whose language section
            // offers exactly the languages the shop publishes.
            'storeLocales' => $shopLocales['locales'],
            'primaryLocale' => $shopLocales['primary'],
        ];
        //    dd($data['variants']);
        return Inertia::render('locks/LockCreationFlow', $data);
    }

    /**
     * Re-read one resource type from Shopify, on demand.
     *
     * The pickers read from local mirror tables. Products and collections are
     * kept current by webhooks (config/shopify-app.php), but **pages, blogs and
     * themes have none registered** — they are synced once by ProductFetchJob
     * when the app is installed and never again, so anything the merchant adds
     * afterwards is invisible to the picker. That is the bug this fixes, and
     * why only those three were ever stale.
     *
     * Run inline rather than queued: the merchant is waiting on the result, and
     * a queued dispatch would return before the rows exist, redisplaying the
     * same stale list. A sync past its first page still re-dispatches the
     * remainder to the queue, which is fine — that only happens past 200 items.
     *
     * The response is a redirect back, so the caller re-renders with fresh
     * props and (with preserveState) keeps the lock it was building.
     */
    public function refreshCatalog(\Illuminate\Http\Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:products,collections,pages,blogs,themes',
        ]);

        $shop = Auth::user();

        $jobs = [
            'products' => \App\Jobs\Products\SyncProductsJob::class,
            'collections' => \App\Jobs\Products\SyncCollectionsJob::class,
            'pages' => \App\Jobs\Products\SyncPagesJob::class,
            'blogs' => \App\Jobs\Products\SyncBlogsJob::class,
            'themes' => \App\Jobs\Products\SyncThemesJob::class,
        ];

        try {
            dispatch_sync(new $jobs[$validated['type']]($shop));
        } catch (\Throwable $e) {
            Log::error('Catalog refresh failed', [
                'shop_id' => $shop->id,
                'type' => $validated['type'],
                'error' => $e->getMessage(),
            ]);

            return redirect()->back()->withErrors(['refresh' => 'Could not reach Shopify. Please try again.']);
        }

        return redirect()->back()->with('success', 'Updated from Shopify.');
    }

    /**
     * Store a dedicated Price Hide Rule.
     */
    public function storePriceRule(\Illuminate\Http\Request $request)
    {
        $shop = Auth::user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'product_ids' => 'sometimes',
            'selectedItems' => 'required|array',
            'price_message' => 'nullable|string',
            'hide_on_all_pages' => 'boolean',
            'hide_on_checkout' => 'boolean',
            'status' => 'required|in:Active,Draft',
            'type' => 'required|string'
        ]);

        // Plan enforcement: hide-prices is a plan feature and each rule
        // consumes a lock slot.
        $violations = app(\App\Services\BillingService::class)->priceRuleViolations($shop);
        if (! empty($violations)) {
            return $this->refuseToFormPage(implode(' ', $violations), 'plan');
        }

        // Create Lock
        $lock = \App\Models\Lock::create([
            'shop_id' => $shop->id,
            'name' => $validated['name'],
            'status' => $validated['status'] === 'Active',
            'type' => 'price_hide',
            'handle' => 'price_hide_' . uniqid(),
            'description' => $validated['price_message']
        ]);

        // Process selected items
        foreach ($request->selectedItems as $item) {
            // Support both old string format (fallback) and new object format
            if (is_string($item)) {
                if (str_starts_with($item, 'products-')) {
                    $gid = str_replace('products-', '', $item);
                    $product = \App\Models\Product::where('shop_id', $shop->id)
                        ->where('shopify_product_id', $gid)
                        ->first();

                    if ($product) {
                        $this->createPriceRule($shop, $lock, $product, $validated);
                    }
                }
            } elseif (is_array($item)) {
                // New object format
                if (($item['resource_type'] ?? '') === 'product') {
                    // Try to find by handle or original_id
                    $query = \App\Models\Product::where('shop_id', $shop->id);

                    if (!empty($item['handle'])) {
                        $query->where('handle', $item['handle']);
                    } elseif (!empty($item['original_id'])) {
                        $query->where('id', $item['original_id']);
                    } else {
                        continue;
                    }

                    $product = $query->first();
                    if ($product) {
                        $this->createPriceRule($shop, $lock, $product, $validated);
                    }
                }
            }
        }

        // Storefront sync — never fails the save; incomplete writes are
        // retried in the background until the storefront matches the DB.
        $lock->load('accessRules');
        $this->syncMetafieldsWithRetry($shop, $lock);

        // Update Global Metafield
        $this->updateGlobalMetafield($shop);

        return to_route('locks.index')->with('success', 'Price Hide Rule Created');
    }

    private function createPriceRule($shop, $lock, $product, $validated)
    {
        // Metafield write happens in storePriceRule's sync pass afterwards.
        \App\Models\AccessRule::create([
            'shop_id' => $shop->id,
            'lock_id' => $lock->id,
            'resource_type' => 'product',
            'handle' => $product->handle,
            'hide_price' => true,
            'price_message' => $validated['price_message'],
            'force_open' => true,  // Don't block page
            'enabled' => true,
            'settings' => [
                'hide_on_all_pages' => $validated['hide_on_all_pages'] ?? false,
                'hide_on_checkout' => $validated['hide_on_checkout'] ?? false
            ]
        ]);
    }

    public function storeLock(\Illuminate\Http\Request $request)
    {
        $shop = Auth::user();

        try {
            // Convert empty strings to null for nullable fields (Inertia FormData converts null to '')
            $request->merge([
                'lock_id' => $request->input('lock_id') ?: null,
                'widget_id' => $request->input('widget_id') ?: null,
                'text_widget_id' => $request->input('text_widget_id') ?: null,
                'starts_at' => $request->input('starts_at') ?: null,
                'expires_at' => $request->input('expires_at') ?: null,
                'redirect_url' => $request->input('redirect_url') ?: null,
                'description' => $request->input('description') ?: null,
            ]);

            $validated = $request->validate([
                'lock_id' => 'nullable|exists:locks,id',
                'name' => 'required|string',
                'selectedItems' => 'required|array|min:1',
                'selectedItems.*.handle' => 'nullable',  // Handle might be null for themes if they don't have one, or we use name/ID
                'selectedItems.*.resource_type' => 'required|in:collection,product,page,blog,theme,variant,shop,checkout',
                'selectedItems.*.variant_ids' => 'nullable|array',
                'selectedItems.*.variant_ids.*' => 'string',
                'status' => 'string',
                'rules' => 'nullable|array',
                'starts_at' => 'nullable|date',
                // NOT after:starts_at — that rule fails whenever only an
                // expiry is set (null starts_at can't be compared), which
                // bounced perfectly valid "expire on date X" locks.
                'expires_at' => 'nullable|date',
                'redirect_url' => 'nullable|string',
                'widget_id' => 'nullable|exists:widgets,id',
                'text_widget_id' => 'nullable|exists:widgets,id',
                'user_request_by_email' => 'nullable|boolean',
                'hide_add_to_cart' => 'nullable|boolean',
                'hide_completely' => 'nullable|boolean',
                'protect_products' => 'nullable|boolean',
                'hide_navigation' => 'nullable|boolean',
                'hide_lists' => 'nullable|boolean',
                'seo_block' => 'nullable|boolean',
                'locked_variant_display' => 'nullable|in:hide,disable',
                'all_variants_locked_behavior' => 'nullable|in:hide_product,show_disabled',
                'description' => 'nullable|string',
                // Per-lock popup wording. Unknown keys and blanks are stripped
                // by PopupTextOverrides::sanitize() before the column is written.
                'popup_text' => 'nullable|array',
                'popup_text.*' => 'nullable|string|max:255',
                'reprompt' => 'nullable|in:remember,session,always',
            ]);

            if (!empty($validated['starts_at']) && !empty($validated['expires_at'])
                && strtotime($validated['expires_at']) <= strtotime($validated['starts_at'])) {
                return $this->refuseToFormPage('Expiry date must be after the activation date.', 'validation');
            }

            if (array_key_exists('rules', $validated)) {
                $validated['rules'] = $this->normalizeConditionGroups($validated['rules']);
            }

            // Plan enforcement: lock count + per-feature gates (resource types,
            // condition types, scheduling). Server-side so the limits hold even
            // if the UI is bypassed.
            $violations = app(\App\Services\BillingService::class)
                ->lockViolations($shop, $validated, empty($validated['lock_id']));
            if (! empty($violations)) {
                return $this->refuseToFormPage(implode(' ', $violations), 'plan');
            }

            // 1. Fetch Widget Data (form widget + text widget)
            $widgetPayload = null;
            $textWidgetPayload = null;
            $widgetId = $validated['widget_id'] ?? null;
            $textWidgetId = $validated['text_widget_id'] ?? null;

            // Auto-assign form widget if none selected
            if (empty($widgetId)) {
                $autoWidget = Widget::active()
                    ->where('user_id', $shop->id)
                    ->where('type', 'form')
                    ->first();
                if ($autoWidget) {
                    $widgetId = $autoWidget->id;
                }
            }

            // Auto-assign text widget if none selected
            if (empty($textWidgetId)) {
                $autoTextWidget = Widget::active()
                    ->where('user_id', $shop->id)
                    ->where('type', 'text')
                    ->first();
                if ($autoTextWidget) {
                    $textWidgetId = $autoTextWidget->id;
                }
            }

            // Build form widget payload
            if (!empty($widgetId)) {
                $widget = Widget::find($widgetId);
                if ($widget) {
                    $widgetPayload = [
                        'id' => $widget->id,
                        'type' => $widget->type,
                        'name' => $widget->name,
                        'settings' => $widget->configuration,
                    ];
                }
            }

            // Build text widget payload
            if (!empty($textWidgetId)) {
                $textWidget = Widget::find($textWidgetId);
                if ($textWidget) {
                    $textWidgetPayload = [
                        'id' => $textWidget->id,
                        'type' => $textWidget->type,
                        'name' => $textWidget->name,
                        'settings' => $textWidget->configuration,
                    ];
                }
            }

            // 2. DB Storage (First)
            $isNew = false;
            $lockId = $validated['lock_id'] ?? null;
            $lock = null;

            if ($lockId) {
                $lock = \App\Models\Lock::find($lockId);
                if ($lock->shop_id !== $shop->id)
                    abort(403);

                $lock->update([
                    'name' => $validated['name'],
                    'description' => $validated['description'] ?? $lock->description,
                    'popup_text' => array_key_exists('popup_text', $validated)
                        ? (PopupTextOverrides::sanitize($validated['popup_text']) ?: null)
                        : $lock->popup_text,
                    'reprompt' => $validated['reprompt'] ?? $lock->reprompt,
                    'status' => $validated['status'] === 'Active',
                    'starts_at' => $validated['starts_at'] ?? null,
                    'expires_at' => $validated['expires_at'] ?? null,
                    'widget_id' => $widgetId,
                    'text_widget_id' => $textWidgetId,
                    'allow_email_request' => $validated['user_request_by_email'] ?? $lock->allow_email_request,
                    'seo_block' => array_key_exists('seo_block', $validated) ? $validated['seo_block'] : $lock->seo_block,
                ]);
            } else {
                $isNew = true;
                $lock = \App\Models\Lock::create([
                    'shop_id' => $shop->id,
                    'name' => $validated['name'],
                    'description' => $validated['description'] ?? '',
                    'popup_text' => PopupTextOverrides::sanitize($validated['popup_text'] ?? null) ?: null,
                    'reprompt' => $validated['reprompt'] ?? 'remember',
                    'status' => $validated['status'] === 'Active',
                    'handle' => 'multi-' . time(),
                    'type' => 'mixed',
                    'starts_at' => $validated['starts_at'] ?? null,
                    'expires_at' => $validated['expires_at'] ?? null,
                    'widget_id' => $widgetId,
                    'text_widget_id' => $textWidgetId,
                    'allow_email_request' => $validated['user_request_by_email'] ?? false,
                    'seo_block' => $validated['seo_block'] ?? true,
                ]);
            }

            foreach ($validated['selectedItems'] as $item) {
                $resourceType = $item['resource_type'];
                $handle = $item['handle'];

                // Variant-level locking (5.4): per-item variant_ids array narrows
                // the rule to specific variants of a product. Empty/missing →
                // product-wide rule (existing behavior).
                $variantIds = array_values(array_filter($item['variant_ids'] ?? [], 'strlen'));
                $scope = !empty($variantIds) ? 'variant' : 'product';

                // Save Rule to DB.
                // lock_id MUST be part of the match key. Multiple locks are
                // allowed to target the same resource (the unique constraint on
                // (shop_id, resource_type, handle) was dropped in migration
                // 2026_01_13_000001 for exactly this reason). Without lock_id
                // here, creating a new lock on a product another lock already
                // covers would MATCH that other lock's rule and re-point its
                // lock_id to this lock — silently stealing the rule and leaving
                // the original lock with nothing to hydrate on reopen.
                $rule = \App\Models\AccessRule::updateOrCreate(
                    [
                        'shop_id' => $shop->id,
                        'lock_id' => $lock->id,
                        'resource_type' => $resourceType,
                        'handle' => $handle,
                    ],
                    [
                        'enabled' => $lock->status,  // Sync enable state with lock status
                        'prompt' => $validated['description'] ?? null,
                        'conditions' => $validated['rules'] ?? null,
                        'redirect_url' => $validated['redirect_url'] ?? null,
                        'settings' => [
                            'widget_json' => $widgetPayload,
                            'text_widget_json' => $textWidgetPayload,
                            'protect_products' => $validated['protect_products'] ?? false,
                            'hide_navigation' => $validated['hide_navigation'] ?? false,
                            'hide_lists' => $validated['hide_lists'] ?? false,
                            'hide_add_to_cart' => $validated['hide_add_to_cart'] ?? false,
                            'hide_completely' => $validated['hide_completely'] ?? false,
                            'scope' => $scope,
                            'variant_ids' => $variantIds,
                            'locked_variant_display' => $validated['locked_variant_display'] ?? 'hide',
                            'all_variants_locked_behavior' => $validated['all_variants_locked_behavior'] ?? 'hide_product',
                        ]
                    ]
                );

            }

            // Storefront sync — never fails the save; incomplete writes are
            // retried in the background until the storefront matches the DB.
            $lock->load('accessRules');
            $this->syncMetafieldsWithRetry($shop, $lock);

            // Update Global Metafield
            $this->updateGlobalMetafield($shop);

            if ($isNew) {
                app(\App\Services\MailService::class)->lockCreated($shop, $lock);
            }

            return to_route('locks.index')->with('success', 'Lock saved successfully');
        } catch (\Illuminate\Validation\ValidationException $e) {
            // Let validation exceptions bubble up normally (Inertia handles them)
            throw $e;
        } catch (\Exception $e) {
            Log::error('storeLock failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'shop_id' => $shop->id,
            ]);

            return $this->refuseToFormPage('Failed to create lock: ' . $e->getMessage(), 'error');
        }
    }

    // --- METAFIELD HELPERS ---

    /**
     * Resolve the numeric Shopify ID for a rule's target resource.
     * Local DB first; on a miss (sync lag, missing webhook, renamed handle)
     * falls back to a live Admin API lookup by handle, which also repairs
     * the local row so the next save is fast again.
     */
    private function resolveNumericResourceId($shop, string $resourceType, ?string $handle): ?string
    {
        $map = [
            'collection' => [Collection::class, 'shopify_collection_id'],
            'product' => [Product::class, 'shopify_product_id'],
            'page' => [Page::class, 'shopify_page_id'],
            'blog' => [Blog::class, 'shopify_blog_id'],
        ];

        if (!isset($map[$resourceType])) {
            return null;
        }

        [$modelClass, $idField] = $map[$resourceType];

        // Freshest row wins: the local cache can briefly hold a stale
        // duplicate for the same handle (deleted-then-recreated product) whose
        // old GID would make the metafield write target a ghost resource.
        $resource = $handle
            ? $modelClass::where('shop_id', $shop->id)->where('handle', $handle)->orderByDesc('updated_at')->first()
            : null;

        $gid = $resource?->$idField;

        if (!$gid) {
            $gid = $this->resolveResourceGidByHandle($shop, $resourceType, $handle);
        }

        return $gid ? preg_replace('/[^0-9]/', '', $gid) : null;
    }

    private function updateResourceMetafield($shop, $rule, string $resourceType, string $apiResourceName): array
    {
        try {
            $numericId = $this->resolveNumericResourceId($shop, $resourceType, $rule->handle);

            if (!$numericId) {
                Log::warning(ucfirst($resourceType) . ' not found for metafield update', [
                    'handle' => $rule->handle,
                    'shop_id' => $shop->id
                ]);
                return ['success' => false, 'error' => "{$resourceType} \"{$rule->handle}\" not found on Shopify", 'code' => 'not_found'];
            }

            return $this->syncMetafield($shop, $rule, $apiResourceName, $numericId);
        } catch (\Exception $e) {
            Log::error("Failed to update {$resourceType} metafield", [
                'error' => $e->getMessage(),
                'rule_id' => $rule->id
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function updateCollectionMetafield($shop, $rule)
    {
        return $this->updateResourceMetafield($shop, $rule, 'collection', 'collections');
    }

    public function updateProductMetafield($shop, $rule)
    {
        return $this->updateResourceMetafield($shop, $rule, 'product', 'products');
    }

    public function updatePageMetafield($shop, $rule)
    {
        return $this->updateResourceMetafield($shop, $rule, 'page', 'pages');
    }

    public function updateBlogMetafield($shop, $rule)
    {
        return $this->updateResourceMetafield($shop, $rule, 'blog', 'blogs');
    }

    public function updateShopMetafield($shop, $rule)
    {
        try {
            $store = \App\Models\Store::where('shop_id', $shop->id)->first();
            $storeId = $store ? $store->shopify_store_id : ($shop->shopify_store_id ?? $shop->id);
            return $this->syncMetafield($shop, $rule, 'shops', $storeId);
        } catch (\Exception $e) {
            Log::error('Failed to update shop metafield', [
                'error' => $e->getMessage(),
                'rule_id' => $rule->id
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Checkout rules (5.5) are stored at the shop level under a separate
     * namespace (access_control.checkout_rule) so the Checkout UI Extension
     * and Function can read them without colliding with shop-wide page locks.
     */
    public function updateCheckoutMetafield($shop, $rule)
    {
        try {
            // Hard enforcement only happens if the checkout validation
            // function is registered as a Validation on the shop — a
            // deployed-but-unregistered function never runs. Ensure it
            // lazily on every checkout-rule write (cached once done).
            $this->ensureCheckoutValidation($shop);

            $store = \App\Models\Store::where('shop_id', $shop->id)->first();
            $storeId = $store ? $store->shopify_store_id : ($shop->shopify_store_id ?? $shop->id);
            return $this->syncMetafield($shop, $rule, 'shops', $storeId, 'checkout_rule');
        } catch (\Exception $e) {
            Log::error('Failed to update checkout metafield', [
                'error' => $e->getMessage(),
                'rule_id' => $rule->id
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private const CHECKOUT_VALIDATION_TITLE = 'Airo Access Lock & Control';
    private const CHECKOUT_VALIDATION_HANDLE = 'airo-lock-checkout-validation';

    /**
     * Register (and enable) the checkout validation function as a
     * Validation on the shop. Without this, the Shopify Function is
     * deployed but never executed, so checkout locks enforce nothing
     * server-side. Idempotent: matched by title, cached for a day once
     * confirmed. Requires the read_validations/write_validations scopes;
     * if they are missing the failure is logged and checkout locks stay
     * soft-enforced by the UI extension until the merchant re-approves.
     */
    private function ensureCheckoutValidation($shop): void
    {
        $cacheKey = 'airo_checkout_validation_ok_' . $shop->id;

        try {
            // Inside the try: a cache-store hiccup must fall through to the
            // registration attempt, never abort the caller's metafield write.
            if (Cache::get($cacheKey)) {
                return;
            }

            $response = ShopifyRetry::run(fn () => $shop->api()->graph(
                'query { validations(first: 50) { nodes { id enabled title } } }'
            ));
            if (isset($response['body']['errors'])) {
                Log::warning('Checkout validation lookup failed — read_validations/write_validations scope not granted yet?', [
                    'shop' => $shop->name,
                    'errors' => json_decode(json_encode($response['body']['errors']), true),
                ]);
                return;
            }

            $nodes = $response['body']['data']['validations']['nodes'] ?? [];
            if (is_object($nodes)) {
                $nodes = json_decode(json_encode($nodes), true);
            }
            $ours = collect($nodes)->first(fn ($n) => ($n['title'] ?? '') === self::CHECKOUT_VALIDATION_TITLE);

            if ($ours) {
                if (empty($ours['enabled'])) {
                    ShopifyRetry::run(fn () => $shop->api()->graph(
                        'mutation ($id: ID!, $validation: ValidationUpdateInput!) {
                            validationUpdate(id: $id, validation: $validation) { userErrors { field message } }
                        }',
                        ['id' => $ours['id'], 'validation' => ['enable' => true]]
                    ));
                    Log::info('Checkout validation re-enabled', ['shop' => $shop->name]);
                }
                Cache::put($cacheKey, true, now()->addDay());
                return;
            }

            $response = ShopifyRetry::run(fn () => $shop->api()->graph(
                'mutation ($validation: ValidationCreateInput!) {
                    validationCreate(validation: $validation) {
                        validation { id enabled }
                        userErrors { field message }
                    }
                }',
                ['validation' => [
                    'functionHandle' => self::CHECKOUT_VALIDATION_HANDLE,
                    'enable' => true,
                    // Fail-open on runtime exceptions (e.g. timeouts): a
                    // crashed function must not block every checkout on the
                    // store. Actual rule failures always block regardless.
                    'blockOnFailure' => false,
                    'title' => self::CHECKOUT_VALIDATION_TITLE,
                ]]
            ));

            $userErrors = $response['body']['data']['validationCreate']['userErrors'] ?? [];
            if (is_object($userErrors)) {
                $userErrors = json_decode(json_encode($userErrors), true);
            }
            if (isset($response['body']['errors']) || !empty($userErrors)) {
                Log::warning('Checkout validation registration failed — checkout locks stay soft-enforced (UI extension only)', [
                    'shop' => $shop->name,
                    'errors' => json_decode(json_encode($response['body']['errors'] ?? []), true),
                    'userErrors' => $userErrors,
                ]);
                return;
            }

            Cache::put($cacheKey, true, now()->addDay());
            Log::info('Checkout validation registered and enabled', ['shop' => $shop->name]);
        } catch (\Exception $e) {
            Log::warning('Checkout validation registration error', [
                'shop' => $shop->name ?? null,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * The canonical storefront payload for one rule — used for the metafield
     * write AND served live by the app-proxy /rules endpoint so the storefront
     * can recover from Shopify's stale rendered-HTML cache.
     */
    /**
     * Prompts that were never really authored by a merchant.
     *
     * Older builds wrote an English sentence into the metafield whenever a
     * rule had no prompt of its own. On the storefront that string outranks
     * the translated default, so a shop selling in French got a French popup
     * with one stubbornly English line. Treat these as "unset".
     */
    private const AUTO_PROMPTS = [
        'Access restricted. Please enter credentials.',
        'Access restricted.',
    ];

    /**
     * Null unless the merchant typed a prompt of their own, in which case
     * their wording is returned untouched and wins over the translation.
     */
    public static function merchantPrompt(?string $prompt): ?string
    {
        $prompt = is_string($prompt) ? trim($prompt) : '';

        if ($prompt === '' || in_array($prompt, self::AUTO_PROMPTS, true)) {
            return null;
        }

        return $prompt;
    }

    /**
     * The locales this shop publishes, for baking "follow the storefront
     * language" text. Cached on store_details by ShopLocaleService; an empty
     * list just means only English gets written.
     *
     * @return array<int, array<string, mixed>>
     */
    private function shopLocalesFor($rule): array
    {
        $shopId = $rule->shop_id ?? null;
        if (! $shopId) {
            return [];
        }

        static $cache = [];

        if (! array_key_exists($shopId, $cache)) {
            $detail = \App\Models\StoreDetail::where('user_id', $shopId)->first();
            $cache[$shopId] = is_array($detail?->shop_locales) ? $detail->shop_locales : [];
        }

        return $cache[$shopId];
    }

    public function buildRuleMetafieldData($rule): array
    {
        // Extract simple passcodes
        $simplePasscodes = [];
        if (isset($rule->conditions)) {
            $simplePasscodes = $this->extractSimplePasscodes($rule->conditions ?? []);
        }

        $requiresComplexCheck = false;
        if (isset($rule->conditions)) {
            $requiresComplexCheck = $this->requiresComplexCheck($rule->conditions ?? []);
        }

        $lockForSchedule = $rule->lock_id ? ($rule->lock ?? Lock::find($rule->lock_id)) : null;

        // Widget payload: read the widget row, never the cached copy.
        //
        // settings.widget_json is a snapshot taken when the WIDGET is saved.
        // This used to prefer that snapshot and only look the widget up when
        // it was missing entirely — so a snapshot written before a field
        // existed (design colours but no `language`, say) got republished on
        // every metafield push, and editing the widget's language changed
        // nothing on the storefront. The widgets table is the source of
        // truth; the snapshot is only a fallback for a deleted widget.
        $ruleSettings = is_array($rule->settings) ? $rule->settings : [];

        $livePayload = function ($widgetId) {
            if (!$widgetId) {
                return null;
            }
            $widget = Widget::find($widgetId);
            if (!$widget) {
                return null;
            }

            return [
                'id' => $widget->id,
                'type' => $widget->type,
                'name' => $widget->name,
                'settings' => $widget->configuration,
            ];
        };

        $widgetData = $livePayload($lockForSchedule?->widget_id)
            ?? ($ruleSettings['widget_json'] ?? null);

        $textWidgetData = $livePayload($lockForSchedule?->text_widget_id)
            ?? ($ruleSettings['text_widget_json'] ?? null);

        $startsAtIso = $lockForSchedule && $lockForSchedule->starts_at ? $lockForSchedule->starts_at->toIso8601String() : null;
        $expiresAtIso = $lockForSchedule && $lockForSchedule->expires_at ? $lockForSchedule->expires_at->toIso8601String() : null;

        // Resolve the popup's language here rather than leaving it to the
        // storefront. The popup can only translate itself on extension
        // versions that shipped that code; text written into the metafield
        // renders in the chosen language on every version. See PopupTextBaker.
        $conditions = $rule->conditions ?? [];
        $prompt = self::merchantPrompt($rule->prompt);

        // Per-lock wording first, so the baker below sees an override as
        // merchant-authored text and leaves it alone. Precedence ends up:
        // lock override > widget value > translated default.
        $overrides = new PopupTextOverrides($lockForSchedule?->popup_text);
        if (! $overrides->isEmpty()) {
            $widgetData = $overrides->withWidgetText($widgetData);
            $textWidgetData = $overrides->withWidgetText($textWidgetData);
            $conditions = $overrides->withFieldLabels($conditions);
        }

        $language = $widgetData['settings']['language']
            ?? $textWidgetData['settings']['language']
            ?? null;

        $baker = new PopupTextBaker($language, $this->shopLocalesFor($rule));

        if (! $baker->isNoop()) {
            if ($widgetData) {
                $widgetData = $baker->withWidgetText($widgetData);
            }
            if ($textWidgetData) {
                $textWidgetData = $baker->withWidgetText($textWidgetData);
            }

            // Field labels ride along inside conditions, which is where the
            // popup builds its inputs from.
            $conditions = $baker->withFieldLabels($conditions);

            // Only when the merchant left the description to us.
            $prompt ??= $baker->text(PopupTextBaker::promptKey($conditions));
        }

        $metafieldData = [
            'rule_id' => $rule->id,
            'target_type' => $rule->resource_type,
            'target_handle' => $rule->handle,
            'enabled' => $rule->enabled,
            // Null only when nothing was authored AND nothing was baked, so
            // the storefront can still fall back to its own default.
            'prompt' => $prompt,
            'hide_price' => $rule->hide_price ?? false,
            'price_message' => $rule->price_message ?? null,
            'conditions' => $conditions,  // Full condition structure for frontend evaluation
            'simple_passcodes' => $simplePasscodes,
            'requires_complex_check' => $requiresComplexCheck,
            'widget' => $widgetData,
            'text_widget' => $textWidgetData,
            'redirect_url' => $rule->redirect_url ?? null,
            'starts_at' => $startsAtIso,
            'expires_at' => $expiresAtIso,
            'seo_block' => $lockForSchedule ? (bool) $lockForSchedule->seo_block : true,
            'scope' => $rule->settings['scope'] ?? 'product',
            'variant_ids' => $rule->settings['variant_ids'] ?? [],
            'locked_variant_display' => $rule->settings['locked_variant_display'] ?? 'hide',
            'all_variants_locked_behavior' => $rule->settings['all_variants_locked_behavior'] ?? 'hide_product',
            'settings' => [
                'protect_products' => $rule->settings['protect_products'] ?? $rule->protect_products ?? false,
                'hide_navigation' => $rule->settings['hide_navigation'] ?? $rule->hide_navigation ?? false,
                'hide_lists' => $rule->settings['hide_lists'] ?? $rule->hide_lists ?? false,
                'hide_add_to_cart' => $rule->settings['hide_add_to_cart'] ?? $rule->hide_add_to_cart ?? false,
                'hide_completely' => $rule->settings['hide_completely'] ?? false,
                'allow_email_request' => $rule->lock->allow_email_request ?? false,
                'seo_block' => $lockForSchedule ? (bool) $lockForSchedule->seo_block : true,
                'scope' => $rule->settings['scope'] ?? 'product',
                'variant_ids' => $rule->settings['variant_ids'] ?? [],
                'locked_variant_display' => $rule->settings['locked_variant_display'] ?? 'hide',
                'all_variants_locked_behavior' => $rule->settings['all_variants_locked_behavior'] ?? 'hide_product',
                'requires_input' => $this->requiresInput($rule->conditions ?? []),
                // How long a visitor stays unlocked: remember | session | always.
                // The storefront caches a 'granted' flag in localStorage, and
                // this is what tells it whether it may.
                'reprompt' => $lockForSchedule->reprompt ?? 'remember',
            ]
        ];

        return $metafieldData;
    }

    private function syncMetafield($shop, $rule, $resourceName, $resourceId, $metafieldKey = 'access_rule')
    {
        $metafieldData = $this->buildRuleMetafieldData($rule);

        // Use GraphQL Admin API via MetafieldService
        $metafieldService = new MetafieldService();
        $resourceGid = $metafieldService->buildResourceGid($resourceName, $resourceId);

        $result = $metafieldService->updateMetafieldArray(
            $shop,
            $resourceGid,
            'access_control',
            $metafieldKey,
            $rule->lock_id,
            $metafieldData
        );

        if ($result['success']) {
            Log::info("{$resourceName} metafield updated via GraphQL", [
                'resource_id' => $resourceId,
                'resource_gid' => $resourceGid,
                'rule_id' => $rule->id,
                'namespace' => 'access_control',
                'key' => $metafieldKey,
                'metafield_id' => $result['metafield']['id'] ?? null
            ]);
        } else {
            Log::error('Metafield update failed via GraphQL', [
                'errors' => $result['errors'] ?? $result['error'] ?? 'Unknown error',
                'resource_id' => $resourceId,
                'resource_gid' => $resourceGid,
                'key' => $metafieldKey,
            ]);
        }

        return $result;
    }

    /**
     * Push every rule of a lock to its storefront metafield from current DB
     * state — the single write path shared by create, update and the queued
     * retry job. Enabled rules are written (rich `syncMetafield` shape, the
     * only shape the storefront fully understands); disabled rules get their
     * metafield entry removed so the storefront never enforces a lock the
     * admin shows as off.
     *
     * @return string[] human-readable failure descriptions (empty = fully synced)
     */
    public function syncLockRulesToMetafields($shop, Lock $lock): array
    {
        $failures = [];

        foreach ($lock->accessRules as $rule) {
            $shouldWrite = $lock->status && $rule->enabled;

            // Checkout enforcement runs in a Shopify Function with no reliable
            // clock, so schedule gating for checkout locks is done HERE (server
            // time, timezone-correct): the rule is written only while active and
            // removed otherwise. ReconcileCheckoutSchedulesJob re-runs this at
            // activation; ExpireLocksJob removes it at expiry. Storefront types
            // keep carrying starts_at/expires_at and gate client-side.
            if ($shouldWrite && $rule->resource_type === 'checkout') {
                $shouldWrite = $lock->isCurrentlyActive();
            }

            if ($shouldWrite) {
                $result = match ($rule->resource_type) {
                    'collection' => $this->updateCollectionMetafield($shop, $rule),
                    'product' => $this->updateProductMetafield($shop, $rule),
                    'page' => $this->updatePageMetafield($shop, $rule),
                    'blog' => $this->updateBlogMetafield($shop, $rule),
                    'shop' => $this->updateShopMetafield($shop, $rule),
                    'checkout' => $this->updateCheckoutMetafield($shop, $rule),
                    default => ['success' => true], // themes/variants have no per-resource metafield
                };

                // Resource permanently gone from Shopify: retrying can never
                // succeed and there is no page left to enforce on — log and
                // move on instead of burning six retry attempts.
                if (!($result['success'] ?? false) && ($result['code'] ?? '') === 'not_found') {
                    Log::warning('[LockSync] rule targets a resource that no longer exists on Shopify — skipping', [
                        'rule_id' => $rule->id,
                        'resource_type' => $rule->resource_type,
                        'handle' => $rule->handle,
                    ]);
                    $result = ['success' => true];
                }
            } else {
                $result = $this->performMetafieldDelete($shop, $rule);
                // A delete that fails because the resource is gone is fine —
                // there is nothing left to enforce on.
                if (!($result['success'] ?? false) && ($result['code'] ?? '') === 'not_found') {
                    $result = ['success' => true];
                }
            }

            if (!($result['success'] ?? false)) {
                $failures[] = "{$rule->resource_type} \"{$rule->handle}\": "
                    . (is_string($result['error'] ?? null) ? $result['error'] : json_encode($result['errors'] ?? 'unknown error'));
            }
        }

        return $failures;
    }

    /**
     * Best-effort storefront sync after a save: the merchant's save already
     * succeeded (DB is the source of truth); if any metafield write failed,
     * queue a background retry with backoff so the storefront converges
     * without the merchant doing anything.
     */
    public function syncMetafieldsWithRetry($shop, Lock $lock): array
    {
        $failures = $this->syncLockRulesToMetafields($shop, $lock);

        if (!empty($failures)) {
            Log::warning('[LockSync] metafield sync incomplete after save — queueing retry', [
                'shop_id' => $shop->id,
                'lock_id' => $lock->id,
                'failures' => $failures,
            ]);
            \App\Jobs\SyncLockMetafieldsJob::dispatch($shop->id, $lock->id)
                ->delay(now()->addSeconds(30));
        }

        return $failures;
    }

    private function extractSimplePasscodes($conditions)
    {
        $passcodes = [];

        if (!is_array($conditions))
            return $passcodes;

        foreach ($conditions as $group) {
            if (!is_array($group) || !isset($group['conditions']))
                continue;

            foreach ($group['conditions'] as $condition) {
                if (
                    isset($condition['type']) &&
                    ($condition['type'] === 'passcode' || $condition['type'] === 'singlePasscode') &&
                    isset($condition['value'])
                ) {
                    $passcodes[] = trim($condition['value']);
                }

                if (
                    isset($condition['type']) &&
                    $condition['type'] === 'multiplePasscodes' &&
                    isset($condition['value'])
                ) {
                    // Newline-joined canonically; old admin builds taught
                    // merchants to save backslash-separated values on one
                    // line — split those too (matches the storefront
                    // validator's splitListValue).
                    $value = $condition['value'];
                    $parts = str_contains($value, "\n")
                        ? explode("\n", $value)
                        : preg_split('/\\\\n|\\\\/', $value);
                    $multiple = array_filter(array_map('trim', $parts));
                    $passcodes = array_merge($passcodes, $multiple);
                }
            }
        }

        return array_unique($passcodes);
    }

    private function requiresComplexCheck($conditions)
    {
        if (!is_array($conditions))
            return false;

        foreach ($conditions as $group) {
            if (!is_array($group) || !isset($group['conditions']))
                continue;

            foreach ($group['conditions'] as $condition) {
                $type = $condition['type'] ?? '';
                if (in_array($type, ['tag', 'emailContains', 'specificEmail', 'location', 'ip', 'signedIn'])) {
                    return true;
                }
            }
        }

        return false;
    }

    // Indicates if any condition requires user input on storefront
    private function requiresInput($conditions): bool
    {
        if (!is_array($conditions)) {
            return false;
        }
        $inputTypes = [
            'singlePasscode',
            'passcode',
            'multiplePasscodes',
            'passcodeFromList',
            'specificEmail',
            'emailContains',
            'emailFromList',
            'ageVerification',
            'pairedCredentials',
        ];
        foreach ($conditions as $group) {
            if (!is_array($group) || !isset($group['conditions'])) {
                continue;
            }
            foreach ($group['conditions'] as $condition) {
                $type = $condition['type'] ?? '';
                if (in_array($type, $inputTypes, true)) {
                    return true;
                }
            }
        }
        return false;
    }

    public function configureLock(Lock $lock)
    {
        // Ensure user owns this lock
        if ($lock->shop_id !== Auth::id()) {
            abort(403);
        }

        $shop = Auth::user();

        // Ensure store record exists. The stores table has `url` (NOT NULL),
        // not `domain` — passing 'domain' was silently discarded by fillable
        // and the missing 'url' made this insert throw for shops whose
        // SyncStoreJob hadn't run yet.
        $store = Store::where('shop_id', $shop->id)->first();
        if (!$store) {
            $store = Store::create([
                'shop_id' => $shop->id,
                'shopify_store_id' => $shop->id,  // Fallback to shop ID
                'name' => $shop->name ?? 'Online Store',
                'url' => 'https://' . $shop->getDomain()->toNative(),
            ]);
        }

        // The builder hosts the full widget editor, whose language section
        // offers exactly the languages the shop publishes.
        $shopLocales = app(ShopLocaleService::class)->get(Auth::user());

        $data = [
            'lock' => $lock->load('accessRules'),
            'store' => $store,
            'products' => $this->pickerProducts($shop),
            'variants' => Variant::where('shop_id', $shop->id)
                ->select(['id', 'variant_id', 'title', 'shopify_product_id'])
                ->get(),
            'collections' => $this->pickerResources(Collection::class, $shop, ['id', 'shopify_collection_id', 'title', 'handle', 'products_count'], 'shopify_collection_id'),
            'pages' => $this->pickerResources(Page::class, $shop, ['id', 'shopify_page_id', 'title', 'handle'], 'shopify_page_id'),
            'blogs' => $this->pickerResources(Blog::class, $shop, ['id', 'shopify_blog_id', 'title', 'handle'], 'shopify_blog_id'),
            'themes' => Theme::where('shop_id', $shop->id)
                ->select(['id', 'shopify_theme_id', 'name', 'role'])
                ->get(),
            'formWidgets' => Widget::active()
                ->where('user_id', $shop->id)
                ->where('type', 'form')
                ->select(['id', 'name', 'configuration'])
                ->get(),
            'textWidgets' => Widget::active()
                ->where('user_id', $shop->id)
                ->where('type', 'text')
                ->select(['id', 'name', 'configuration'])
                ->get(),
            'existingLock' => $lock->load('accessRules'),  // Pass as existingLock for compatibility
            // Items covered by OTHER locks, with the owning lock's name/state —
            // the builder warns that only ONE lock is enforced per item.
            'lockedItems' => AccessRule::where('access_rules.shop_id', $shop->id)
                ->where('access_rules.lock_id', '!=', $lock->id)
                ->join('locks', 'locks.id', '=', 'access_rules.lock_id')
                ->select(['access_rules.resource_type', 'access_rules.handle', 'access_rules.lock_id', 'locks.name as lock_name', 'locks.status as lock_active'])
                ->get(),
            // The builder hosts the full widget editor, whose language section
            // offers exactly the languages the shop publishes.
            'storeLocales' => $shopLocales['locales'],
            'primaryLocale' => $shopLocales['primary'],
        ];

        return Inertia::render('locks/LockCreationEdit', $data);
    }

    public function updateLock(\Illuminate\Http\Request $request, Lock $lock)
    {
        $traceId = uniqid('upd_');
        $debugTrace = [
            'trace_id' => $traceId,
            'lock_id' => $lock->id,
            'incoming_name' => $request->input('name'),
            'current_db_name' => $lock->name,
        ];

        if ($lock->shop_id !== Auth::id()) {
            abort(403);
        }

        // Convert empty strings to null for nullable fields (Inertia FormData converts null to '')
        $request->merge([
            'widget_id' => $request->input('widget_id') ?: null,
            'text_widget_id' => $request->input('text_widget_id') ?: null,
        ]);

        if ($request->filled('widget_id') && !Widget::whereKey($request->input('widget_id'))->exists()) {
            $request->merge(['widget_id' => null]);
        }
        if ($request->filled('text_widget_id') && !Widget::whereKey($request->input('text_widget_id'))->exists()) {
            $request->merge(['text_widget_id' => null]);
        }

        try {
            $validated = $request->validate([
                'name' => 'nullable|string',
                'enabled' => 'boolean',
                'prompt' => 'nullable|string',
                'popup_text' => 'nullable|array',
                'popup_text.*' => 'nullable|string|max:255',
                'reprompt' => 'nullable|in:remember,session,always',
                'conditions' => 'nullable|array',
                'redirect_url' => 'nullable|string',
                'protect_products' => 'boolean',
                'hide_navigation' => 'boolean',
                'hide_lists' => 'boolean',
                'hide_completely' => 'nullable|boolean',
                'force_open' => 'boolean',
                'starts_at' => 'nullable|date',
                // See storeLock — after:starts_at bounces expiry-only schedules.
                'expires_at' => 'nullable|date',
                'user_request_by_email' => 'boolean',
                'widget_id' => 'nullable|integer',
                'text_widget_id' => 'nullable|integer',
                'hide_add_to_cart' => 'nullable|boolean',
                'seo_block' => 'nullable|boolean',
                'selectedItems' => 'nullable|array',
                'selectedItems.*.handle' => 'nullable',
                'selectedItems.*.resource_type' => 'nullable|in:collection,product,page,blog,theme,variant,shop,checkout',
                'selectedItems.*.variant_ids' => 'nullable|array',
                'selectedItems.*.variant_ids.*' => 'string',
                'locked_variant_display' => 'nullable|in:hide,disable',
                'all_variants_locked_behavior' => 'nullable|in:hide_product,show_disabled',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('[updateLock] VALIDATION FAILED', [
                'trace_id' => $traceId,
                'errors' => $e->errors(),
                'incoming_name' => $request->input('name'),
            ]);
            throw $e;
        } catch (\Throwable $e) {
            Log::error('[updateLock] UNEXPECTED EXCEPTION during validation', [
                'trace_id' => $traceId,
                'class' => \get_class($e),
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }

        $debugTrace['validated_name'] = $validated['name'] ?? '(absent from validated)';
        $debugTrace['validated_has_name'] = array_key_exists('name', $validated);

        $shop = Auth::user();

        if (!empty($validated['starts_at']) && !empty($validated['expires_at'])
            && strtotime($validated['expires_at']) <= strtotime($validated['starts_at'])) {
            return $this->refuseToFormPage('Expiry date must be after the activation date.', 'validation');
        }

        if (array_key_exists('conditions', $validated)) {
            $validated['conditions'] = $this->normalizeConditionGroups($validated['conditions']);
        }

        // Plan enforcement — same gates as storeLock. Without this, a lock
        // created within plan limits could be edited to carry premium
        // conditions, gated resource types or scheduling. Edits never fail
        // the count check (isNew=false).
        $violations = app(\App\Services\BillingService::class)->lockViolations($shop, [
            'selectedItems' => $validated['selectedItems'] ?? [],
            'rules' => $validated['conditions'] ?? [],
            'starts_at' => $validated['starts_at'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
        ], false);
        if (! empty($violations)) {
            return $this->refuseToFormPage(implode(' ', $violations), 'plan');
        }

        // 1. Determine Widget Data (auto-assign if missing)
        $widgetId = $validated['widget_id'] ?? $lock->widget_id;
        $widget = null;
        if ($widgetId) {
            $widget = Widget::find($widgetId);
        }

        // Auto-assign first active widget if none found
        if (!$widget) {
            $widget = Widget::active()
                ->where('user_id', $shop->id)
                ->first();
            if ($widget) {
                $widgetId = $widget->id;
            }
        }

        $widgetPayload = null;
        if ($widget) {
            $widgetPayload = [
                'id' => $widget->id,
                'type' => $widget->type,
                'name' => $widget->name,
                'settings' => $widget->configuration,
            ];
        }

        // Determine Text Widget Data
        $textWidgetId = $validated['text_widget_id'] ?? $lock->text_widget_id;
        $textWidget = null;
        if ($textWidgetId) {
            $textWidget = Widget::find($textWidgetId);
        }

        // Auto-assign first active text widget if none found
        if (!$textWidget) {
            $textWidget = Widget::active()
                ->where('user_id', $shop->id)
                ->where('type', 'text')
                ->first();
            if ($textWidget) {
                $textWidgetId = $textWidget->id;
            }
        }

        $textWidgetPayload = null;
        if ($textWidget) {
            $textWidgetPayload = [
                'id' => $textWidget->id,
                'type' => $textWidget->type,
                'name' => $textWidget->name,
                'settings' => $textWidget->configuration,
            ];
        }

        // 2. DB updates FIRST (source of truth), storefront metafields after.
        // A Shopify hiccup must never fail the merchant's save — incomplete
        // metafield writes are retried in the background until they land.

        // Prepare common data
        $isEnabled = array_key_exists('enabled', $validated) ? $validated['enabled'] : $lock->status;
        $commonPrompt = $validated['prompt'] ?? $lock->description;
        $commonConditions = $validated['conditions'] ?? null;

        // Per-item variant scope keyed by type|handle — the edit form resubmits
        // it on every save, and it must round-trip into rule settings or the
        // storefront silently loses variant-level scoping after any edit.
        $variantByKey = [];
        foreach ($validated['selectedItems'] ?? [] as $item) {
            if (!empty($item['resource_type'])) {
                $ids = array_values(array_filter($item['variant_ids'] ?? [], 'strlen'));
                $variantByKey[$item['resource_type'] . '|' . ($item['handle'] ?? '')] = $ids;
            }
        }

        // Sync access_rules to match the incoming selectedItems (add new, remove unselected).
        // Frontend blocks empty submissions, so an empty array here is treated as "no change".
        if (array_key_exists('selectedItems', $validated) &&
                is_array($validated['selectedItems']) &&
                count($validated['selectedItems']) > 0) {
            $makeKey = static function ($type, $handle) {
                return ($type ?? '') . '|' . ($handle ?? '');
            };

            $targetItems = [];
            foreach ($validated['selectedItems'] as $item) {
                $type = $item['resource_type'] ?? null;
                if (!$type) {
                    continue;
                }
                $handle = $item['handle'] ?? null;
                $targetItems[$makeKey($type, $handle)] = [
                    'resource_type' => $type,
                    'handle' => $handle,
                ];
            }

            $existingByKey = [];
            foreach ($lock->accessRules as $rule) {
                $existingByKey[$makeKey($rule->resource_type, $rule->handle)] = $rule;
            }

            // Remove rules that are no longer selected (drop metafield first;
            // a transient delete failure queues a background cleanup retry —
            // the row still goes so the save always commits).
            foreach ($existingByKey as $key => $rule) {
                if (!isset($targetItems[$key])) {
                    $deleteRes = $this->performMetafieldDelete($shop, $rule);
                    if (!($deleteRes['success'] ?? false) && ($deleteRes['code'] ?? '') !== 'not_found') {
                        Log::warning('[LockSync] failed to drop metafield for unselected rule — queueing cleanup retry', [
                            'rule_id' => $rule->id,
                            'handle' => $rule->handle,
                            'error' => $deleteRes['error'] ?? ($deleteRes['errors'] ?? 'unknown'),
                        ]);
                        \App\Jobs\RemoveRuleMetafieldJob::dispatch(
                            $shop->id, $rule->resource_type, $rule->handle, $rule->lock_id, [$rule->id]
                        )->delay(now()->addSeconds(30));
                    }
                    $rule->delete();
                }
            }

            // Create rules for newly selected items.
            foreach ($targetItems as $key => $item) {
                if (isset($existingByKey[$key])) {
                    continue;
                }
                \App\Models\AccessRule::create([
                    'shop_id' => $shop->id,
                    'lock_id' => $lock->id,
                    'resource_type' => $item['resource_type'],
                    'handle' => $item['handle'],
                    'enabled' => $isEnabled,
                    'prompt' => $commonPrompt,
                    'conditions' => $commonConditions,
                    'redirect_url' => $validated['redirect_url'] ?? null,
                    'settings' => [
                        'widget_json' => $widgetPayload,
                        'text_widget_json' => $textWidgetPayload,
                        'protect_products' => $validated['protect_products'] ?? false,
                        'hide_navigation' => $validated['hide_navigation'] ?? false,
                        'hide_lists' => $validated['hide_lists'] ?? false,
                        'hide_add_to_cart' => $validated['hide_add_to_cart'] ?? false,
                        'hide_completely' => $validated['hide_completely'] ?? false,
                        'scope' => !empty($variantByKey[$key]) ? 'variant' : 'product',
                        'variant_ids' => $variantByKey[$key] ?? [],
                        'locked_variant_display' => $validated['locked_variant_display'] ?? 'hide',
                        'all_variants_locked_behavior' => $validated['all_variants_locked_behavior'] ?? 'hide_product',
                    ],
                ]);
            }

            // Reload so the loops below see the new rule set.
            $lock->load('accessRules');
        }

        // 3. DB Updates
        $newName = $validated['name'] ?? $lock->name;
        $debugTrace['new_name_to_write'] = $newName;

        try {
            $updateResult = $lock->update([
                'name' => $newName,
                'status' => $isEnabled,
                'description' => $validated['prompt'] ?? $lock->description,
                'popup_text' => array_key_exists('popup_text', $validated)
                    ? (PopupTextOverrides::sanitize($validated['popup_text']) ?: null)
                    : $lock->popup_text,
                'reprompt' => $validated['reprompt'] ?? $lock->reprompt,
                'starts_at' => array_key_exists('starts_at', $validated) ? $validated['starts_at'] : $lock->starts_at,
                'expires_at' => array_key_exists('expires_at', $validated) ? $validated['expires_at'] : $lock->expires_at,
                'allow_email_request' => $validated['user_request_by_email'] ?? $lock->allow_email_request,
                'seo_block' => array_key_exists('seo_block', $validated) ? $validated['seo_block'] : $lock->seo_block,
                'widget_id' => $widgetId,
                'text_widget_id' => $textWidgetId,
            ]);
        } catch (\Throwable $e) {
            Log::error('[updateLock] DB UPDATE THREW', array_merge($debugTrace, [
                'error' => $e->getMessage(),
                'class' => get_class($e),
            ]));
            throw $e;
        }

        $debugTrace['update_result'] = $updateResult;
        // Re-fetch from DB completely fresh
        $freshLock = \App\Models\Lock::find($lock->id);
        $debugTrace['db_name_after_update'] = $freshLock ? $freshLock->name : '(lock not found)';

        foreach ($lock->accessRules as $rule) {
            // The storefront metafield is built from `settings` first (see
            // syncMetafield), so every updated value must land in settings
            // too — otherwise stale settings silently win over new columns.
            $settingsPatch = [
                'widget_json' => $widgetPayload,
                'text_widget_json' => $textWidgetPayload,
                'protect_products' => $validated['protect_products'] ?? ($rule->settings['protect_products'] ?? $rule->protect_products ?? false),
                'hide_navigation' => $validated['hide_navigation'] ?? ($rule->settings['hide_navigation'] ?? $rule->hide_navigation ?? false),
                'hide_lists' => $validated['hide_lists'] ?? ($rule->settings['hide_lists'] ?? $rule->hide_lists ?? false),
                'hide_add_to_cart' => $validated['hide_add_to_cart'] ?? ($rule->settings['hide_add_to_cart'] ?? false),
                'hide_completely' => $validated['hide_completely'] ?? ($rule->settings['hide_completely'] ?? false),
            ];

            $variantKey = $rule->resource_type . '|' . ($rule->handle ?? '');
            if (array_key_exists($variantKey, $variantByKey)) {
                $settingsPatch['variant_ids'] = $variantByKey[$variantKey];
                $settingsPatch['scope'] = !empty($variantByKey[$variantKey]) ? 'variant' : 'product';
            }
            if (!empty($validated['locked_variant_display'])) {
                $settingsPatch['locked_variant_display'] = $validated['locked_variant_display'];
            }
            if (!empty($validated['all_variants_locked_behavior'])) {
                $settingsPatch['all_variants_locked_behavior'] = $validated['all_variants_locked_behavior'];
            }

            $rule->update([
                'enabled' => $isEnabled,
                'prompt' => $validated['prompt'] ?? $rule->prompt,
                'conditions' => $validated['conditions'] ?? $rule->conditions,
                'redirect_url' => $validated['redirect_url'] ?? $rule->redirect_url,
                'protect_products' => $validated['protect_products'] ?? $rule->protect_products,
                'hide_navigation' => $validated['hide_navigation'] ?? $rule->hide_navigation,
                'hide_lists' => $validated['hide_lists'] ?? $rule->hide_lists,
                'force_open' => $validated['force_open'] ?? $rule->force_open,
                'settings' => array_merge($rule->settings ?? [], $settingsPatch),
            ]);
        }

        // 4. Storefront sync from fresh DB state — the same rich write path
        // the create flow uses (simple_passcodes, requires_input, variant
        // scope, redirect_url all included; the old inline rebuild dropped
        // them, so every edit degraded a working lock's metafield).
        $lock->load('accessRules');
        $this->syncMetafieldsWithRetry($shop, $lock);

        // Update Global Metafield to reflect changes
        $this->updateGlobalMetafield($shop);

        return to_route('locks.index')->with('success', 'Lock updated successfully');
    }

    public function destroy(Lock $lock)
    {
        if ($lock->shop_id !== Auth::id())
            abort(403);

        $shop = Auth::user();

        // Capture details before the lock and its rules are removed.
        $lockName = $lock->name;
        $itemCount = $lock->accessRules->count();

        // 1. Best-effort metafield cleanup. Deletion must ALWAYS work — a lock
        // whose product no longer exists on Shopify ("not found") used to be
        // impossible to delete. A transient failure queues a background
        // cleanup retry, because the storefront reads the per-resource
        // metafield FIRST: a lingering entry would keep enforcing a lock the
        // admin no longer shows.
        foreach ($lock->accessRules as $rule) {
            try {
                $res = $this->performMetafieldDelete($shop, $rule);
                if (!($res['success'] ?? false) && ($res['code'] ?? '') !== 'not_found') {
                    Log::warning('destroy: metafield cleanup failed — queueing cleanup retry', [
                        'lock_id' => $lock->id,
                        'rule_id' => $rule->id,
                        'handle' => $rule->handle,
                        'error' => $res['error'] ?? ($res['errors'] ?? 'unknown'),
                    ]);
                    \App\Jobs\RemoveRuleMetafieldJob::dispatch(
                        $shop->id, $rule->resource_type, $rule->handle, $rule->lock_id, [$rule->id]
                    )->delay(now()->addSeconds(30));
                }
            } catch (\Throwable $e) {
                Log::warning('destroy: metafield cleanup threw — queueing cleanup retry', [
                    'lock_id' => $lock->id,
                    'rule_id' => $rule->id,
                    'error' => $e->getMessage(),
                ]);
                \App\Jobs\RemoveRuleMetafieldJob::dispatch(
                    $shop->id, $rule->resource_type, $rule->handle, $rule->lock_id, [$rule->id]
                )->delay(now()->addSeconds(30));
            }
        }

        try {
            \Illuminate\Support\Facades\DB::transaction(function () use ($lock) {
                foreach ($lock->accessRules as $rule) {
                    $rule->delete();
                }
                $lock->delete();
            });

            // Update Global Metafield ??
            // The original logic called updateGlobalMetafield at the end.
            $this->updateGlobalMetafield($shop);

            app(\App\Services\MailService::class)->lockDeleted($shop, $lockName, $itemCount);

            return to_route('locks.index')->with('success', 'Lock deleted successfully');
        } catch (\Exception $e) {
            Log::error('Failed to delete lock', ['error' => $e->getMessage(), 'lock_id' => $lock->id]);
            return to_route('locks.index')->with('error', 'Failed to delete lock');
        }
    }

    // Public helper for other controllers (e.g. DashboardController)
    public function pushRuleToMetafield($shop, $rule, $widgetPayload = null)
    {
        // Same canonical payload as every other write path — a hand-rolled
        // variant here used to omit variant scope, redirect_url, seo_block,
        // hide_completely etc., so a dashboard status toggle degraded the
        // storefront metafield the same way the old edit path did.
        $metafieldData = $this->buildRuleMetafieldData($rule);

        if ($widgetPayload) {
            $metafieldData['widget'] = $widgetPayload;
        }

        return $this->performMetafieldWriteInternal($shop, $rule, $metafieldData);
    }

    public function deleteRuleMetafield($shop, $rule)
    {
        // Single removal path — this used to be a near-copy that silently
        // returned success for checkout rules WITHOUT touching the shop's
        // checkout_rule metafield, so a deactivated/deleted checkout lock
        // kept hard-blocking checkout forever.
        return $this->performMetafieldDelete($shop, $rule);
    }

    // Internal helper with core write logic
    private function performMetafieldWriteInternal($shop, $rule, $data)
    {
        try {
            $resourceType = $rule->resource_type;
            $handle = $rule->handle;

            // Map resource type to model class
            $modelClass = null;
            $idField = null;
            $apiResourceName = null;

            if ($resourceType === 'collection') {
                $modelClass = \App\Models\Collection::class;
                $idField = 'shopify_collection_id';
                $apiResourceName = 'collections';
            } elseif ($resourceType === 'product') {
                $modelClass = \App\Models\Product::class;
                $idField = 'shopify_product_id';
                $apiResourceName = 'products';
            } elseif ($resourceType === 'page') {
                $modelClass = \App\Models\Page::class;
                $idField = 'shopify_page_id';
                $apiResourceName = 'pages';
            } elseif ($resourceType === 'blog') {
                $modelClass = \App\Models\Blog::class;
                $idField = 'shopify_blog_id';
                $apiResourceName = 'blogs';
            } elseif ($resourceType === 'shop' || $resourceType === 'checkout') {
                $modelClass = \App\Models\Store::class;
                $idField = 'shopify_store_id';
                $apiResourceName = 'shops';
            } elseif ($resourceType === 'theme' || $resourceType === 'variant') {
                // No per-resource storefront metafield for these types.
                return ['success' => true];
            } else {
                return ['success' => false, 'error' => 'Unsupported resource type'];
            }

            if ($resourceType === 'shop' || $resourceType === 'checkout') {
                $resource = $modelClass::where('shop_id', $shop->id)->first();
            } else {
                $resource = $modelClass::where('shop_id', $shop->id)->where('handle', $handle)->first();
            }

            if ($resource && $resource->$idField) {
                $numericId = preg_replace('/[^0-9]/', '', $resource->$idField);
            } else {
                // Local cache miss (sync lag, renamed handle) — resolve live
                // from Shopify instead of failing the write.
                $gid = in_array($resourceType, ['shop', 'checkout'], true)
                    ? null
                    : $this->resolveResourceGidByHandle($shop, $resourceType, $handle);
                if (!$gid) {
                    return ['success' => false, 'error' => 'Resource not found', 'code' => 'not_found'];
                }
                $numericId = preg_replace('/[^0-9]/', '', $gid);
            }

            $metafieldService = new MetafieldService();
            $resourceGid = $metafieldService->buildResourceGid($apiResourceName, $numericId);

            // Get lock_id from the rule's lock relationship
            $lockId = $rule->lock_id;

            // Add lock_id to data if not present
            if (!isset($data['lock_id'])) {
                $data['lock_id'] = $lockId;
            }

            // Use array-based metafield update to prevent overwrites
            $result = $metafieldService->updateMetafieldArray(
                $shop,
                $resourceGid,
                'access_control',
                $resourceType === 'checkout' ? 'checkout_rule' : 'access_rule',
                $lockId,
                $data
            );

            return $result;
        } catch (\Exception $e) {
            Log::error('Failed to write metafield', [
                'error' => $e->getMessage(),
                'rule_id' => $rule->id ?? null
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }


    private function performMetafieldDelete($shop, $rule)
    {
        return $this->removeLockFromResourceMetafield(
            $shop,
            $rule->resource_type,
            $rule->handle,
            $rule->lock_id,
            [$rule->id]
        );
    }

    /**
     * Remove one lock's entry from a resource's storefront metafield by raw
     * identifiers — usable after the AccessRule row is already deleted (the
     * queued cleanup retry depends on that).
     *
     * Returns ['success' => bool, 'code' => 'not_found'|null, ...]. The
     * 'not_found' code means the resource no longer exists on Shopify, so
     * there is nothing left to clean up (callers treat it as done).
     */
    public function removeLockFromResourceMetafield($shop, string $resourceType, ?string $handle, $lockId, array $ruleIds)
    {
        try {
            if ($resourceType === 'theme' || $resourceType === 'variant') {
                // No per-resource storefront metafield for these types.
                return ['success' => true];
            }

            $metafieldService = new MetafieldService();

            if ($resourceType === 'shop' || $resourceType === 'checkout') {
                $store = \App\Models\Store::where('shop_id', $shop->id)->first();
                if (!$store || !$store->shopify_store_id) {
                    return ['success' => false, 'error' => 'Resource not found', 'code' => 'not_found'];
                }
                $numericId = preg_replace('/[^0-9]/', '', $store->shopify_store_id);
            } else {
                $numericId = $this->resolveNumericResourceId($shop, $resourceType, $handle);
                if (!$numericId) {
                    return ['success' => false, 'error' => 'Resource not found', 'code' => 'not_found'];
                }
            }

            $apiResourceName = ($resourceType === 'shop' || $resourceType === 'checkout') ? 'shops' : $resourceType . 's';
            $resourceGid = $metafieldService->buildResourceGid($apiResourceName, $numericId);

            // Use array-based removal to only remove this lock's data
            return $metafieldService->removeFromMetafieldArray(
                $shop,
                $resourceGid,
                'access_control',
                $resourceType === 'checkout' ? 'checkout_rule' : 'access_rule',
                $lockId,
                $ruleIds
            );
        } catch (\Exception $e) {
            Log::error('Failed to delete metafield', [
                'error' => $e->getMessage(),
                'resource_type' => $resourceType,
                'handle' => $handle,
                'lock_id' => $lockId,
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function removeMetafield($shop, $rule)
    {
        return $this->performMetafieldDelete($shop, $rule);
    }

    public function newConfigureLock(\Illuminate\Http\Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'description' => 'nullable|string',
            'selectedItems' => 'required|array|min:1',
            'selectedItems.*.handle' => 'nullable',
            'selectedItems.*.resource_type' => 'required|in:collection,product,page,blog,theme,variant',
            'status' => 'string',
            'rules' => 'nullable|array',
            'user_request_by_email' => 'boolean',
        ]);

        $shop = Auth::user();

        // Plan enforcement — same gates as storeLock (always a new lock here).
        $violations = app(\App\Services\BillingService::class)
            ->lockViolations($shop, $validated, true);
        if (! empty($violations)) {
            return back()->withErrors(['plan' => implode(' ', $violations)]);
        }

        // Create the lock
        $lock = \App\Models\Lock::create([
            'shop_id' => $shop->id,
            'type' => 'mixed',
            'handle' => 'lock_' . uniqid(),
            'status' => $validated['status'] === 'Active',
            'name' => $validated['name'],
            'description' => $validated['description'] ?? '',
            'allow_email_request' => $request->boolean('user_request_by_email'),
        ]);

        // Create access rules for selected items
        foreach ($validated['selectedItems'] as $item) {
            $resourceType = $item['resource_type'];
            $handle = $item['handle'];

            // Skip if handle is missing (unless it's a theme with ID as handle logic, handled in frontend primarily)
            if (!$handle && $resourceType !== 'theme') {
                continue;
            }
            if ($resourceType === 'theme' && !$handle) {
                // Fallback for theme if needed, though validation might catch it or frontend sends ID
            }

            $rule = \App\Models\AccessRule::create([
                'shop_id' => $shop->id,
                'lock_id' => $lock->id,
                'resource_type' => $resourceType,
                'handle' => $handle,
                'enabled' => $lock->status,  // Initial sync with lock
                'prompt' => $lock->description,
                'conditions' => $validated['rules'] ?? null,
            ]);

            // Sync Metafields immediately
            if ($resourceType === 'collection') {
                $this->updateCollectionMetafield($shop, $rule);
            } elseif ($resourceType === 'product') {
                $this->updateProductMetafield($shop, $rule);
            } elseif ($resourceType === 'page') {
                $this->updatePageMetafield($shop, $rule);
            } elseif ($resourceType === 'blog') {
                $this->updateBlogMetafield($shop, $rule);
            }
        }

        // Update Global Metafield
        $this->updateGlobalMetafield($shop);

        return to_route('locks.configure', ['lock' => $lock->id]);
    }

    public function lock()
    {
        $shop = Auth::user();

        $products = [];
        $collections = [];
        $tags = [];
        $pages = [];
        $blogs = [];
        $themes = [];

        // --- PRODUCTS ---
        $first = 200;
        $after = null;
        $hasNext = true;

        $productQuery = <<<'GQL'
            query GetProducts($first:Int!, $after:String) {
                products(first: $first, after: $after) {
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                    nodes {
                        id
                        title
                        tags
                        vendor
                        productType
                        handle
                        variants(first: 100) {
                            nodes { id title }
                        }
                        media(first: 1) {
                            edges {
                                node {
                                    id
                                    ...on MediaImage {
                                        image {
                                            url
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            GQL;

        do {
            $variables = ['first' => $first, 'after' => $after];
            $response = $shop->api()->graph($productQuery, $variables);
            // dd($response);
            $data = $response['body']['data']['products'];
            // Normalize the SDK's nested ResponseAccess objects to plain arrays so
            // the variant persistence below (which uses is_array) works. Without
            // this, variants are silently skipped ("Found 0 variants").
            $data = json_decode(json_encode($data), true);
            // dd($data);
            foreach ($data['nodes'] as $p) {
                $products[] = $p;
                foreach ($p['tags'] as $tag) {
                    $tags[$tag] = true;
                }

                // Store product in database
                Product::updateOrCreate(
                    [
                        'shop_id' => $shop->id,
                        'shopify_product_id' => $p['id'],
                    ],
                    [
                        'title' => $p['title'],
                        'vendor' => $p['vendor'] ?? null,
                        'product_type' => $p['productType'] ?? null,
                        'image_url' => $p['media']['edges'][0]['node']['image']['url'] ?? null,
                        'tags' => $p['tags'] ? json_encode($p['tags']) : null,
                        'category' => $p['category']['name'] ?? null,
                        'handle' => $p['handle'] ?? null,
                    ]
                );

                // Sync this product's variants so the per-product variant picker
                // has data. The manual sync previously only persisted products,
                // which left the variants table empty and the picker hidden.
                // Mirrors SyncProductsJob's persistence; that install-time job
                // paginates variants fully, here first:100 covers the common case.
                foreach (($p['variants']['nodes'] ?? []) as $variant) {
                    if (!is_array($variant) || !isset($variant['id'])) {
                        continue;
                    }
                    Variant::updateOrCreate(
                        [
                            'shop_id' => $shop->id,
                            'variant_id' => $variant['id'],
                        ],
                        [
                            'shopify_product_id' => $p['id'],
                            'title' => $variant['title'] ?? '',
                        ]
                    );
                }
            }

            $after = $data['pageInfo']['endCursor'];
            $hasNext = $data['pageInfo']['hasNextPage'];
        } while ($hasNext);

        $uniqueTagNames = array_keys($tags);

        // --- COLLECTIONS ---
        $collFirst = 200;
        $collAfter = null;
        $collNext = true;

        $collectionQuery = <<<'GQL'
            query GetCollections($first:Int!, $after:String) {
                collections(first: $first, after: $after) {
                    pageInfo { hasNextPage endCursor }
                    nodes {
                        id
                        title
                        handle
                        productsCount { count }
                    }
                }
            }
            GQL;

        do {
            $variables = ['first' => $collFirst, 'after' => $collAfter];
            $response = $shop->api()->graph($collectionQuery, $variables);
            $data = $response['body']['data']['collections'];

            foreach ($data['nodes'] as $c) {
                $collections[] = $c;

                // Store collection in database
                Collection::updateOrCreate(
                    [
                        'shop_id' => $shop->id,
                        'shopify_collection_id' => $c['id'],
                    ],
                    [
                        'title' => $c['title'],
                        'handle' => $c['handle'] ?? null,
                        'products_count' => $c['productsCount']['count'] ?? 0,
                    ]
                );
            }

            $collAfter = $data['pageInfo']['endCursor'];
            $collNext = $data['pageInfo']['hasNextPage'];
        } while ($collNext);

        // --- PAGES ---
        $pageFirst = 200;
        $pageAfter = null;
        $pageNext = true;

        $pageQuery = <<<'GQL'
            query GetPages($first:Int!, $after:String) {
                pages(first: $first, after: $after) {
                    pageInfo { hasNextPage endCursor }
                    nodes {
                        id
                        title
                        handle
                    }
                }
            }
            GQL;

        do {
            $variables = ['first' => $pageFirst, 'after' => $pageAfter];
            $response = $shop->api()->graph($pageQuery, $variables);
            $data = $response['body']['data']['pages'];

            foreach ($data['nodes'] as $p) {
                $pages[] = $p;

                // Store page in database
                Page::updateOrCreate(
                    [
                        'shop_id' => $shop->id,
                        'shopify_page_id' => $p['id'],
                    ],
                    [
                        'title' => $p['title'],
                        'handle' => $p['handle'] ?? null,
                    ]
                );
            }

            $pageAfter = $data['pageInfo']['endCursor'];
            $pageNext = $data['pageInfo']['hasNextPage'];
        } while ($pageNext);

        // --- BLOGS ---
        $blogFirst = 200;
        $blogAfter = null;
        $blogNext = true;

        $blogQuery = <<<'GQL'
            query GetBlogs($first:Int!, $after:String) {
                blogs(first: $first, after: $after) {
                    pageInfo { hasNextPage endCursor }
                    nodes {
                        id
                        title
                        handle
                    }
                }
            }
            GQL;

        do {
            $variables = ['first' => $blogFirst, 'after' => $blogAfter];
            $response = $shop->api()->graph($blogQuery, $variables);
            $data = $response['body']['data']['blogs'];

            foreach ($data['nodes'] as $b) {
                $blogs[] = $b;

                // Store blog in database
                Blog::updateOrCreate(
                    [
                        'shop_id' => $shop->id,
                        'shopify_blog_id' => $b['id'],
                    ],
                    [
                        'title' => $b['title'],
                        'handle' => $b['handle'] ?? null,
                    ]
                );
            }

            $blogAfter = $data['pageInfo']['endCursor'];
            $blogNext = $data['pageInfo']['hasNextPage'];
        } while ($blogNext);

        // --- THEMES ---
        // --- THEMES ---
        $themeFirst = 50;
        $themeAfter = null;
        $themeNext = true;

        $themeQuery = <<<'GQL'
            query GetThemes($first: Int!, $after: String) {
                themes(first: $first, after: $after) {
                    pageInfo { hasNextPage endCursor }
                    edges {
                        node {
                            id
                            name
                            role
                            createdAt
                            updatedAt
                        }
                    }
                }
            }
            GQL;

        do {
            $variables = ['first' => $themeFirst, 'after' => $themeAfter];
            $response = $shop->api()->graph($themeQuery, $variables);
            $data = $response['body']['data']['themes'];

            foreach ($data['edges'] as $t) {
                $themes[] = $t['node'];

                Theme::updateOrCreate(
                    [
                        'shop_id' => $shop->id,
                        'shopify_theme_id' => $t['node']['id'],
                    ],
                    [
                        'name' => $t['node']['name'],
                        'role' => $t['node']['role'],
                    ]
                );
            }

            $themeAfter = $data['pageInfo']['endCursor'];
            $themeNext = $data['pageInfo']['hasNextPage'];
        } while ($themeNext);
        // dd($themes);
        // Return success message instead of dd()
        return response()->json([
            'message' => 'Data synced successfully',
            'stats' => [
                'products' => count($products),
                'collections' => count($collections),
                'pages' => count($pages),
                'blogs' => count($blogs),
                'unique_tags' => count($uniqueTagNames),
                'themes' => count($themes),
            ],
        ]);
    }

    public function debugMetafield($handle)
    {
        $shop = Auth::user();
        $collection = Collection::where('shop_id', $shop->id)
            ->where('handle', $handle)
            ->first();

        if (!$collection) {
            return response()->json(['error' => 'Collection not found in DB']);
        }

        // Extract numeric ID
        $collectionId = preg_replace('/[^0-9]/', '', $collection->shopify_collection_id);

        $metafieldService = new MetafieldService();
        $resourceGid = $metafieldService->buildResourceGid('collections', $collectionId);

        // TEST WRITE PROBE
        $writeResult = [];
        try {
            $writeResult = $metafieldService->setMetafield(
                $shop,
                $resourceGid,
                'access_control',
                'debug_probe',
                'test_' . time(),
                'single_line_text_field'
            );
        } catch (\Exception $e) {
            $writeResult = [
                'exception' => $e->getMessage(),
                'trace' => substr($e->getTraceAsString(), 0, 500)
            ];
        }

        // READ PROBE using GraphQL
        $readResult = $metafieldService->getMetafields(
            $shop,
            $resourceGid,
            'access_control'
        );

        return response()->json([
            'collection_id_used' => $collectionId,
            'write_probe' => $writeResult,
            'read_result' => $readResult['metafields'] ?? [],
        ]);
    }

    /**
     * Update the Global Metafield with ALL active locks and widgets.
     */
    public function updateGlobalMetafield($shop)
    {
        try {
            // 1. Fetch Store ID (Shopify numeric ID)
            $store = Store::where('shop_id', $shop->id)->first();
            $numericId = null;

            if ($store && $store->shopify_store_id) {
                $numericId = preg_replace('/[^0-9]/', '', $store->shopify_store_id);
            } else {
                // Fallback: Query GraphQL
                $query = '{ shop { id } }';
                $response = $shop->api()->graph($query);
                $gid = $response['body']['data']['shop']['id'] ?? null;
                if ($gid) {
                    $numericId = preg_replace('/[^0-9]/', '', $gid);
                }
            }

            if (!$numericId) {
                Log::warning('Could not find Shop ID for global metafield update.');
                return;
            }

            $lockList = $this->buildGlobalLockList($shop);

            Log::info('Global Metafield Sync: Generated ' . count($lockList) . ' rules.');

            // 3. Save to Global Metafield
            $metafieldService = new MetafieldService();
            $resourceGid = $metafieldService->buildResourceGid('shops', $numericId);

            $result = $metafieldService->setMetafield(
                $shop,
                $resourceGid,
                'access_lock',
                'global_config',
                ['locks' => $lockList]
            );

            Log::info('Global Metafield Sync: Result', ['success' => $result['success'] ?? false]);

            if (!$result['success']) {
                Log::error('Global Metafield Sync: Failed', ['error' => $result['error'] ?? 'Unknown error']);
            }

            // 4. Prune Shop Metafield (Local Rule)
            $this->pruneShopMetafield($shop);
        } catch (\Exception $e) {
            Log::error('Failed to update global metafield', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
    }

    /**
     * The shop-wide lock list — written to the access_lock.global_config
     * metafield and served live by the app-proxy /rules endpoint.
     */
    public function buildGlobalLockList($shop): array
    {
        // Fetch all active locks with enabled rules and widgets
        $locks = Lock::where('shop_id', $shop->id)
            ->where('status', true)
            ->with(['accessRules', 'widget'])
            ->get();

        $lockList = [];

        foreach ($locks as $lock) {
            // A lock with no custom widget is valid — "Using default design"
            // is a first-class UI state, and the storefront renders its own
            // default lock UI when `widget` is null (access_core falls back to
            // `lock.widget || ... || null`, access_ui to the default design).
            // We used to `continue` here, which silently dropped every
            // default-widget lock from the metafield so it enforced NOTHING —
            // the root cause of "the lock doesn't apply" across stores.
            $widgetConfig = null;
            if ($lock->widget && $lock->widget->configuration) {
                $widgetConfig = [
                    'id' => $lock->widget->id,
                    'type' => $lock->widget->type,
                    'name' => $lock->widget->name,
                    'settings' => $lock->widget->configuration,
                ];
            }

            foreach ($lock->accessRules as $rule) {
                // Only include enabled rules
                if (!$rule->enabled) {
                    continue;
                }

                $lockList[] = [
                    'lock_id' => $lock->id,
                    // The storefront's grant cache is keyed by rule_id (metafield
                    // entries carry no lock_id), so the site-wide pass needs it to
                    // recognise an unlock earned on the resource's own page.
                    'rule_id' => $rule->id,
                    'target_type' => $rule->resource_type,
                    'target_handle' => $rule->handle,
                    // Schedule — storefront reads these to self-expire the lock.
                    'starts_at' => $lock->starts_at ? $lock->starts_at->toIso8601String() : null,
                    'expires_at' => $lock->expires_at ? $lock->expires_at->toIso8601String() : null,
                    'lock_settings' => [
                        'name' => $lock->name,
                        'prompt' => $rule->prompt ?? $lock->description,
                        'conditions' => $rule->conditions,
                        'hide_price' => $rule->hide_price ?? false,
                        'price_message' => $rule->price_message,
                        'force_open' => $rule->force_open ?? false,
                        'redirect_url' => $rule->redirect_url ?? $lock->redirect_url,
                        'allow_email_request' => $lock->allow_email_request ?? false,
                        'requires_input' => $this->requiresInput($rule->conditions ?? []),
                        'reprompt' => $lock->reprompt ?? 'remember',
                        // Drive the site-wide "strip locked items from grids/search/menus" pass.
                        'hide_completely' => $rule->settings['hide_completely'] ?? false,
                        'hide_lists' => $rule->settings['hide_lists'] ?? $rule->hide_lists ?? false,
                        'hide_navigation' => $rule->settings['hide_navigation'] ?? $rule->hide_navigation ?? false,
                        'protect_products' => $rule->settings['protect_products'] ?? $rule->protect_products ?? false,
                        // Drives the site-wide "hide quick-add on cards of locked
                        // products" pass — without this flag the storefront can
                        // only hide the button on the product's own page, leaving
                        // homepage/collection/search cards fully purchasable.
                        'hide_add_to_cart' => $rule->settings['hide_add_to_cart'] ?? $rule->hide_add_to_cart ?? false,
                    ],
                    'widget' => $widgetConfig,
                ];
            }
        }

        return $lockList;
    }

    /**
     * Prune the Shop-level local metafield to remove stale or deleted locks.
     */
    private function pruneShopMetafield($shop)
    {
        try {
            $store = Store::where('shop_id', $shop->id)->first();
            $numericId = $store ? preg_replace('/[^0-9]/', '', $store->shopify_store_id) : null;
            if (!$numericId)
                return;

            $metafieldService = new MetafieldService();
            $resourceGid = $metafieldService->buildResourceGid('shops', $numericId);

            $current = $metafieldService->getMetafieldValue($shop, $resourceGid, 'access_control', 'access_rule');
            if (!$current['success'] || !$current['exists'])
                return;

            $currentLocks = $current['value']['locks'] ?? [];
            if (empty($currentLocks))
                return;

            $activeLockIds = Lock::where('shop_id', $shop->id)->where('status', true)->pluck('id')->toArray();

            $validLocks = [];
            $changed = false;

            foreach ($currentLocks as $l) {
                $id = $l['lock_id'] ?? $l['rule_id'] ?? null;
                if ($id && in_array((int) $id, $activeLockIds)) {
                    // Check if it still targets the shop
                    $rule = \App\Models\AccessRule::where('lock_id', $id)
                        ->where('resource_type', 'shop')
                        ->first();

                    if ($rule && $rule->enabled) {
                        $validLocks[] = $l;
                    } else {
                        $changed = true;
                    }
                } else {
                    $changed = true;
                }
            }

            if ($changed) {
                if (empty($validLocks)) {
                    $metafieldService->deleteMetafield($shop, $resourceGid, 'access_control', 'access_rule');
                } else {
                    $metafieldService->setMetafield($shop, $resourceGid, 'access_control', 'access_rule', ['locks' => $validLocks]);
                }
            }
        } catch (\Exception $e) {
            Log::error('Failed to prune shop metafield', ['error' => $e->getMessage()]);
        }
    }
}
