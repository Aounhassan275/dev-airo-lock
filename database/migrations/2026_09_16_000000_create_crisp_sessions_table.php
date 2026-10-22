<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Rename this file with today's date before running it, e.g.
 * 2026_09_15_100001_create_crisp_sessions_table.php
 */

/**
 * Crisp session tokens, one per (shop, Shopify staff user).
 *
 * The app runs in the Shopify admin iframe, where Crisp's own session storage
 * is third-party and gets cleared between visits, so support saw a new
 * conversation every time. Handing Crisp a stable CRISP_TOKEN_ID fixes that.
 *
 * The token is keyed on the staff user (the session token's `sub`), not just
 * the shop, so that anyone else with admin or collaborator access — staff, an
 * agency, our own support — gets their own session instead of resuming the
 * merchant's conversation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('crisp_sessions', function (Blueprint $table) {
            $table->id();

            // `constrained()` assumes the shops table is `users` (the default
            // for laravel-shopify). If this app stores shops elsewhere, point
            // it there: ->constrained('shops').
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->string('shopify_user_id');  // session token `sub`
            $table->uuid('token')->unique();
            $table->timestamps();

            $table->unique(['user_id', 'shopify_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crisp_sessions');
    }
};
