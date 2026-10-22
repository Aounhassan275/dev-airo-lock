<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tracks which one-off lifecycle emails have already been sent for a lock so
 * the per-minute scheduler never re-notifies (activation + expiry reminder).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locks', function (Blueprint $table) {
            $table->timestamp('activation_notified_at')->nullable()->after('expires_at');
            $table->timestamp('expiry_reminder_sent_at')->nullable()->after('activation_notified_at');
        });
    }

    public function down(): void
    {
        Schema::table('locks', function (Blueprint $table) {
            $table->dropColumn(['activation_notified_at', 'expiry_reminder_sent_at']);
        });
    }
};
