<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * This migration removes the unique constraint on access_rules table
     * to allow multiple locks to target the same resource (product, collection, page, blog).
     * 
     * Note: We need to drop and recreate the foreign key because it depends on the unique index.
     */
    public function up(): void
    {
        Schema::table('access_rules', function (Blueprint $table) {
            // First, drop the foreign key constraint that depends on the unique index
            $table->dropForeign(['shop_id']);
        });

        Schema::table('access_rules', function (Blueprint $table) {
            // Now drop the unique constraint
            $table->dropUnique(['shop_id', 'resource_type', 'handle']);
        });

        Schema::table('access_rules', function (Blueprint $table) {
            // Recreate the foreign key constraint
            $table->foreign('shop_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('access_rules', function (Blueprint $table) {
            // Drop the foreign key first
            $table->dropForeign(['shop_id']);
        });

        Schema::table('access_rules', function (Blueprint $table) {
            // Restore the unique constraint
            // Note: This will fail if there are multiple rules for the same resource
            $table->unique(['shop_id', 'resource_type', 'handle']);
        });

        Schema::table('access_rules', function (Blueprint $table) {
            // Recreate the foreign key
            $table->foreign('shop_id')->references('id')->on('users')->onDelete('cascade');
        });
    }
};
