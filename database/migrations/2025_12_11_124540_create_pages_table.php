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
        Schema::create('pages', function (Blueprint $table) {
            $table->id();

            // gid://shopify/Page/xxxx
            $table->string('shopify_page_id')->unique();

            // Relation to the store (users table)
            $table->unsignedBigInteger('shop_id')->index();

            $table->string('title');
            $table->string('handle')->nullable();

            // If you want to save body_html later
            // $table->longText('body_html')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pages');
    }
};
