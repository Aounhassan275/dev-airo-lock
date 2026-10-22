<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * Emits Shopify Flow trigger events.
 *
 * Shopify Flow listens for trigger events via the Admin API mutation
 * `flowTriggerReceive`. Each merchant install configures their own Flow
 * workflows; we just need to fire the event with a stable handle and a
 * payload matching the trigger schema in each
 * extensions/airo-lock-flow-{event}/shopify.extension.toml file.
 *
 * No third-party SaaS — only Shopify's own GraphQL Admin API.
 */
class FlowService
{
    /**
     * Trigger handles must match the `handle` in the corresponding
     * extensions/airo-lock-flow-{event}/shopify.extension.toml file.
     */
    public const TRIGGER_ACCESS_ATTEMPTED = 'airo-lock-access-attempted';

    public const TRIGGER_ACCESS_GRANTED = 'airo-lock-access-granted';
    public const TRIGGER_ACCESS_DENIED = 'airo-lock-access-denied';
    public const TRIGGER_REQUEST_SUBMITTED = 'airo-lock-request-submitted';
    public const TRIGGER_REQUEST_APPROVED = 'airo-lock-request-approved';

    /**
     * Fire a Flow trigger for the given shop with the given payload.
     *
     * @param object      $shop          User instance with api() method (kyon147 ShopModel)
     * @param string      $triggerHandle One of the TRIGGER_* constants
     * @param array       $properties    Trigger payload — keys must match the trigger fields
     * @return bool                      True if Shopify accepted the trigger
     */
    public function trigger($shop, string $triggerHandle, array $properties): bool
    {
        if (!$shop || !method_exists($shop, 'api')) {
            return false;
        }

        try {
            // Flow requires every field defined on a trigger to be present in
            // the payload. Coerce nulls to empty strings and scalars to strings
            // so a guest evaluation (no customer id/email) still sends all keys.
            $normalized = [];
            foreach ($properties as $key => $value) {
                $normalized[$key] = $value === null ? '' : (string) $value;
            }

            $mutation = <<<'GQL'
                mutation FlowTriggerReceive($handle: String!, $payload: JSON) {
                  flowTriggerReceive(handle: $handle, payload: $payload) {
                    userErrors { field message }
                  }
                }
                GQL;

            $response = $shop->api()->graph($mutation, [
                'handle' => $triggerHandle,
                'payload' => $normalized,
            ]);

            // Top-level GraphQL errors (throttling, denied scope, malformed
            // query) mean the mutation never ran. Convert from ResponseAccess
            // to a plain array before testing.
            $topErrors = $response['body']['errors'] ?? [];
            if (is_object($topErrors)) {
                $topErrors = json_decode(json_encode($topErrors), true);
            }
            if (!empty($topErrors)) {
                Log::warning('Flow trigger rejected by Shopify', [
                    'handle' => $triggerHandle,
                    'errors' => $topErrors,
                ]);
                return false;
            }

            // userErrors comes back as a Gnikyt ResponseAccess object even when
            // empty — ResponseAccess::offsetGet wraps every array value, so
            // empty()/!empty() on the raw object is always false/true and can
            // never be tested directly. Convert to a plain array first (same
            // pattern as MetafieldService).
            $errors = $response['body']['data']['flowTriggerReceive']['userErrors'] ?? [];
            if (is_object($errors)) {
                $errors = json_decode(json_encode($errors), true);
            }

            if (!empty($errors)) {
                Log::warning('Flow trigger rejected by Shopify', [
                    'handle' => $triggerHandle,
                    'errors' => $errors,
                ]);
                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::warning('Flow trigger dispatch failed', [
                'handle' => $triggerHandle,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }
}
