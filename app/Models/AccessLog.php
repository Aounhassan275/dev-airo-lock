<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccessLog extends Model
{
    protected $fillable = [
        'access_rule_id',
        'customer_id',
        'ip_address',
        'user_agent',
        'granted',
        'reason',
    ];

    protected $casts = [
        'granted' => 'boolean',
    ];

    public function accessRule(): BelongsTo
    {
     return $this->belongsTo(AccessRule::class);
    }
}
