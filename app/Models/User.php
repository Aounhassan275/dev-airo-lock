<?php

namespace App\Models;

use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Osiset\ShopifyApp\Contracts\ShopModel as IShopModel;
use Osiset\ShopifyApp\Storage\Models\Plan;
use Osiset\ShopifyApp\Traits\ShopModel;

class User extends Authenticatable implements IShopModel, FilamentUser
{
    use Notifiable;
    use ShopModel;
    use \Illuminate\Database\Eloquent\Factories\HasFactory;

    public function canAccessPanel(Panel $panel): bool
    {
        return (bool) $this->is_admin;
    }

    public function storeDetail()
    {
        return $this->hasOne(StoreDetail::class);
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for arrays.
     *
     * @var array
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Shop has an active paid subscription (a plan applied via Shopify billing).
     */
    public function hasPaidPlan(): bool
    {
        return $this->plan_id !== null;
    }

    /**
     * The active (non-cancelled) charge backing the current plan, if any.
     * This is where real trial/billing dates live under Shopify billing.
     */
    public function activePlanCharge(): ?\Osiset\ShopifyApp\Storage\Models\Charge
    {
        if ($this->plan_id === null) {
            return null;
        }

        return $this->charges()
            ->where('plan_id', $this->plan_id)
            ->whereIn('type', [
                \Osiset\ShopifyApp\Objects\Enums\ChargeType::RECURRING()->toNative(),
                \Osiset\ShopifyApp\Objects\Enums\ChargeType::CHARGE()->toNative(),
            ])
            ->whereNull('cancelled_on')
            ->orderByDesc('created_at')
            ->first();
    }

    /**
     * Shop is inside the free-trial window of its active subscription.
     */
    public function isInTrial(): bool
    {
        $charge = $this->activePlanCharge();

        return $charge !== null
            && $charge->trial_days > 0
            && $charge->trial_ends_on !== null
            && now()->startOfDay()->lte(\Illuminate\Support\Carbon::parse($charge->trial_ends_on));
    }

    /**
     * Remaining free-trial days on the active subscription (0 when not in trial).
     */
    public function getTrialDaysRemaining(): int
    {
        if (! $this->isInTrial()) {
            return 0;
        }

        $trialEndsOn = \Illuminate\Support\Carbon::parse($this->activePlanCharge()->trial_ends_on);

        return max(0, (int) ceil(now()->diffInDays($trialEndsOn, false)));
    }

    /**
     * Max locks allowed on the current plan. 0 = unlimited.
     * Shops without a plan (freemium/grandfathered by admin, or mid-signup)
     * get the smallest active plan's limit as a safe default.
     */
    public function getMaxLocks(): int
    {
        if ($this->plan) {
            return (int) $this->plan->max_locks;
        }

        // Admin-granted free access (freemium/grandfathered) was promised the
        // entry PAID tier's limit at launch — the $0 self-serve plan must not
        // shrink it, so free plans are excluded from this fallback.
        $entry = Plan::query()
            ->where('is_active', true)
            ->where('price', '>', 0)
            ->orderBy('price')
            ->first();

        return (int) ($entry->max_locks ?? 3);
    }

    /** True when max locks is unlimited on the current plan. */
    public function hasUnlimitedLocks(): bool
    {
        return $this->plan !== null && (int) $this->plan->max_locks === 0;
    }

    /**
     * Shopify development / partner test store — these can only ever accept
     * TEST charges, so billing switches to test mode for them automatically.
     *
     * Source of truth is the Admin API's shop.plan.partnerDevelopment boolean
     * (synced into store_details by StoreDetailSync). Name matching is only
     * the fallback for rows synced before that column existed: plan_name
     * holds the human DISPLAY name (e.g. "Basic App Development"), not the
     * machine name, so it is matched loosely.
     */
    public function isDevStore(): bool
    {
        $detail = $this->storeDetail;

        // Authoritative flag from Shopify (null = not synced yet).
        if ($detail && $detail->partner_development !== null) {
            return (bool) $detail->partner_development;
        }

        $planName = strtolower(trim((string) ($detail->plan_name ?? '')));

        if ($planName === '') {
            return false;
        }

        if (in_array($planName, config('plans.dev_store_plans', []), true)) {
            return true;
        }

        // Display-name heuristics: "Basic App Development", "Developer
        // Preview", "Partner Test", … No real merchant plan name contains
        // these words.
        return str_contains($planName, 'development')
            || str_contains($planName, 'developer')
            || str_contains($planName, 'partner');
    }

    /**
     * Drop the stored access token when Shopify rejects it (HTTP 401).
     *
     * VerifyShopify logs a shop straight in while it has a token, and only
     * runs the install / token exchange when the token is empty. A token
     * that Shopify has revoked — e.g. a reinstall that arrived before the
     * queued app/uninstalled job cleared the old one — would otherwise be
     * used forever. Emptying it makes the next app load fetch a fresh one.
     *
     * @param  array|\ArrayAccess  $response  The result of $shop->api()->graph()/rest().
     * @return bool Whether the token was dropped.
     */
    public function forgetRevokedAccessToken($response): bool
    {
        if ((int) ($response['status'] ?? 0) !== 401 || empty($this->password)) {
            return false;
        }

        \Illuminate\Support\Facades\Log::warning('Shopify rejected the access token; cleared it so the next load re-authenticates', [
            'shop_id' => $this->id,
            'shop' => $this->name,
        ]);

        $this->forceFill(['password' => ''])->save();

        return true;
    }
}
