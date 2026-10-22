<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('locks', 'seo_block')) {
            Schema::table('locks', function (Blueprint $table) {
                $table->boolean('seo_block')->default(true)->after('allow_email_request');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('locks', 'seo_block')) {
            Schema::table('locks', function (Blueprint $table) {
                $table->dropColumn('seo_block');
            });
        }
    }
};
