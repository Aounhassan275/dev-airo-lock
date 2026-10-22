<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-lock popup wording.
     *
     * The popup's title, button and placeholders have always come from the
     * WIDGET, which is shared by every lock using it — so a merchant could not
     * word one lock differently without cloning the whole design. This holds
     * the per-lock overrides; anything left blank falls back to the widget, and
     * then to the translated default, exactly as before.
     *
     * JSON rather than columns because the set of popup strings follows the
     * popup, and `locks.description` already covers the message line.
     */
    public function up(): void
    {
        Schema::table('locks', function (Blueprint $table) {
            $table->json('popup_text')->nullable()->after('text_widget_id');
        });
    }

    public function down(): void
    {
        Schema::table('locks', function (Blueprint $table) {
            $table->dropColumn('popup_text');
        });
    }
};
