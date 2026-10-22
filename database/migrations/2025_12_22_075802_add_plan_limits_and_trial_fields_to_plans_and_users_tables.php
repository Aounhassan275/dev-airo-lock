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
        // Add fields to plans table if they don't exist
        if (Schema::hasTable('plans')) {
            Schema::table('plans', function (Blueprint $table) {
                if (!Schema::hasColumn('plans', 'max_locks')) {
                    $table->integer('max_locks')->default(3)->after('price');
                }
                if (!Schema::hasColumn('plans', 'trial_days')) {
                    $table->integer('trial_days')->default(14)->after('max_locks');
                }
                if (!Schema::hasColumn('plans', 'is_active')) {
                    $table->boolean('is_active')->default(true)->after('trial_days');
                }
                if (!Schema::hasColumn('plans', 'features')) {
                    $table->json('features')->nullable()->after('is_active');
                }
            });
        }

        // Add fields to users table if they don't exist
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'trial_ends_at')) {
                $table->timestamp('trial_ends_at')->nullable()->after('created_at');
            }
            if (!Schema::hasColumn('users', 'plan_started_at')) {
                $table->timestamp('plan_started_at')->nullable()->after('trial_ends_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('plans')) {
            Schema::table('plans', function (Blueprint $table) {
                $table->dropColumn(['max_locks', 'trial_days', 'is_active', 'features']);
            });
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['trial_ends_at', 'plan_started_at']);
        });
    }
};
