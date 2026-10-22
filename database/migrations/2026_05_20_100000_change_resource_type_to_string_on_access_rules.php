<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The original access_rules.resource_type was an ENUM limited to
     * ['collection','product','page','blog','shop']. Newer lock scopes
     * (checkout, theme, variant) failed to insert with MySQL error 1265
     * "Data truncated for column 'resource_type'". Converting to a plain
     * string removes the truncation risk and lets the controller's
     * validation rule be the single source of truth for allowed values.
     */
    public function up(): void
    {
        Schema::table('access_rules', function (Blueprint $table) {
            $table->string('resource_type', 32)->change();
        });
    }

    public function down(): void
    {
        Schema::table('access_rules', function (Blueprint $table) {
            $table->enum('resource_type', ['collection', 'product', 'page', 'blog', 'shop'])->change();
        });
    }
};
