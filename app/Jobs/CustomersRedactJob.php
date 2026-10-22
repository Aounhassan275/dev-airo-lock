<?php

namespace App\Jobs;

use App\Models\AccessLog;
use App\Models\AccessRule;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * GDPR mandatory compliance webhook: customers/redact.
 *
 * Shopify calls this ~48h after a shopper asks a merchant to erase their data.
 * Airo Locksmith keeps no customer records of its own, but its access log holds
 * a row per storefront access decision carrying the shopper's Shopify customer
 * id, IP address and user agent. This job deletes that shop's access-log rows
 * for the redacted customer.
 *
 * Idempotent. This class MUST exist or Osiset's WebhookController fatals with
 * "Class ...Job not found" and returns a 500 to Shopify, which counts against
 * the app's mandatory-webhook compliance.
 */
class CustomersRedactJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;

    public $backoff = 30;

    /** @var string Shop's myshopify domain (x-shopify-shop-domain header). */
    public $shopDomain;

    /** @var object JSON-decoded webhook payload. */
    public $data;

    public function __construct($shopDomain, $data)
    {
        $this->shopDomain = $shopDomain;
        $this->data = $data;
        $this->onQueue('webhooks');
    }

    public function handle(): void
    {
        $customerId = data_get($this->data, 'customer.id');
        $shop = User::where('name', (string) $this->shopDomain)->first();

        if (! $shop || $customerId === null) {
            Log::info('[GDPR] customers/redact — nothing to erase (shop or customer id missing)', [
                'shop' => (string) $this->shopDomain,
                'customer_id' => $customerId,
            ]);

            return;
        }

        // Scope to this shop's rules so we never touch another merchant's logs
        // for a coincidentally equal customer id.
        $ruleIds = AccessRule::where('shop_id', $shop->id)->pluck('id');
        $deleted = AccessLog::whereIn('access_rule_id', $ruleIds)
            ->where('customer_id', $customerId)
            ->delete();

        Log::info('[GDPR] customers/redact complete', [
            'shop' => (string) $this->shopDomain,
            'customer_id' => $customerId,
            'access_logs_deleted' => $deleted,
        ]);
    }
}
