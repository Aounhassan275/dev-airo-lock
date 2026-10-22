<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cache the shop's published storefront languages so the widget editor
     * can offer them without a Shopify round-trip on every page load.
     */
    public function up(): void
    {
        Schema::table('store_details', function (Blueprint $table) {
            $table->string('primary_locale', 15)->nullable()->after('country');
            $table->json('shop_locales')->nullable()->after('primary_locale');
            $table->timestamp('locales_synced_at')->nullable()->after('shop_locales');
        });
    }

    public function down(): void
    {
        Schema::table('store_details', function (Blueprint $table) {
            $table->dropColumn(['primary_locale', 'shop_locales', 'locales_synced_at']);
        });
    }
};
