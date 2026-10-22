<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class Widget extends Model
{
    protected $fillable = ['user_id', 'name', 'type', 'configuration', 'is_active'];

    protected $casts = [
        'configuration' => 'array',
        'is_active' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Accessor for design options
    public function getDesignOptionsAttribute()
    {
        return $this->configuration['designOptions'] ?? null;
    }

    // Accessor for fields (form widgets)
    public function getFieldsAttribute()
    {
        return $this->configuration['fields'] ?? null;
    }

    // Scope for active widgets
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    // Scope for inactive widgets
    public function scopeInactive($query)
    {
        return $query->where('is_active', false);
    }

    // Scope for widget type
    public function scopeOfType($query, $type)
    {
        return $query->where('type', $type);
    }

    public function setConfigurationAttribute($value)
    {
        if (is_array($value)) {
            $image = $value['designOptions']['background']['image'] ?? null;
            if (is_string($image) && str_starts_with($image, 'data:image/')) {
                if (preg_match('/^data:image\/(\w+);base64,(.+)$/', $image, $matches)) {
                    $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
                    $imageData = base64_decode($matches[2]);
                    if ($imageData !== false) {
                        $oldImage = null;
                        $currConfig = $this->configuration;
                        if (is_array($currConfig)) {
                            $oldImage = $currConfig['designOptions']['background']['image'] ?? null;
                        }
                        if ($oldImage && is_string($oldImage) && !str_starts_with($oldImage, 'data:')) {
                            $parts = explode('/storage/', $oldImage, 2);
                            $relativePath = $parts[1] ?? null;
                            if ($relativePath && Storage::disk('public')->exists($relativePath)) {
                                Storage::disk('public')->delete($relativePath);
                            }
                        }
                        $directory = 'widget_images/' . Auth::id();
                        Storage::disk('public')->makeDirectory($directory);
                        $filename = $directory . '/' . time() . '_' . uniqid() . '.' . $extension;
                        Storage::disk('public')->put($filename, $imageData);
                        $value['designOptions']['background']['image'] = asset('storage/' . $filename);
                    }
                }
            }
        }
        $this->attributes['configuration'] = json_encode($value);
    }
}
