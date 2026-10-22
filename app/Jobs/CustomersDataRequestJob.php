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
 * GDPR mandatory compliance webhook: customers/data_request.
 *
 * Shopify calls this when a shopper asks a merchant what personal data an
 * installed app holds about them. Airo Locksmith stores no customer records of
 * its own, but its access log keeps a row per storefront access decision that
 * can carry the Shopify customer id, IP address and user agent of a logged-in
 * shopper. We log the request with a count of matching rows for the audit
 * trail; the merchant fulfils the actual disclosure from the Shopify admin.
 *
 * This class MUST exist. Osiset's WebhookController resolves the handler by
 * convention (customers-data-request -> \App\Jobs\CustomersDataRequestJob) and
 * fatals with "Class ...Job not found" — returning a 500 to Shopify, which
 * counts against the app's mandatory-webhook compliance — when it is missing.
 */
class CustomersDataRequestJob implements ShouldQueue
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

        $rows = 0;
        if ($shop && $customerId !== null) {
            $ruleIds = AccessRule::where('shop_id', $shop->id)->pluck('id');
            $rows = AccessLog::whereIn('access_rule_id', $ruleIds)
                ->where('customer_id', $customerId)
                ->count();
        }

        Log::info('[GDPR] customers/data_request received', [
            'shop' => (string) $this->shopDomain,
            'customer_id' => $customerId,
            'access_log_rows_with_data' => $rows,
        ]);
    }
}
