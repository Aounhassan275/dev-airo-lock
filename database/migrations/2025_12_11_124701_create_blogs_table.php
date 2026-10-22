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
        Schema::create('blogs', function (Blueprint $table) {
            $table->id();

            // gid://shopify/Blog/xxxx
            $table->string('shopify_blog_id')->unique();

            // Multi-shop support
            $table->unsignedBigInteger('shop_id')->index();

            $table->string('title');
            $table->string('handle')->nullable();

            // If you want to store articles later
            $table->integer('articles_count')->default(0);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('blogs');
    }
};
