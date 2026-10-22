<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Product; // Import Product class

class Variant extends Model
{
    public function product()
    {
        return $this->belongsTo(Product::class, 'shopify_product_id', 'shopify_product_id');
    }
    //
    protected $fillable = [
        'shop_id',
        'shopify_product_id',
        'variant_id',
        'title',
    ];
    protected $casts = [
        'variants' => 'array',
    ];
}
