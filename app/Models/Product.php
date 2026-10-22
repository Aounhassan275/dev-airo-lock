<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Variant; // Import Variant class

class Product extends Model
{
    public function variants()
    {
        return $this->hasMany(Variant::class, 'shopify_product_id', 'shopify_product_id');
    }
    protected $fillable = [
        'shop_id',
        'shopify_product_id',
        'title',
        'handle',
        'vendor',
        'product_type',
        'image_url',
        'tags',
        'category',
    ];

    protected $casts = [
        'tags' => 'array',
    ];
}
