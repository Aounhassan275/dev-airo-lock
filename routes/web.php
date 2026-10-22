<?php

use App\Http\Controllers\AccessLockcontroller;
use App\Http\Controllers\AccessRuleController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ExtensionController;
use App\Http\Controllers\FlowController;
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\PriceController;
use App\Http\Controllers\ProxyController;
use App\Http\Controllers\WidgetController;
use App\Http\Controllers\CrispSessionController;
use Illuminate\Support\Facades\Route;

// Pricing / plan selection. Deliberately OUTSIDE the plan gate — a shop
// without an active plan is redirected here by the plan.gate middleware and
// must be able to load this page and pick a plan. The actual charge creation
// and activation happen on the package's /billing/{plan} and /billing/process
// routes (kyon147/laravel-shopify), which record every charge in `charges`.
Route::middleware(['verify.shopify'])->group(function () {
    Route::controller(PriceController::class)->group(function () {
        Route::get('/pricing', 'index')->name('prices.index');
        Route::post('/pricing/select/{planId}', 'selectPlan')->name('prices.select');
    });
});

// Admin (embedded app) routes. plan.gate enforces an active paid plan —
// shops without one are redirected to /pricing. Admin-granted freemium and
// grandfathered shops pass the gate.
Route::middleware(['verify.shopify', 'plan.gate', 'onboard'])->group(function () {
    // Crisp Session Routes
    Route::get('/crisp/session', [CrispSessionController::class, 'show'])->name('crisp.session');
    
    // Dashboard routes
    Route::controller(DashboardController::class)->group(function () {
        Route::get('/', 'index')->name('home');
        Route::put('/locks/{lock}/status', 'updateStatus')->name('locks.updateStatus');
        Route::delete('/locks/{lock}', 'destroy')->name('locks.destroy');
        Route::post('/locks/bulk-activate', 'bulkActivate')->name('locks.bulkActivate');
        Route::post('/locks/bulk-deactivate', 'bulkDeactivate')->name('locks.bulkDeactivate');
        Route::post('/locks/bulk-delete', 'bulkDelete')->name('locks.bulkDelete');
        Route::get('/requestedcode', 'requestedcode')->name('requestedcode');
        Route::get('/lock/{lock}/preview', 'preview')->name('locks.preview');
    });

    // Lock management routes
    Route::controller(AccessLockcontroller::class)->group(function () {
        Route::get('/lock/create', 'create')->name('locks.create');
        // Pages, blogs and themes have no Shopify webhooks, so the pickers go
        // stale after install; this re-reads one type on demand.
        Route::post('/lock/refresh-catalog', 'refreshCatalog')->name('locks.refreshCatalog');
        Route::post('/locks', 'storeLock')->name('locks.store');
        Route::get('/lock/{lock}/configure', 'configureLock')->name('locks.configure');
        Route::put('/locks/{lock}', 'updateLock')->name('locks.update');
        Route::post('/lock/new-configure', 'newConfigureLock')->name('locks.new_configure');
        Route::post('/lock/store-price-rule', 'storePriceRule')->name('locks.store_price_rule');
        Route::post('/lock/sync', 'lock')->name('locks.sync');
        Route::get('/debug-metafield/{handle}', 'debugMetafield');
    });

    Route::controller(AccessRuleController::class)->group(function () {
        Route::get('/access-rules', 'index')->name('access-rules.index');
        Route::post('/access-rules', 'store')->name('access-rules.store');
        Route::put('/access-rules/{accessRule}', 'update')->name('access-rules.update');
        Route::delete('/access-rules/{accessRule}', 'destroy')->name('access-rules.destroy');
    });

    Route::controller(WidgetController::class)->group(function () {
        Route::get('/widgetdashboard', 'index')->name('widgetdashboard');
        Route::get('/widgets', 'widgets')->name('widgets');
        Route::post('/widgets/store', 'store')->name('widgets.store');
        // Creates a default-styled widget and redirects back, so the lock
        // builder can add one without losing a half-built lock.
        Route::post('/widgets/quick-create', 'quickCreate')->name('widgets.quickCreate');
        Route::get('/widgets/{widget}', 'show')->name('widgets.show');
        Route::put('/widgets/{widget}', 'update')->name('widgets.update');
        Route::delete('/widgets/{widget}', 'destroy')->name('widgets.destroy');
        Route::put('/widgets/{widget}/status', 'updateStatus')->name('widgets.updateStatus');
        Route::post('/widgets/bulk-delete', 'bulkDelete')->name('widgets.bulkDelete');
        Route::post('/widgets/bulk-status', 'bulkStatusUpdate')->name('widgets.bulkStatusUpdate');
        Route::post('/widgets/refresh-locales', 'refreshLocales')->name('widgets.refreshLocales');
    });

    Route::controller(OnboardingController::class)->group(function () {
        Route::get('/onboarding', 'index')->name('onboarding');
        Route::post('/onboarding/complete', 'complete')->name('onboarding.complete');
    });

    // Live re-check of the storefront theme app embed status (bypasses cache).
    Route::get('/extension/status', [ExtensionController::class, 'status'])->name('extension.status');
});

// Shopify App Proxy routes.
// Shopify rewrites https://<shop>.myshopify.com/apps/airo-lock/<path>
// to https://lock.airoapps.com/proxy/<path> with a signed `signature` query param.
// The auth.proxy middleware (kyon147/laravel-shopify) verifies HMAC-SHA256
// with constant-time comparison and authenticates the shop into the auth guard.
Route::prefix('proxy')
    ->middleware('auth.proxy')
    ->group(function () {
        Route::get('/ping', [ProxyController::class, 'ping'])->name('proxy.ping');
        Route::get('/rules', [ProxyController::class, 'rules'])->name('proxy.rules');
        Route::get('/robots-disallow.txt', [ProxyController::class, 'robotsDisallow'])->name('proxy.robots-disallow');
        Route::post('/event', [FlowController::class, 'event'])->name('proxy.event');
    });

