<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Stamp for the one-time "pricing has launched" announcement email so the
     * billing:launch-announce command is safe to re-run (crashes, batching).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'pricing_launch_notified_at')) {
                $table->timestamp('pricing_launch_notified_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'pricing_launch_notified_at')) {
                $table->dropColumn('pricing_launch_notified_at');
            }
        });
    }
};
