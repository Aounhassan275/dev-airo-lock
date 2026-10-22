<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StoreDetail extends Model
{
    protected $fillable = [
        'user_id',
        'shop_id',
        'shop_name',
        'email',
        'phone',
        'description',
        'plan_name',
        'partner_development',
        'shopify_plus',
        'shopify_domain',
        'primary_domain',
        'currency',
        'country',
        'primary_locale',
        'shop_locales',
        'locales_synced_at',
        'iana_timezone',
        'money_format',
        'weight_unit',
        'shopify_created_at',
        'shopify_updated_at',
        'embed_enabled',
        'embed_reason',
        'embed_checked_at',
        'store_status',
        'store_status_reason',
        'store_status_changed_at',
        'store_status_checked_at',
        'uninstalled_at',
    ];

    protected $casts = [
        'partner_development' => 'boolean',
        'shop_locales' => 'array',
        'locales_synced_at' => 'datetime',
        'embed_enabled' => 'boolean',
        'embed_checked_at' => 'datetime',
        'store_status_changed_at' => 'datetime',
        'store_status_checked_at' => 'datetime',
        'uninstalled_at' => 'datetime',
    ];

    public const STATUS_ACTIVE = 'active';
    public const STATUS_UNINSTALLED = 'uninstalled';
    public const STATUS_CLOSED = 'closed';
    public const STATUS_FROZEN = 'frozen';

    /** Statuses under which a shop cannot generate revenue. */
    public const DEAD_STATUSES = [
        self::STATUS_UNINSTALLED,
        self::STATUS_CLOSED,
        self::STATUS_FROZEN,
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Record an observed lifecycle state. `changed_at` only moves when the
     * status actually flips (it drives the churn stats); `checked_at` is the
     * verification heartbeat and moves on every call.
     */
    public function applyStoreStatus(string $status, string $reason): void
    {
        $now = now();
        $flipped = $this->store_status !== $status;

        $this->forceFill([
            'store_status' => $status,
            'store_status_reason' => $reason,
            'store_status_checked_at' => $now,
            'store_status_changed_at' => $flipped ? $now : ($this->store_status_changed_at ?? $now),
            'uninstalled_at' => $status === self::STATUS_UNINSTALLED
                ? ($this->uninstalled_at ?? $now)
                : null,
        ])->save();
    }
}