// Shopify Flow action callbacks. Shopify Flow POSTs here when a workflow
// fires one of our flow_action extensions. Requests are HMAC-signed with the
// app API secret; FlowController::verifyFlowSignature checks the header.
Route::prefix('flow/action')->group(function () {
    Route::post('/grant-access', [FlowController::class, 'grantAccess'])->name('flow.grant-access');
    Route::post('/revoke-access', [FlowController::class, 'revokeAccess'])->name('flow.revoke-access');
    Route::post('/tag-customer', [FlowController::class, 'tagCustomerForLock'])->name('flow.tag-customer');
});

Route::get('logs', [\Rap2hpoutre\LaravelLogViewer\LogViewerController::class, 'index']);

// Email template previews — debug only (never exposed in production).
if (config('app.debug')) {
    Route::get('/emails/preview', [\App\Http\Controllers\EmailPreviewController::class, 'index']);
    Route::get('/emails/preview/{template}', [\App\Http\Controllers\EmailPreviewController::class, 'show']);
    
    // Temporary billing debug - accessible from embedded app.
    // JSON (no Inertia page needed) — shows every input of the test-charge
    // decision so a wrong charge type can be diagnosed at a glance.
    Route::get('/debug/billing-info', function () {
        $shop = auth()->user();
        $storeDetail = $shop?->storeDetail;

        return response()->json([
            'shop_name' => $shop?->name,
            'shop_id' => $shop?->id,
            'is_dev_store' => $shop?->isDevStore(),
            'partner_development_flag' => $storeDetail?->partner_development,
            'store_plan_name' => $storeDetail?->plan_name ?? 'N/A',
            'allow_test_charges' => (bool) $shop?->allow_test_charges,
            'billing_test_mode_setting' => (bool) \App\Models\Setting::get('billing_test_mode', false),
            'recognized_dev_plans' => config('plans.dev_store_plans'),
            'current_plan_id' => $shop?->plan_id,
            'charge_would_be_test' => $shop
                ? app(\App\Services\BillingService::class)->chargesWouldBeTest($shop)
                : null,
        ], 200, [], JSON_PRETTY_PRINT);
    })->middleware(['verify.shopify']);
    
    // Disable global test mode for production
    Route::get('/debug/disable-test-mode', function () {
        // Clear cache first
        \Illuminate\Support\Facades\Cache::forget('setting_billing_test_mode');
        
        \App\Models\Setting::set('billing_test_mode', false);
        
        // Verify it was set
        $current = \App\Models\Setting::get('billing_test_mode', false);
        
        return response()->json([
            'success' => true,
            'message' => 'Global test mode DISABLED - dev stores get test charges, real stores get real charges',
            'billing_test_mode' => (bool) $current,
            'timestamp' => now()->toDateTimeString(),
        ]);
    });
    Route::get('/debug/force-test-mode-global', function () {
        // Clear cache first
        \Illuminate\Support\Facades\Cache::forget('setting_billing_test_mode');
        
        \App\Models\Setting::set('billing_test_mode', true);
        
        // Verify it was set
        $current = \App\Models\Setting::get('billing_test_mode', false);
        
        return response()->json([
            'success' => true,
            'message' => 'Global test mode ENABLED - all shops will receive test charges',
            'billing_test_mode' => (bool) $current,
            'timestamp' => now()->toDateTimeString(),
        ]);
    });
    
    // Check current status
    Route::get('/debug/billing-status', function () {
        return response()->json([
            'billing_test_mode' => (bool) \App\Models\Setting::get('billing_test_mode', false),
            'recognized_dev_plans' => config('plans.dev_store_plans'),
            'timestamp' => now()->toDateTimeString(),
        ], 200, [], JSON_PRETTY_PRINT);
    });
    
    // Clear all caches
    Route::get('/debug/clear-cache', function () {
        \Illuminate\Support\Facades\Artisan::call('config:clear');
        \Illuminate\Support\Facades\Artisan::call('cache:clear');
        
        return response()->json([
            'success' => true,
            'message' => 'Config and cache cleared - refresh and try again',
            'timestamp' => now()->toDateTimeString(),
        ]);
    });
    
    // Sync store details and check dev store status (from within embedded app)
    Route::get('/debug/sync-store', function () {
        $shop = auth()->user();
        
        if (!$shop) {
            return response()->json(['error' => 'No authenticated shop'], 401);
        }
        
        // Reload the relationship to get fresh data
        $shop->load('storeDetail');
        
        $planName = strtolower((string) ($shop->storeDetail->plan_name ?? ''));
        $devStorePlans = config('plans.dev_store_plans', []);
        
        return response()->json([
            'shop_name' => $shop->name,
            'shop_id' => $shop->id,
            'store_plan_name' => $shop->storeDetail?->plan_name,
            'plan_name_lowercase' => $planName,
            'is_dev_store' => $shop->isDevStore(),
            'recognized_dev_plans' => $devStorePlans,
            'plan_in_list' => in_array($planName, $devStorePlans, true),
            'allow_test_charges' => (bool) $shop->allow_test_charges,
            'global_test_mode' => (bool) \App\Models\Setting::get('billing_test_mode', false),
            'charges_would_be_test' => (new \App\Services\BillingService(new \App\Services\MailService))->chargesWouldBeTest($shop),
        ], 200, [], JSON_PRETTY_PRINT);
    })->middleware(['verify.shopify']);
}
