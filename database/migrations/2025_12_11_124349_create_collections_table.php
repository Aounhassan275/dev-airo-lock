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
        Schema::create('collections', function (Blueprint $table) {
            $table->id();

            // Shopify GID e.g. gid://shopify/Collection/123456
            $table->string('shopify_collection_id')->unique();

            // Which store this collection belongs to
            $table->unsignedBigInteger('shop_id')->index();

            $table->string('title');
            $table->string('handle')->nullable();

            // Number of products inside the collection
            $table->integer('products_count')->default(0);

            // In case you expand later
            $table->json('metafields')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('collections');
    }
};
