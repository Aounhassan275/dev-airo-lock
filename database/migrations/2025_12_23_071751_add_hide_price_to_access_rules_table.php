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
        Schema::table('access_rules', function (Blueprint $table) {
            if (!Schema::hasColumn('access_rules', 'hide_price')) {
                $table->boolean('hide_price')->default(false);
            }
            if (!Schema::hasColumn('access_rules', 'price_message')) {
                $table->text('price_message')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('access_rules', function (Blueprint $table) {
            if (Schema::hasColumn('access_rules', 'hide_price')) {
                $table->dropColumn('hide_price');
            }
            if (Schema::hasColumn('access_rules', 'price_message')) {
                $table->dropColumn('price_message');
            }
        });
    }
};
