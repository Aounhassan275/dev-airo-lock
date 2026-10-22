<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Authoritative dev-store flag from the Shopify Admin API
     * (shop.plan.partnerDevelopment). plan_name only carries the human
     * display name ("Basic App Development"), which is unreliable for
     * detecting dev stores — this boolean is what actually decides whether
     * billing must use TEST charges. Nullable: null = not synced yet, fall
     * back to plan-name matching.
     */
    public function up(): void
    {
        Schema::table('store_details', function (Blueprint $table) {
            if (! Schema::hasColumn('store_details', 'partner_development')) {
                $table->boolean('partner_development')->nullable()->after('plan_name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('store_details', function (Blueprint $table) {
            if (Schema::hasColumn('store_details', 'partner_development')) {
                $table->dropColumn('partner_development');
            }
        });
    }
};
