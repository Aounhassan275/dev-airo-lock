<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Eloquent\Model;

class Lock extends Model
{
    //
    protected $fillable = [
        'shop_id',
        'name',
        'description',
        'handle',
        'status',
        'type',
        'starts_at',
        'expires_at',
        'widget_id',
        'text_widget_id',
        'popup_text',
        'reprompt',
        'allow_email_request',
        'seo_block',
        'activation_notified_at',
        'expiry_reminder_sent_at',
    ];

    protected $casts = [
        'status' => 'boolean',
        'allow_email_request' => 'boolean',
        'seo_block' => 'boolean',
        'starts_at' => 'datetime',
        'expires_at' => 'datetime',
        'activation_notified_at' => 'datetime',
        'expiry_reminder_sent_at' => 'datetime',
        'popup_text' => 'array',
    ];

    public function accessRules()
    {
        return $this->hasMany(AccessRule::class);
    }

    /**
     * Whether the lock is enabled AND currently inside its scheduled window.
     * Used to gate checkout-rule metafield writes server-side, because the
     * checkout validation Function (WASM) has no reliable clock. Storefront
     * resource types instead carry starts_at/expires_at in the payload and
     * gate client-side, so they do not use this.
     */
    public function isCurrentlyActive(): bool
    {
        if (!$this->status) {
            return false;
        }
        $now = now();
        if ($this->starts_at && $this->starts_at->gt($now)) {
            return false;
        }
        if ($this->expires_at && $this->expires_at->lte($now)) {
            return false;
        }
        return true;
    }

    /**
     * Give every lock in the collection a `resource_types` attribute —
     * [['type' => 'product', 'count' => 3], ['type' => 'page', 'count' => 1]],
     * biggest group first — so the UI can say what a lock actually protects
     * instead of labelling everything "Standard".
     *
     * One grouped query for the whole collection; rules themselves are never
     * loaded, since a lock may hold hundreds of them.
     */
    public static function attachResourceTypes(EloquentCollection $locks): EloquentCollection
    {
        if ($locks->isEmpty()) {
            return $locks;
        }

        $grouped = AccessRule::whereIn('lock_id', $locks->pluck('id'))
            ->selectRaw('lock_id, resource_type, COUNT(*) as total')
            ->groupBy('lock_id', 'resource_type')
            ->get()
            ->groupBy('lock_id');

        return $locks->each(function (self $lock) use ($grouped) {
            $lock->setAttribute('resource_types', collect($grouped->get($lock->id, []))
                ->map(fn ($row) => ['type' => $row->resource_type, 'count' => (int) $row->total])
                ->sortByDesc('count')
                ->values()
                ->all());
        });
    }

    public function shop()
    {
        return $this->belongsTo(User::class, 'shop_id');
    }

    public function widget()
    {
        return $this->belongsTo(Widget::class);
    }

    public function textWidget()
    {
        return $this->belongsTo(Widget::class, 'text_widget_id');
    }
}
