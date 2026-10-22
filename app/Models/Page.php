<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Page extends Model
{
    protected $fillable = [
        'shop_id', 'shopify_page_id', 'title', 'handle',
    ];
}
