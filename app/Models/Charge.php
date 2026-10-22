<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Osiset\ShopifyApp\Storage\Models\Charge as BaseCharge;

/**
 * App charge model — adds the shop relation so the admin panel can show
 * which merchant each charge belongs to.
 */
class Charge extends BaseCharge
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
