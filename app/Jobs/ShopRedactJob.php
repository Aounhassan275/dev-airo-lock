<?php

namespace App\Jobs;

use App\Models\AccessLog;
use App\Models\AccessRule;
use App\Models\Blog;
use App\Models\Collection;
use App\Models\Lock;
use App\Models\Onboarding;
use App\Models\Page;
use App\Models\Product;
use App\Models\Store;
use App\Models\StoreDetail;
use App\Models\Theme;
use App\Models\User;
use App\Models\Variant;
use App\Models\Widget;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * GDPR mandatory compliance webhook: shop/redact.
 *
 * Shopify calls this ~48h after a shop uninstalls the app, requiring every
 * trace of that shop's data to be erased. AppUninstalledJob already soft-deletes
 * the shop; this is the final hard purge of everything keyed to it — access
 * rules and their logs, locks, widgets, onboarding, the mirrored catalog
 * (products, variants, blogs, collections, pages, themes, store) and store
 * details, then the shop row itself.
 *
 * Idempotent — safe to run when the shop was already cleaned. This class MUST
 * exist or Osiset's WebhookController fatals with "Class ...Job not found" and
 * returns a 500 to Shopify, which counts against the app's mandatory-webhook
 * compliance.
 */
class ShopRedactJob implements ShouldQueue
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
        $shop = User::withTrashed()->where('name', (string) $this->shopDomain)->first();

        if (! $shop) {
            Log::info('[GDPR] shop/redact — shop not found, nothing to erase', [
                'shop' => (string) $this->shopDomain,
            ]);

            return;
        }

        $shopId = $shop->id;

        // Access logs hang off access rules, so clear them before the rules.
        $ruleIds = AccessRule::where('shop_id', $shopId)->pluck('id');
        AccessLog::whereIn('access_rule_id', $ruleIds)->delete();
        AccessRule::where('shop_id', $shopId)->delete();

        Widget::where('user_id', $shopId)->delete();
        Onboarding::where('user_id', $shopId)->delete();
        Lock::where('shop_id', $shopId)->delete();

        // Mirrored Shopify catalog.
        Product::where('shop_id', $shopId)->delete();
        Variant::where('shop_id', $shopId)->delete();
        Blog::where('shop_id', $shopId)->delete();
        Collection::where('shop_id', $shopId)->delete();
        Page::where('shop_id', $shopId)->delete();
        Store::where('shop_id', $shopId)->delete();
        Theme::where('shop_id', $shopId)->delete();

        StoreDetail::where('user_id', $shopId)->delete();

        // Erasure, not a soft delete-on-uninstall.
        $shop->forceDelete();

        Log::info('[GDPR] shop/redact complete — shop data erased', [
            'shop' => (string) $this->shopDomain,
        ]);
    }
}
