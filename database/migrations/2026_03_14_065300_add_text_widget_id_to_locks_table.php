<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('locks', function (Blueprint $table) {
            $table->unsignedBigInteger('text_widget_id')->nullable()->after('widget_id');
            $table->foreign('text_widget_id')->references('id')->on('widgets')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('locks', function (Blueprint $table) {
            $table->dropForeign(['text_widget_id']);
            $table->dropColumn('text_widget_id');
        });
    }
};
