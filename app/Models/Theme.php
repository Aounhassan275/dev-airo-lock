<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Theme extends Model
{
    //
    protected $fillable = [
        'shop_id',
        'shopify_theme_id',
        'name',
        'role',
    ];
}
