<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Store lifecycle tracking. Shopify only tells us about uninstalls via
 * webhook — a CLOSED or FROZEN store sends nothing, keeps its ACTIVE local
 * charge and plan_id forever, and inflates MRR/paying-shop numbers in the
 * admin. These columns hold the observed lifecycle state; they are written
 * by AppUninstalledJob, StoreDetailSync and the stores:check-status
 * reconcile command.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('store_details', function (Blueprint $table) {
            // active | uninstalled | closed | frozen. Null = never checked.
            $table->string('store_status', 20)->nullable()->after('embed_checked_at');
            // Human-readable source of the current status (webhook / API probe).
            $table->string('store_status_reason')->nullable()->after('store_status');
            // When the status last FLIPPED (drives churn stats) …
            $table->timestamp('store_status_changed_at')->nullable()->after('store_status_reason');
            // … vs. when we last VERIFIED it (reconcile heartbeat).
            $table->timestamp('store_status_checked_at')->nullable()->after('store_status_changed_at');
            $table->timestamp('uninstalled_at')->nullable()->after('store_status_checked_at');
        });

        // Backfill from what we already know: a soft-deleted user row is the
        // package's uninstall marker; everyone else is presumed active until
        // the first reconcile run says otherwise. Per-row loop for the
        // uninstalled set (cross-table UPDATE … SET x = other.col isn't
        // portable to the SQLite test database); the install base is small.
        $uninstalled = DB::table('users')->whereNotNull('deleted_at')->pluck('deleted_at', 'id');
        foreach ($uninstalled as $userId => $deletedAt) {
            DB::table('store_details')->where('user_id', $userId)->update([
                'store_status' => 'uninstalled',
                'store_status_reason' => 'backfill: user soft-deleted',
                'store_status_changed_at' => $deletedAt,
                'uninstalled_at' => $deletedAt,
            ]);
        }

        DB::table('store_details')
            ->whereIn('user_id', DB::table('users')->whereNull('deleted_at')->pluck('id'))
            ->update([
                'store_status' => 'active',
                'store_status_reason' => 'backfill: user active',
            ]);
    }

    public function down(): void
    {
        Schema::table('store_details', function (Blueprint $table) {
            $table->dropColumn([
                'store_status',
                'store_status_reason',
                'store_status_changed_at',
                'store_status_checked_at',
                'uninstalled_at',
            ]);
        });
    }
};
