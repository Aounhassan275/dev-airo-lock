<?php

namespace App\Http\Controllers;

use App\Models\Lock;
use App\Models\User;
use App\Services\ThemeExtensionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class DashboardController extends Controller
{
    /**
     * Display the dashboard with locks, stats, and plan information.
     */
    public function index()
    {
        $shop = Auth::user()->load('plan');

        $locks = Lock::where('shop_id', $shop->id)
            ->withCount('accessRules')
            ->latest()
            ->get();

        // What each lock protects (products, pages, the whole store …), so the
        // list can say that instead of a meaningless "Standard".
        Lock::attachResourceTypes($locks);

        $storesCount = User::count();

        // App embed status — drives the "locks won't work until you enable the
        // theme extension" notice + the one-click activation deep link.
        $extension = app(ThemeExtensionService::class)->status($shop);

        // Plan / quota data for banners, lock-limit messaging and upgrade
        // prompts. Trial state comes from the active Shopify charge; a
        // max_locks of 0 means unlimited.
        $plan = $shop->plan;
        $unlimited = $shop->hasUnlimitedLocks();
        $maxLocks = $shop->getMaxLocks();
        $lockCount = $locks->count();
        $limitReached = ! $unlimited && $lockCount >= $maxLocks;

        $planName = $plan->name
            ?? (($shop->isFreemium() || $shop->isGrandfathered()) ? 'Free access' : 'No plan');

        return Inertia::render('Dashboard', [
            'locks' => $locks,
            'storesCount' => $storesCount,
            'extensionEnabled' => $extension['enabled'],
            'extensionDeepLink' => $extension['deepLink'],
            'extensionReason' => $extension['reason'] ?? null,
            // Null when billing is disabled → the dashboard shows no plan
            // banners or lock-limit gating (matches the server-side gates,
            // which are also bypassed while billing is off).
            'plan' => config('shopify-app.billing_enabled') ? [
                'name' => $planName,
                'maxLocks' => $unlimited ? 0 : $maxLocks,
                'hasUnlimitedLocks' => $unlimited,
                'currentLocks' => $lockCount,
                'daysRemaining' => $shop->getTrialDaysRemaining(),
                'isTrial' => $shop->isInTrial(),
                'isFreemium' => $shop->isFreemium() || $shop->isGrandfathered(),
                'hasPaidPlan' => $shop->hasPaidPlan(),
                'limitReached' => $limitReached,
                'canCreateMore' => $unlimited || $lockCount < $maxLocks,
                'remainingLocks' => $unlimited ? null : max(0, $maxLocks - $lockCount),
                'nearLimit' => ! $unlimited && ! $limitReached && $maxLocks > 0
                    && ($lockCount / $maxLocks) >= (float) config('plans.near_limit_threshold', 0.8),
            ] : null,
        ]);
    }

    public function requestedcode()
    {
        return Inertia::render('RequestCode');
    }

    public function shop()
    {
        $shop = Auth::user();
        $query = <<<GQL
            {
                shop {
                    id
                    name
                    primaryDomain {
                    url
                    }
                }
            }
            GQL;
        $response = $shop->api()->graph($query);
        $data = $response['body']['data']['shop'];
        dd($data);
    }

    /**
     * Refuse a status change and land back on the dashboard with the REAL reason.
     *
     * Session flash (back()->withErrors) gets lost inside the embedded-app
     * iframe (third-party cookie partitioning), so the frontend used to see a
     * refusal as a success. Carrying the message in the redirect URL survives
     * without cookies; withErrors is kept for when the session does work.
     * The frontend additionally verifies the fresh props, so even a dropped
     * message can't produce a false success toast.
     */
    private function refuseBack(string $message, string $kind = 'error')
    {
        $previous = preg_replace('/[?&]save_error(_kind)?=[^&]*/', '', url()->previous());
        $separator = str_contains($previous, '?') ? '&' : '?';

        return redirect()->to($previous . $separator . http_build_query([
            'save_error' => $message,
            'save_error_kind' => $kind,
        ]))->withErrors([$kind => $message]);
    }

    /**
     * Update the status of a single lock.
     *
     * Activate is metafield-first: if the storefront rule can't be written the
     * flip is refused, so the dashboard never claims a lock is live when it
     * isn't. Deactivate is DB-first with best-effort metafield cleanup (same
     * policy as destroy()): an unresolvable target must never make a lock
     * impossible to turn off — the global-config rebuild stops enforcement
     * even if a per-resource metafield lingers.
     */
    public function updateStatus(Request $request, Lock $lock)
    {
        if ($lock->shop_id !== Auth::id())
            abort(403);

        $validated = $request->validate([
            'enabled' => 'required|boolean',
        ]);

        $shop = Auth::user();
        $isEnabled = $validated['enabled'];

        $lock->load('accessRules');

        try {
            DB::transaction(function () use ($lock, $isEnabled) {
                $lock->update([
                    'status' => $isEnabled,
                ]);

                // Update all associated access rules in DB
                foreach ($lock->accessRules as $rule) {
                    $rule->update([
                        'enabled' => $isEnabled,
                    ]);
                }
            });
        } catch (\Exception $e) {
            Log::error('Failed to update lock status', [
                'error' => $e->getMessage(),
                'lock_id' => $lock->id
            ]);
            return $this->refuseBack('Failed to update lock status. Please try again.');
        }

        // DB-first, same policy as saves: the flip always commits, then the
        // storefront metafields sync from DB state (activate writes, deactivate
        // deletes) with a queued background retry on failure. This replaced a
        // metafield-first refusal that (a) misdiagnosed transient throttles as
        // "target not found", and (b) left earlier rules' metafields half
        // written when a later rule failed.
        $lock->refresh()->load('accessRules');
        app(AccessLockcontroller::class)->syncMetafieldsWithRetry($shop, $lock);

        // The global config is what the storefront embed reads first — rebuild
        // it best-effort; a sync hiccup must not report a committed flip as failed.
        try {
            app(AccessLockcontroller::class)->updateGlobalMetafield($shop);
        } catch (\Throwable $e) {
            Log::warning('Lock status: global metafield sync failed', [
                'lock_id' => $lock->id,
                'error' => $e->getMessage(),
            ]);
        }

        return back()->with('success', 'Lock status updated successfully');
    }

    /**
     * Bulk activate selected locks.
     */
    public function bulkActivate(Request $request)
    {
        $validated = $request->validate([
            'lock_ids' => 'required|array',
            'lock_ids.*' => 'exists:locks,id',
        ]);

        $shop = Auth::user();
        $locks = Lock::whereIn('id', $validated['lock_ids'])
            ->where('shop_id', $shop->id)
            ->with(['accessRules', 'widget'])
            ->get();

        $successCount = 0;
        $errors = [];

        foreach ($locks as $lock) {
            // DB-FIRST, same policy as updateStatus/saves: the flip always
            // commits, then metafields sync from DB state with a queued
            // background retry on failure.
            try {
                DB::transaction(function () use ($lock) {
                    /** @var \App\Models\Lock $lock */
                    $lock->update(['status' => true]);
                    foreach ($lock->accessRules as $rule) {
                        $rule->update(['enabled' => true]);
                    }
                });
                $successCount++;
            } catch (\Exception $e) {
                $errors[] = "Lock {$lock->name}: DB Error";
                continue;
            }

            $lock->refresh()->load('accessRules');
            app(AccessLockcontroller::class)->syncMetafieldsWithRetry($shop, $lock);
        }

        // Update Global Metafield
        app(AccessLockcontroller::class)->updateGlobalMetafield($shop);

        if (!empty($errors)) {
            return back()->with('error', 'Some locks failed to activate. ' . implode('; ', $errors))->with('success', "{$successCount} lock(s) activated.");
        }

        return back()->with('success', "{$successCount} lock(s) activated successfully");
    }

    /**
     * Bulk deactivate selected locks.
     */
    public function bulkDeactivate(Request $request)
    {
        $validated = $request->validate([
            'lock_ids' => 'required|array',
            'lock_ids.*' => 'exists:locks,id',
        ]);

        $shop = Auth::user();
        $locks = Lock::whereIn('id', $validated['lock_ids'])
            ->where('shop_id', $shop->id)
            ->with(['accessRules', 'widget'])  // Added widget for consistency
            ->get();

        $successCount = 0;
        $errors = [];

        foreach ($locks as $lock) {
            // DB-FIRST (see updateStatus): deactivation must always commit. A
            // Shopify metafield whose target no longer resolves must never make
            // a lock impossible to turn off — the global-config rebuild below
            // stops enforcement even if a per-resource metafield lingers.
            try {
                DB::transaction(function () use ($lock) {
                    /** @var \App\Models\Lock $lock */
                    $lock->update(['status' => false]);
                    foreach ($lock->accessRules as $rule) {
                        $rule->update(['enabled' => false]);
                    }
                });
                $successCount++;
            } catch (\Exception $e) {
                $errors[] = "Lock {$lock->name}: DB Error";
                continue;
            }

            // Metafield cleanup — never fatal, and failures queue a background
            // retry (the storefront reads the per-resource metafield first, so
            // a lingering entry would keep enforcing a lock shown as off).
            $lock->refresh()->load('accessRules');
            app(AccessLockcontroller::class)->syncMetafieldsWithRetry($shop, $lock);
        }

        // Update Global Metafield (best-effort — never turns a committed flip into a reported failure)
        try {
            app(AccessLockcontroller::class)->updateGlobalMetafield($shop);
        } catch (\Throwable $e) {
            Log::warning('Bulk deactivate: global metafield sync failed', ['error' => $e->getMessage()]);
        }

        if (!empty($errors)) {
            return back()->with('error', 'Some locks failed to deactivate. ' . implode('; ', $errors))->with('success', "{$successCount} lock(s) deactivated.");
        }

        return back()->with('success', "{$successCount} lock(s) deactivated successfully");
    }

    /**
     * Bulk delete selected locks.
     */
    public function bulkDelete(Request $request)
    {
        $validated = $request->validate([
            'lock_ids' => 'required|array',
            'lock_ids.*' => 'exists:locks,id',
        ]);

        $shop = Auth::user();
        $deletedCount = 0;
        $deletedLocks = [];

        try {
            $locks = Lock::whereIn('id', $validated['lock_ids'])
                ->where('shop_id', $shop->id)
                ->with('accessRules')
                ->get();

            // Best-effort Shopify metafield cleanup — OUTSIDE the transaction and
            // guarded per-rule (see destroy() for the rationale).
            foreach ($locks as $lock) {
                foreach ($lock->accessRules as $rule) {
                    try {
                        $res = app(AccessLockcontroller::class)->deleteRuleMetafield($shop, $rule);
                        if (!($res['success'] ?? false) && ($res['code'] ?? '') !== 'not_found') {
                            Log::warning('Bulk delete: metafield cleanup failed — queueing cleanup retry', [
                                'lock_id' => $lock->id,
                                'rule_id' => $rule->id,
                                'handle' => $rule->handle,
                                'error' => $res['error'] ?? null,
                            ]);
                            \App\Jobs\RemoveRuleMetafieldJob::dispatch(
                                $shop->id, $rule->resource_type, $rule->handle, $rule->lock_id, [$rule->id]
                            )->delay(now()->addSeconds(30));
                        }
                    } catch (\Throwable $e) {
                        Log::warning('Bulk delete: metafield cleanup threw — queueing cleanup retry', [
                            'lock_id' => $lock->id,
                            'rule_id' => $rule->id,
                            'error' => $e->getMessage(),
                        ]);
                        \App\Jobs\RemoveRuleMetafieldJob::dispatch(
                            $shop->id, $rule->resource_type, $rule->handle, $rule->lock_id, [$rule->id]
                        )->delay(now()->addSeconds(30));
                    }
                }
            }

            DB::transaction(function () use ($locks, &$deletedCount, &$deletedLocks) {
                foreach ($locks as $lock) {
                    /** @var \App\Models\Lock $lock */
                    $deletedLocks[] = ['name' => $lock->name, 'count' => $lock->accessRules->count()];

                    foreach ($lock->accessRules as $rule) {
                        $rule->delete();
                    }
                    $lock->delete();
                    $deletedCount++;
                }
            });

            // Post-delete side effects are best-effort.
            try {
                app(AccessLockcontroller::class)->updateGlobalMetafield(Auth::user());
                $mail = app(\App\Services\MailService::class);
                foreach ($deletedLocks as $deleted) {
                    $mail->lockDeleted($shop, $deleted['name'], $deleted['count']);
                }
            } catch (\Throwable $e) {
                Log::warning('Bulk delete: post-delete side effect failed', ['error' => $e->getMessage()]);
            }

            return back()->with('success', "{$deletedCount} lock(s) deleted successfully");
        } catch (\Exception $e) {
            Log::error('Bulk delete failed', ['error' => $e->getMessage()]);
            // withErrors so the frontend's onError fires (see destroy()).
            return back()->withErrors(['delete' => 'Failed to delete locks. Please try again.']);
        }
    }

    /**
     * Delete a single lock.
     */
    public function destroy(Lock $lock)
    {
        if ($lock->shop_id !== Auth::id()) {
            abort(403);
        }

        $shop = Auth::user();

        // Capture before deletion for the notification email.
        $lockName = $lock->name;
        $itemCount = $lock->accessRules()->count();

        try {
            $lock->load('accessRules');

            // Best-effort Shopify metafield cleanup — done OUTSIDE the DB transaction
            // and guarded per-rule so it can NEVER block the delete. The target
            // product/collection/page/blog may have been deleted or renamed on Shopify
            // (so its handle no longer resolves); the old "strict" behaviour threw in
            // that case and made such locks permanently undeletable.
            foreach ($lock->accessRules as $rule) {
                try {
                    $res = app(AccessLockcontroller::class)->deleteRuleMetafield($shop, $rule);
                    if (!($res['success'] ?? false)) {
                        Log::warning('Lock delete: metafield cleanup failed (continuing anyway)', [
                            'lock_id' => $lock->id,
                            'rule_id' => $rule->id,
                            'handle' => $rule->handle,
                            'error' => $res['error'] ?? null,
                        ]);
                    }
                } catch (\Throwable $e) {
                    Log::warning('Lock delete: metafield cleanup threw (continuing anyway)', [
                        'lock_id' => $lock->id,
                        'rule_id' => $rule->id,
                        'handle' => $rule->handle,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            DB::transaction(function () use ($lock) {
                foreach ($lock->accessRules as $rule) {
                    $rule->delete();
                }
                $lock->delete();
            });

            // Post-delete side effects are best-effort — the lock is already gone, so
            // none of these may turn a successful delete into a reported failure.
            try {
                app(AccessLockcontroller::class)->updateGlobalMetafield(Auth::user());
                app(\App\Services\MailService::class)->lockDeleted($shop, $lockName, $itemCount);
            } catch (\Throwable $e) {
                Log::warning('Lock delete: post-delete side effect failed', [
                    'lock_id' => $lock->id,
                    'error' => $e->getMessage(),
                ]);
            }

            return back()->with('success', 'Lock deleted successfully');
        } catch (\Exception $e) {
            Log::error('Failed to delete lock', ['lock_id' => $lock->id, 'error' => $e->getMessage()]);

            // withErrors (not ->with('error')) so Inertia routes this to the
            // frontend's onError — otherwise a 200 redirect reads as success and
            // the UI shows a false "deleted" toast while the lock is still there.
            return back()->withErrors(['delete' => 'Failed to delete lock. Please try again.']);
        }
    }

    /**
     * Sync a rule's metafield to Shopify.
     */
    private function syncRuleMetafield($rule)
    {
        $shop = Auth::user();
        $resourceType = $rule->resource_type;

        // Map resource types to their respective update methods
        $metafieldUpdaters = [
            'collection' => 'updateCollectionMetafield',
            'product' => 'updateProductMetafield',
            'page' => 'updatePageMetafield',
            'blog' => 'updateBlogMetafield',
        ];

        if (isset($metafieldUpdaters[$resourceType])) {
            $method = $metafieldUpdaters[$resourceType];
            app(AccessLockcontroller::class)->$method($shop, $rule);
        }
    }

    /**
     * Remove a rule's metafield from Shopify.
     */
    private function removeRuleMetafield($rule)
    {
        $shop = Auth::user();
        app(AccessLockcontroller::class)->removeMetafield($shop, $rule);
    }

    /**
     * Preview a lock — renders the configure page in read-only mode.
     */
    public function preview(Lock $lock)
    {
        if ($lock->shop_id !== Auth::id()) {
            abort(403);
        }

        $lock->load(['accessRules', 'widget']);

        return Inertia::render('LockConfigurePage', [
            'lock' => $lock,
            'previewMode' => true,
        ]);
    }
}
