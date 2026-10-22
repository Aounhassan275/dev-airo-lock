<?php

namespace App\Services;

use App\Models\StoreDetail;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Fetches a shop's profile from the Shopify Admin API and upserts its
 * StoreDetail row. Used on install (AfterAuthenticateJob) and by the
 * `stores:backfill` command. Returns a structured result and logs the real
 * reason on failure instead of silently doing nothing.
 */
class StoreDetailSync
{
    /**
     * @return array{ok: bool, message: string, storeDetail: ?StoreDetail}
     */
    public function sync(User $shop): array
    {
        $query = 'query GetStoreDetails {
            shop {
                id
                name
                email
                description
                plan { displayName shopifyPlus partnerDevelopment }
                myshopifyDomain
                primaryDomain { url }
                billingAddress { country phone }
                currencyCode
                ianaTimezone
                createdAt
                updatedAt
                customerAccountsV2 { url }
            }
        }';

        try {
            $response = $shop->api()->graph($query);
        } catch (\Throwable $e) {
            $msg = 'API call failed: '.$e->getMessage();
            Log::error('StoreDetailSync: '.$msg, ['shop' => $shop->name]);

            return ['ok' => false, 'message' => $msg, 'storeDetail' => null];
        }

        $status = $response['status'] ?? null;
        $data = $response['body']['data']['shop']
            ?? $response['body']['container']['data']['shop']
            ?? null;

        if ($status != 200 || ! $data) {
            // Surface the GraphQL errors so the cause is visible (scope, field, token).
            $errors = $response['body']['errors'] ?? $response['body']['container']['errors'] ?? null;
            $msg = 'No shop data (status='.$status.'): '.json_encode($errors);
            Log::error('StoreDetailSync: '.$msg, ['shop' => $shop->name]);

            return ['ok' => false, 'message' => $msg, 'storeDetail' => null];
        }

        $storeDetail = StoreDetail::updateOrCreate(
            ['user_id' => $shop->id],
            [
                'shop_id' => $data['id'] ?? null,
                'shop_name' => $data['name'] ?? null,
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? $data['billingAddress']['phone'] ?? null,
                'description' => $data['description'] ?? null,
                'plan_name' => $data['plan']['displayName'] ?? null,
                // Authoritative dev-store signal — drives the TEST-charge policy.
                'partner_development' => $data['plan']['partnerDevelopment'] ?? null,
                'shopify_plus' => $data['plan']['shopifyPlus'] ?? false,
                'shopify_domain' => $data['myshopifyDomain'] ?? null,
                'primary_domain' => $data['primaryDomain']['url'] ?? null,
                'currency' => $data['currencyCode'] ?? null,
                'country' => $data['billingAddress']['country'] ?? null,
                'iana_timezone' => $data['ianaTimezone'] ?? null,
                'shopify_created_at' => isset($data['createdAt']) ? Carbon::parse($data['createdAt']) : null,
                'shopify_updated_at' => isset($data['updatedAt']) ? Carbon::parse($data['updatedAt']) : null,
            ]
        );

        // A successful shop query is proof of life: the token works and the
        // store is open. Covers install, re-auth (reinstall after uninstall)
        // and stores:backfill in one place. Best-effort: a telemetry failure
        // must never fail the install-time sync.
        try {
            $storeDetail->applyStoreStatus(StoreDetail::STATUS_ACTIVE, 'shop API sync succeeded');
        } catch (\Throwable $e) {
            Log::warning('[StoreStatus] active stamp failed', [
                'shop' => $shop->name,
                'error' => $e->getMessage(),
            ]);
        }

        return [
            'ok' => true,
            'message' => 'Synced '.($data['name'] ?? $shop->name).' (email: '.($data['email'] ?? 'none').')',
            'storeDetail' => $storeDetail,
        ];
    }
}
