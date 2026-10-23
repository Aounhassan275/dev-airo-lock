<?php

namespace App\Http\Controllers;

use App\Models\AccessRule;
use App\Models\Blog;
use App\Models\Collection;
use App\Models\Lock;
use App\Models\Onboarding;
use App\Models\Page;
use App\Models\Product;
use App\Models\Store;
use App\Models\Theme;
use App\Models\Widget;
use App\Services\ShopLocaleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class OnboardingController extends Controller
{
    /**
     * The welcome screen and the setup stepper.
     *
     * Setup builds a real first lock, so it needs exactly what the lock
     * builder (AccessLockcontroller@create) is given: the picker catalogues,
     * the widget designs and the store's languages.
     *
     * Onboarding is shown once, on install: a store that has finished it is
     * sent to the dashboard. The one exception is the visit straight after
     * the first lock is saved, which the onboard middleware flashes so the
     * flow can show its result screen.
     *
     * NOTE (free period): plan / trial data is not sent; the app is free with
     * unlimited locks, and plan limits are enforced server-side on save anyway.
     */
    public function index(Request $request)
    {
        $shop = Auth::user();

        $done = Onboarding::where('user_id', $shop->id)->value('status') === 1;
        if ($done && ! $request->session()->get('onboarding_result')) {
            return redirect()->route('home', $request->query());
        }

        try {
            $shopLocales = app(ShopLocaleService::class)->get($shop);
        } catch (\Throwable $e) {
            $shopLocales = ['locales' => [], 'primary' => ''];
        }

        return Inertia::render('Onboarding', array_merge($this->builderData($shop), [
            'storeLocales' => $shopLocales['locales'] ?? [],
            'primaryLocale' => $shopLocales['primary'] ?? '',
            // The newest lock's id. After "Create my lock" the page comes back
            // with this changed, which is how the flow finds the lock it made
            // (for Quick view) without the save endpoint having to say.
            'latestLockId' => Lock::where('shop_id', $shop->id)->max('id'),
        ]));
    }

    /**
     * The same picker / widget data AccessLockcontroller@create hands the lock
     * builder, with the same dedupe-by-handle rule (freshest row wins).
     */
    private function builderData($shop): array
    {
        $dedupe = function (string $modelClass, array $columns, string $gidColumn) use ($shop) {
            return $modelClass::where('shop_id', $shop->id)
                ->select(array_merge($columns, ['updated_at']))
                ->orderByDesc('updated_at')
                ->get()
                ->unique(fn ($r) => $r->handle ?: $r->$gidColumn)
                ->values()
                ->makeHidden('updated_at');
        };

        return [
            'store' => Store::where('shop_id', $shop->id)->first(),
            'products' => $dedupe(Product::class, ['id', 'shopify_product_id', 'title', 'vendor', 'product_type', 'tags', 'category', 'image_url', 'handle'], 'shopify_product_id'),
            'collections' => $dedupe(Collection::class, ['id', 'shopify_collection_id', 'title', 'handle', 'products_count'], 'shopify_collection_id'),
            'pages' => $dedupe(Page::class, ['id', 'shopify_page_id', 'title', 'handle'], 'shopify_page_id'),
            'blogs' => $dedupe(Blog::class, ['id', 'shopify_blog_id', 'title', 'handle'], 'shopify_blog_id'),
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
            'lockedItems' => AccessRule::where('access_rules.shop_id', $shop->id)
                ->join('locks', 'locks.id', '=', 'access_rules.lock_id')
                ->select(['access_rules.resource_type', 'access_rules.handle', 'access_rules.lock_id', 'locks.name as lock_name', 'locks.status as lock_active'])
                ->get(),
        ];
    }

    public function complete(Request $request)
    {
        $user = Auth::user();

        // Find or create onboarding record and mark as completed
        $onboarding = Onboarding::firstOrCreate(
            ['user_id' => $user->id],
            ['status' => 0]
        );

        $onboarding->markAsCompleted();

        // Where the merchant asked to go next (the lock list, or the lock they
        // just made). Only an app-relative path is honoured — never another
        // host — and the embedded-app query string travels with it.
        $next = (string) $request->input('next', '');
        $query = $request->query();
        unset($query['next']);

        if ($next !== '' && preg_match('#^/(?!/)[A-Za-z0-9/_-]*$#', $next)) {
            $qs = http_build_query($query);

            return redirect()->to($next . ($qs !== '' ? '?' . $qs : ''));
        }

        return redirect()->route('home', $query);
    }
}
