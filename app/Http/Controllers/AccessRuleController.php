<?php

namespace App\Http\Controllers;

use App\Models\AccessRule;
use App\Models\Collection;
use App\Services\MetafieldService;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Support\Facades\Log;

class AccessRuleController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request)
    {
        $shop = Auth::user();
        $resourceType = $request->query('resource_type', 'collection');
        $handle = $request->query('handle', 'all');

        $query = AccessRule::where('shop_id', $shop->id)
            ->where('resource_type', $resourceType);

        if ($handle !== 'all') {
            $query->where('handle', $handle);
        }

        $rules = $query->latest()->get();

        return Inertia::render('Dashboard', [
            'accessRules' => $rules,
            'filters' => [
                'resourceType' => $resourceType,
                'handle' => $handle,
            ]
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'handle' => 'required|string',
            'resource_type' => 'required|in:collection,product,page,blog',
            'conditions' => 'nullable|array',
            'prompt' => 'nullable|string',
            'redirect_url' => 'nullable|url',
            'enabled' => 'boolean',
            'protect_products' => 'boolean',
            'hide_navigation' => 'boolean',
            'hide_lists' => 'boolean',
            'force_open' => 'boolean',
        ]);

        $shop = Auth::user();

        // Plan enforcement: standalone rules consume lock quota (when new)
        // and their conditions are feature-gated like lock conditions.
        $isNew = ! AccessRule::where('shop_id', $shop->id)
            ->where('resource_type', $validated['resource_type'])
            ->where('handle', $validated['handle'])
            ->exists();
        $violations = app(\App\Services\BillingService::class)
            ->ruleViolations($shop, $validated['conditions'] ?? [], $isNew);
        if (! empty($violations)) {
            return back()->withErrors(['plan' => implode(' ', $violations)]);
        }

        $rule = AccessRule::updateOrCreate(
            [
                'shop_id' => $shop->id,
                'resource_type' => $validated['resource_type'],
                'handle' => $validated['handle'],
            ],
            $validated
        );

        // SYNC METAFIELD
        $resourceType = $validated['resource_type'];

        if ($resourceType === 'collection') {
            $this->updateCollectionMetafield($shop, $rule);
        } elseif ($resourceType === 'product') {
            $this->updateProductMetafield($shop, $rule);
        } elseif ($resourceType === 'page') {
            $this->updatePageMetafield($shop, $rule);
        } elseif ($resourceType === 'blog') {
            $this->updateBlogMetafield($shop, $rule);
        }

        return redirect()->back()->with('success', 'Access rule saved successfully!');
    }

    public function update(Request $request, AccessRule $accessRule)
    {
        if ($accessRule->shop_id !== Auth::id()) {
            abort(403);
        }

        $validated = $request->validate([
            'conditions' => 'nullable|array',
            'prompt' => 'nullable|string',
            'redirect_url' => 'nullable|url',
            'enabled' => 'boolean',
            'protect_products' => 'boolean',
            'hide_navigation' => 'boolean',
            'hide_lists' => 'boolean',
            'force_open' => 'boolean',
        ]);

        // Plan enforcement: rewriting conditions is gated the same as
        // creating them (updates never fail the count check).
        $violations = app(\App\Services\BillingService::class)
            ->ruleViolations(Auth::user(), $validated['conditions'] ?? [], false);
        if (! empty($violations)) {
            return back()->withErrors(['plan' => implode(' ', $violations)]);
        }

        $accessRule->update($validated);

        // SYNC METAFIELD
        $shop = Auth::user();
        $resourceType = $accessRule->resource_type;

        if ($resourceType === 'collection') {
            $this->updateCollectionMetafield($shop, $accessRule);
        } elseif ($resourceType === 'product') {
            $this->updateProductMetafield($shop, $accessRule);
        } elseif ($resourceType === 'page') {
            $this->updatePageMetafield($shop, $accessRule);
        } elseif ($resourceType === 'blog') {
            $this->updateBlogMetafield($shop, $accessRule);
        }

        return to_route('locks.index')->with('success', 'Access rule updated successfully!');
    }

    public function destroy(AccessRule $accessRule)
    {
        if ($accessRule->shop_id !== Auth::id()) {
            abort(403);
        }

        // Remove metafield
        $shop = Auth::user();
        $this->removeMetafield($shop, $accessRule);

        $accessRule->delete();

        return to_route('locks.index')->with('success', 'Access rule deleted successfully!');
    }

    // --- METAFIELD HELPERS ---

    private function updateCollectionMetafield($shop, $rule)
    {
        $this->syncMetafieldForResource($shop, $rule, \App\Models\Collection::class, 'shopify_collection_id', 'collections');
    }

    private function updateProductMetafield($shop, $rule)
    {
        $this->syncMetafieldForResource($shop, $rule, \App\Models\Product::class, 'shopify_product_id', 'products');
    }

    private function updatePageMetafield($shop, $rule)
    {
        $this->syncMetafieldForResource($shop, $rule, \App\Models\Page::class, 'shopify_page_id', 'pages');
    }

    private function updateBlogMetafield($shop, $rule)
    {
        $this->syncMetafieldForResource($shop, $rule, \App\Models\Blog::class, 'shopify_blog_id', 'blogs');
    }

    private function syncMetafieldForResource($shop, $rule, $modelClass, $idField, $resourceApiName)
    {
        try {
            $resource = $modelClass::where('shop_id', $shop->id)
                ->where('handle', $rule->handle)
                ->first();

            if (!$resource || !$resource->$idField) {
                Log::warning(class_basename($modelClass) . ' not found for metafield update', [
                    'handle'  => $rule->handle,
                    'shop_id' => $shop->id
                ]);
                return;
            }

            $numericId = preg_replace('/[^0-9]/', '', $resource->$idField);
            $this->syncMetafield($shop, $rule, $resourceApiName, $numericId);
        } catch (\Exception $e) {
            Log::error('Failed to update ' . $resourceApiName . ' metafield', [
                'error'   => $e->getMessage(),
                'rule_id' => $rule->id
            ]);
        }
    }

    private function syncMetafield($shop, $rule, $resourceName, $resourceId)
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

        $metafieldData = [
            'rule_id'                => $rule->id,
            'enabled'                => (bool)$rule->enabled,
            'prompt'                 => $rule->prompt ?? 'Access restricted. Please enter credentials.',
            'conditions'             => $rule->conditions ?? [], // Full condition structure for frontend evaluation
            'simple_passcodes'       => $simplePasscodes,
            'requires_complex_check' => $requiresComplexCheck,
            'settings'               => [
                'protect_products' => (bool)$rule->protect_products,
                'hide_navigation'  => (bool)$rule->hide_navigation,
                'hide_lists'       => (bool)$rule->hide_lists,
                'hide_add_to_cart' => (bool)($rule->hide_add_to_cart ?? false),
            ]
        ];

        // Use GraphQL Admin API via MetafieldService
        $metafieldService = new MetafieldService();
        $resourceGid = $metafieldService->buildResourceGid($resourceName, $resourceId);

        $result = $metafieldService->setMetafield(
            $shop,
            $resourceGid,
            'access_control',
            'access_rule',
            $metafieldData,
            'json'
        );

        if ($result['success']) {
            Log::info("{$resourceName} metafield updated via GraphQL", [
                'resource_id' => $resourceId,
                'resource_gid' => $resourceGid,
                'rule_id'     => $rule->id,
                'namespace'   => 'access_control',
                'metafield_id' => $result['metafield']['id'] ?? null
            ]);
        } else {
            Log::error('Metafield update failed via GraphQL', [
                'errors' => $result['errors'] ?? $result['error'] ?? 'Unknown error',
                'resource_id' => $resourceId,
                'resource_gid' => $resourceGid
            ]);
        }
    }

    private function removeMetafield($shop, $rule)
    {
        $resourceType = $rule->resource_type;
        $modelClass = null;
        $idField = null;
        $resourceApiName = null;

        if ($resourceType === 'collection') {
            $modelClass = \App\Models\Collection::class;
            $idField = 'shopify_collection_id';
            $resourceApiName = 'collections';
        } elseif ($resourceType === 'product') {
            $modelClass = \App\Models\Product::class;
            $idField = 'shopify_product_id';
            $resourceApiName = 'products';
        } elseif ($resourceType === 'page') {
            $modelClass = \App\Models\Page::class;
            $idField = 'shopify_page_id';
            $resourceApiName = 'pages';
        } elseif ($resourceType === 'blog') {
            $modelClass = \App\Models\Blog::class;
            $idField = 'shopify_blog_id';
            $resourceApiName = 'blogs';
        }

        if (!$modelClass) return;

        try {
            $resource = $modelClass::where('shop_id', $shop->id)
                ->where('handle', $rule->handle)
                ->first();

            if (!$resource || !$resource->$idField) return;

            $numericId = preg_replace('/[^0-9]/', '', $resource->$idField);

            // Use GraphQL Admin API via MetafieldService
            $metafieldService = new MetafieldService();
            $resourceGid = $metafieldService->buildResourceGid($resourceApiName, $numericId);

            // First, get the metafield to find its GID
            $getResult = $metafieldService->getMetafields($shop, $resourceGid, 'access_control', 'access_rule');

            if ($getResult['success'] && !empty($getResult['metafields'])) {
                // Delete the metafield using ownerId, namespace, and key
                $deleteResult = $metafieldService->deleteMetafield(
                    $shop,
                    $resourceGid,  // ownerId
                    'access_control',  // namespace
                    'access_rule'  // key
                );

                if ($deleteResult['success']) {
                    Log::info('Metafield removed successfully via GraphQL', [
                        'resource_type' => $resourceType,
                        'resource_gid' => $resourceGid,
                        'deleted_metafields' => $deleteResult['deleted_metafields'] ?? null
                    ]);
                } else {
                    Log::error('Failed to delete metafield via GraphQL', [
                        'errors' => $deleteResult['errors'] ?? $deleteResult['error'] ?? 'Unknown error',
                        'resource_gid' => $resourceGid
                    ]);
                }
            }
        } catch (\Exception $e) {
            Log::error('Failed to remove ' . $resourceType . ' metafield', [
                'error' => $e->getMessage()
            ]);
        }
    }

    private function extractSimplePasscodes($conditions)
    {
        $passcodes = [];

        if (!is_array($conditions)) {
            return $passcodes;
        }

        foreach ($conditions as $group) {
            if (!is_array($group) || !isset($group['conditions'])) {
                continue;
            }

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
        if (!is_array($conditions)) return false;

        foreach ($conditions as $group) {
            if (!is_array($group) || !isset($group['conditions'])) continue;

            foreach ($group['conditions'] as $condition) {
                $type = $condition['type'] ?? '';
                if (in_array($type, ['tag', 'emailContains', 'specificEmail', 'location', 'ip', 'signedIn'])) {
                    return true;
                }
            }
        }

        return false;
    }
}
