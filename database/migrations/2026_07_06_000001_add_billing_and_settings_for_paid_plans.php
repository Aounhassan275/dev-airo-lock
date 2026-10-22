<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Paid-plans launch: admin key/value settings store, plan presentation
     * fields, per-shop billing flags, and a one-time reset of the free-period
     * freemium flag so every merchant goes through plan selection.
     */
    public function up(): void
    {
        if (! Schema::hasTable('settings')) {
            Schema::create('settings', function (Blueprint $table) {
                $table->id();
                $table->string('key')->unique();
                $table->text('value')->nullable();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('plans')) {
            Schema::table('plans', function (Blueprint $table) {
                if (! Schema::hasColumn('plans', 'is_popular')) {
                    $table->boolean('is_popular')->default(false)->after('on_install');
                }
                if (! Schema::hasColumn('plans', 'description')) {
                    $table->string('description')->nullable()->after('is_popular');
                }
            });
        }

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'allow_test_charges')) {
                // Admin override: force Shopify test charges for this shop.
                $table->boolean('allow_test_charges')->default(false)->after('shopify_freemium');
            }
            if (! Schema::hasColumn('users', 'quota_notified_at')) {
                // When the "lock limit reached" email was last sent (de-dupes it).
                $table->timestamp('quota_notified_at')->nullable();
            }
            if (! Schema::hasColumn('users', 'trial_reminder_sent_at')) {
                // When the "trial ending soon" email was sent for the current charge.
                $table->timestamp('trial_reminder_sent_at')->nullable();
            }
        });

        // Free-period cleanup: every install got shopify_freemium=1 while the
        // app was free (SHOPIFY_BILLING_FREEMIUM_ENABLED=true). Reset it so the
        // plan gate applies to everyone. Admins can re-grant free access per
        // shop from the admin panel (Merchants → Free access).
        DB::table('users')->where('shopify_freemium', 1)->update(['shopify_freemium' => 0]);
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');

        if (Schema::hasTable('plans')) {
            Schema::table('plans', function (Blueprint $table) {
                foreach (['is_popular', 'description'] as $column) {
                    if (Schema::hasColumn('plans', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        Schema::table('users', function (Blueprint $table) {
            foreach (['allow_test_charges', 'quota_notified_at', 'trial_reminder_sent_at'] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
