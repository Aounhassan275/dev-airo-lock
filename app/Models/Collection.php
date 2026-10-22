<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Collection extends Model
{
     protected $fillable = [
        'shop_id', 'shopify_collection_id', 'title',
        'handle', 'products_count'
    ];
}
