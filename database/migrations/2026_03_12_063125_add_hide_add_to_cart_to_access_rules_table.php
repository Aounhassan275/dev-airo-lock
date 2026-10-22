<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('access_rules', function (Blueprint $table) {
            $table->boolean('hide_add_to_cart')->default(false)->after('hide_price');
        });
    }

    public function down(): void
    {
        Schema::table('access_rules', function (Blueprint $table) {
            $table->dropColumn('hide_add_to_cart');
        });
    }
};
