<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Simple cached key/value store for app-level admin settings
 * (e.g. billing test mode). Values are JSON-encoded.
 */
class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    public static function get(string $key, mixed $default = null): mixed
    {
        $value = Cache::remember("setting:{$key}", 300, function () use ($key) {
            $row = static::where('key', $key)->first();

            // Wrap so a stored `null` is distinguishable from "no row".
            return $row ? json_encode(['v' => json_decode($row->value, true)]) : null;
        });

        if ($value === null) {
            return $default;
        }

        return json_decode($value, true)['v'] ?? $default;
    }

    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => json_encode($value)]);
        Cache::forget("setting:{$key}");
    }
}
