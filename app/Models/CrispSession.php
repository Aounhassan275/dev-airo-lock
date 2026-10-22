<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One Crisp conversation token per (shop, Shopify staff user). See
 * App\Support\CrispIdentity for how it is resolved and why.
 */
class CrispSession extends Model
{
    protected $guarded = ['id'];

    /**
     * Change User::class here if this app's shop model is named differently.
     */
    public function shop(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
