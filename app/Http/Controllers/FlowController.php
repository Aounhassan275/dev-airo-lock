<?php

namespace App\Http\Controllers;

use App\Jobs\RevokeFlowGrantJob;
use App\Models\AccessLog;
use App\Models\AccessRule;
use App\Models\Lock;
use App\Services\FlowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Shopify Flow integration (PR #7).
 *
 * Two responsibilities:
 *   1. Storefront -> Flow trigger emission. The theme-app-extension JS
 *      posts to /apps/airo-lock/event (proxy-signed) when a lock is
 *      evaluated; this controller forwards to FlowService.
 *   2. Flow -> backend action callbacks. Shopify Flow calls the
 *      runtime_url from each action toml when a workflow runs the action.
 *
 * Action callbacks are HMAC-signed by Shopify using the app secret. We
 * verify the signature exactly the way the App Proxy middleware does,
 * but inline so this works for the dedicated /flow/action/* routes
 * which are not behind auth.proxy.
 */
class FlowController extends Controller
{
    /**
     * POST /apps/airo-lock/event (behind auth.proxy)
     *
     * Storefront JS posts here with body:
     *   { rule_id, lock_id, resource_type, resource_handle, decision,
     *     reason?, email?, country?, customer_id? }
     *
     * decision is "granted" or "denied" (or "request_submitted" for the
     * Request Credentials form). We emit the matching Flow trigger.
     */
    public function event(Request $request, FlowService $flow): JsonResponse
    {
        $shop = Auth::user();
        if (!$shop) {
            return response()->json(['ok' => false, 'reason' => 'unauthenticated'], 401);
        }

        $data = $request->validate([
            'rule_id' => 'nullable|integer',
            'lock_id' => 'nullable|integer',
            'resource_type' => 'nullable|string|max:32',
            'resource_handle' => 'nullable|string|max:255',
            'decision' => 'required|string|in:granted,denied,request_submitted',
            'reason' => 'nullable|string|max:128',
            'email' => 'nullable|string|max:255',
            'country' => 'nullable|string|max:8',
            'customer_id' => 'nullable|integer',
        ]);

        // Persist the access decision for the app's own analytics (dashboard
        // KPIs, Access Activity chart, weekly digests). This is separate from
        // the Flow triggers below — Flow is opt-in per merchant, the log is not.
        // Only granted/denied are access *results*; request_submitted is a
        // credential-request form submission, not a grant/deny, so we skip it
        // here to keep the blocked-rate metric accurate.
        if (in_array($data['decision'], ['granted', 'denied'], true)) {
            try {
                AccessLog::create([
                    'access_rule_id' => $data['rule_id'] ?? null,
                    'customer_id' => $data['customer_id'] ?? null,
                    'ip_address' => $request->ip(),
                    'user_agent' => Str::limit((string) $request->userAgent(), 500, ''),
                    'granted' => $data['decision'] === 'granted',
                    'reason' => $data['decision'] === 'denied' ? ($data['reason'] ?? null) : null,
                ]);
            } catch (\Throwable $e) {
                // Never let analytics logging break the storefront event flow.
                Log::warning('AccessLog write failed', ['error' => $e->getMessage()]);
            }
        }

        // Base fields shared by every access trigger. Keys must match the
        // [[settings.fields]] keys in each flow_trigger extension toml, which
        // Flow requires to be camelCase (alphabetic only, no underscores).
        $base = [
            'ruleId' => $data['rule_id'] ?? null,
            'lockId' => $data['lock_id'] ?? null,
            'resourceType' => $data['resource_type'] ?? null,
            'resourceHandle' => $data['resource_handle'] ?? null,
            'email' => $data['email'] ?? null,
            'country' => $data['country'] ?? null,
        ];

        // Always emit "attempted" with the decision included.
        $flow->trigger($shop, FlowService::TRIGGER_ACCESS_ATTEMPTED, $base + [
            'decision' => $data['decision'],
        ]);

        if ($data['decision'] === 'granted') {
            $flow->trigger($shop, FlowService::TRIGGER_ACCESS_GRANTED, $base);
        } elseif ($data['decision'] === 'denied') {
            $flow->trigger($shop, FlowService::TRIGGER_ACCESS_DENIED, $base + [
                'reason' => $data['reason'] ?? 'unknown',
            ]);
        } elseif ($data['decision'] === 'request_submitted') {
            // request_submitted trigger has no country field
            $flow->trigger($shop, FlowService::TRIGGER_REQUEST_SUBMITTED, [
                'ruleId' => $data['rule_id'] ?? null,
                'lockId' => $data['lock_id'] ?? null,
                'resourceType' => $data['resource_type'] ?? null,
                'resourceHandle' => $data['resource_handle'] ?? null,
                'email' => $data['email'] ?? null,
            ]);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * POST /flow/action/grant-access
     *
     * Body posted by Shopify Flow:
     *   { shopify_shop_id, shop_domain, properties: { customerId, ruleId, durationHours? } }
     *
     * We tag the customer with the access tag(s) from the rule. If
     * durationHours is set, RevokeFlowGrantJob is dispatched with a
     * delay so the tag is removed at expiry. The queue worker config
     * (QUEUE_CONNECTION=database by default) must be running for the
     * revoke to fire on schedule.
     */
    public function grantAccess(Request $request): Response
    {
        if (!$this->verifyFlowSignature($request)) {
            return response('Invalid signature', 401);
        }

        $shopDomain = $request->input('shop_domain') ?? $request->input('shopify_domain');
        $props = $request->input('properties', []);
        $customerId = $props['customerId'] ?? null;
        $ruleId = $props['ruleId'] ?? null;
        $durationHours = isset($props['durationHours']) ? (int) $props['durationHours'] : null;

        if (!$customerId || !$ruleId) {
            return response('Missing customerId or ruleId', 422);
        }

        $shop = \App\Models\User::where('name', $shopDomain)->first();
        if (!$shop) {
            return response('Unknown shop', 404);
        }

        $rule = AccessRule::where('id', $ruleId)->where('shop_id', $shop->id)->first();
        if (!$rule) {
            return response('Rule not found', 404);
        }

        $tags = $this->extractTagsFromConditions($rule->conditions ?? []);
        if (empty($tags)) {
            // Fall back to a synthetic per-rule tag so the rule will
            // pass for this customer even without explicit tag conditions.
            $tags = ['airo-lock-rule-' . $rule->id];
        }

        foreach ($tags as $tag) {
            $this->addCustomerTag($shop, $customerId, $tag);
        }

        if ($durationHours !== null && $durationHours > 0) {
            RevokeFlowGrantJob::dispatch($shop->id, (int) $customerId, $rule->id)
                ->delay(now()->addHours($durationHours));
        }

        return response('OK', 200);
    }

    /**
     * POST /flow/action/revoke-access
     */
    public function revokeAccess(Request $request): Response
    {
        if (!$this->verifyFlowSignature($request)) {
            return response('Invalid signature', 401);
        }

        $shopDomain = $request->input('shop_domain') ?? $request->input('shopify_domain');
        $props = $request->input('properties', []);
        $customerId = $props['customerId'] ?? null;
        $ruleId = $props['ruleId'] ?? null;

        if (!$customerId || !$ruleId) {
            return response('Missing customerId or ruleId', 422);
        }

        $shop = \App\Models\User::where('name', $shopDomain)->first();
        if (!$shop) {
            return response('Unknown shop', 404);
        }

        $rule = AccessRule::where('id', $ruleId)->where('shop_id', $shop->id)->first();
        if (!$rule) {
            return response('Rule not found', 404);
        }

        $tags = $this->extractTagsFromConditions($rule->conditions ?? []);
        $tags[] = 'airo-lock-rule-' . $rule->id;

        foreach ($tags as $tag) {
            $this->removeCustomerTag($shop, $customerId, $tag);
        }

        return response('OK', 200);
    }

    /**
     * POST /flow/action/tag-customer
     *
     * Bulk-applies every tag found in the lock's tag conditions across
     * all its access rules.
     */
    public function tagCustomerForLock(Request $request): Response
    {
        if (!$this->verifyFlowSignature($request)) {
            return response('Invalid signature', 401);
        }

        $shopDomain = $request->input('shop_domain') ?? $request->input('shopify_domain');
        $props = $request->input('properties', []);
        $customerId = $props['customerId'] ?? null;
        $lockId = $props['lockId'] ?? null;

        if (!$customerId || !$lockId) {
            return response('Missing customerId or lockId', 422);
        }

        $shop = \App\Models\User::where('name', $shopDomain)->first();
        if (!$shop) {
            return response('Unknown shop', 404);
        }

        $lock = Lock::with('accessRules')->where('id', $lockId)->where('shop_id', $shop->id)->first();
        if (!$lock) {
            return response('Lock not found', 404);
        }

        $tags = [];
        foreach ($lock->accessRules as $rule) {
            $tags = array_merge($tags, $this->extractTagsFromConditions($rule->conditions ?? []));
        }
        $tags = array_values(array_unique($tags));

        foreach ($tags as $tag) {
            $this->addCustomerTag($shop, $customerId, $tag);
        }

        return response('OK', 200);
    }

    /**
     * Shopify Flow signs action callbacks with HMAC-SHA256 over the raw
     * request body using the app's API secret. Verify in constant time.
     *
     * Header: `X-Shopify-Hmac-Sha256` (base64).
     */
    private function verifyFlowSignature(Request $request): bool
    {
        $hmacHeader = $request->header('X-Shopify-Hmac-Sha256') ?? $request->header('X-Shopify-Hmac-SHA256');
        if (!$hmacHeader) {
            return false;
        }

        $secret = config('shopify-app.api_secret');
        if (!$secret) {
            return false;
        }

        $body = $request->getContent();
        $calculated = base64_encode(hash_hmac('sha256', $body, $secret, true));
        return hash_equals($calculated, $hmacHeader);
    }

    /**
     * Walk the rule's conditions JSON and pull out every tag value used
     * in a `tag` condition. Tags are how rules grant access; tagging a
     * customer with one of these makes them pass that branch of the OR.
     */
    private function extractTagsFromConditions(array $conditions): array
    {
        $tags = [];
        foreach ($conditions as $group) {
            $groupConds = $group['conditions'] ?? [];
            foreach ($groupConds as $cond) {
                if (($cond['type'] ?? null) === 'tag' && !empty($cond['value'])) {
                    $tags[] = $cond['value'];
                }
            }
        }
        return array_values(array_unique($tags));
    }

    private function addCustomerTag($shop, int $customerId, string $tag): void
    {
        try {
            $gid = 'gid://shopify/Customer/' . $customerId;
            $mutation = <<<'GQL'
                mutation TagsAdd($id: ID!, $tags: [String!]!) {
                  tagsAdd(id: $id, tags: $tags) {
                    userErrors { field message }
                  }
                }
                GQL;
            $shop->api()->graph($mutation, ['id' => $gid, 'tags' => [$tag]]);
        } catch (\Throwable $e) {
            Log::warning('Flow tagsAdd failed', [
                'customer_id' => $customerId,
                'tag' => $tag,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function removeCustomerTag($shop, int $customerId, string $tag): void
    {
        try {
            $gid = 'gid://shopify/Customer/' . $customerId;
            $mutation = <<<'GQL'
                mutation TagsRemove($id: ID!, $tags: [String!]!) {
                  tagsRemove(id: $id, tags: $tags) {
                    userErrors { field message }
                  }
                }
                GQL;
            $shop->api()->graph($mutation, ['id' => $gid, 'tags' => [$tag]]);
        } catch (\Throwable $e) {
            Log::warning('Flow tagsRemove failed', [
                'customer_id' => $customerId,
                'tag' => $tag,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
