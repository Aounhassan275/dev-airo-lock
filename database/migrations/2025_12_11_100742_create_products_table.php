<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            // This links multiple shops
            $table->unsignedBigInteger('shop_id')->index();
            // Shopify uses a global ID (gid://shopify/Product/xx)
            $table->string('shopify_product_id');

            $table->string('title');
            $table->string('vendor')->nullable();
            $table->string('handle')->nullable();
            $table->string('product_type')->nullable();

            // image URL from MediaImage
            $table->string('image_url')->nullable();
            // store tags as JSON (best for filtering)
            $table->json('tags')->nullable();

            // if you want category, keep NULLable
            $table->string('category')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
