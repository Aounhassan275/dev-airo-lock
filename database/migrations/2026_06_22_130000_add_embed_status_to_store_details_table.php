<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Records each store's last-known storefront app-embed state so support can
     * see at a glance (in the admin "Stores" list) which merchants have the
     * Airo Lock theme embed enabled. Written by ThemeExtensionService on each
     * (uncached) check.
     */
    public function up(): void
    {
        Schema::table('store_details', function (Blueprint $table) {
            $table->boolean('embed_enabled')->nullable()->after('weight_unit');
            $table->string('embed_reason')->nullable()->after('embed_enabled');
            $table->timestamp('embed_checked_at')->nullable()->after('embed_reason');
        });
    }

    public function down(): void
    {
        Schema::table('store_details', function (Blueprint $table) {
            $table->dropColumn(['embed_enabled', 'embed_reason', 'embed_checked_at']);
        });
    }
};
