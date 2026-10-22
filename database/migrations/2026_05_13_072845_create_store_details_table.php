<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('store_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('shop_id')->nullable();
            $table->string('shop_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->text('description')->nullable();
            $table->string('plan_name')->nullable();
            $table->boolean('shopify_plus')->default(false);
            $table->string('shopify_domain')->nullable();
            $table->string('primary_domain')->nullable();
            $table->string('currency')->nullable();
            $table->string('country')->nullable();
            $table->string('iana_timezone')->nullable();
            $table->string('money_format')->nullable();
            $table->string('weight_unit')->nullable();
            $table->dateTime('shopify_created_at')->nullable();
            $table->dateTime('shopify_updated_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('store_details');
    }
};
