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
        Schema::create('access_rules', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('shop_id');
            $table->unsignedBigInteger('lock_id');
            $table->string('handle')->nullable();
            $table->enum('resource_type', ['collection', 'product', 'page', 'blog', 'shop']);
            $table->json('conditions')->nullable();
            $table->text('prompt')->nullable();
            $table->string('redirect_url')->nullable();
            $table->boolean('enabled')->default(true);
            $table->boolean('protect_products')->default(true);
            $table->boolean('hide_navigation')->default(false);
            $table->boolean('hide_lists')->default(false);
            $table->boolean('force_open')->default(false);
            $table->timestamps();
            $table->unique(['shop_id', 'resource_type', 'handle']);
            $table->foreign('shop_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('access_rules');
    }
};
