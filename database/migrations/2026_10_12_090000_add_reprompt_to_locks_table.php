<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * How long a visitor stays unlocked once they pass a lock.
     *
     * Until now this was hard-coded: the storefront writes a 'granted' flag to
     * localStorage, so a customer who enters the passcode once is never asked
     * again on that browser. That is right for most locks and wrong for the
     * ones merchants use for genuinely sensitive content, where they want the
     * credential demanded again.
     *
     *   remember (default) — current behaviour, unchanged for every existing lock
     *   session            — re-ask on a new visit, but not while browsing
     *   always             — re-ask on every page load
     *
     * Defaulting to 'remember' is what keeps this migration safe: no existing
     * lock changes behaviour until a merchant chooses otherwise.
     */
    public function up(): void
    {
        Schema::table('locks', function (Blueprint $table) {
            $table->string('reprompt', 20)->default('remember')->after('popup_text');
        });
    }

    public function down(): void
    {
        Schema::table('locks', function (Blueprint $table) {
            $table->dropColumn('reprompt');
        });
    }
};
