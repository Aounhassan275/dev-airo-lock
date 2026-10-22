<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Onboarding extends Model
{
    protected $fillable = [
        'user_id',
        'status',
    ];

    protected $casts = [
        'status' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isCompleted(): bool
    {
        return $this->status === 1;
    }

    public function markAsCompleted(): void
    {
        $this->update(['status' => 1]);
    }
}
