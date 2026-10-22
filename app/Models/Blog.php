<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Blog extends Model
{
    protected $fillable = [
        'shop_id', 'shopify_blog_id', 'title', 'handle',
    ];
}
