<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * This migration converts the status field from string to boolean
     * and migrates existing data.
     */
    public function up(): void
    {
        // First, migrate existing data to boolean-compatible values
        // Convert 'Active' to '1', 'Inactive' to '0', and any other value to '0'
        DB::table('locks')->where('status', 'Active')->update(['status' => '1']);
        DB::table('locks')->where('status', 'Inactive')->update(['status' => '0']);
        DB::table('locks')->where('status', 'true')->update(['status' => '1']);
        DB::table('locks')->where('status', 'false')->update(['status' => '0']);

        // Set any remaining non-boolean values to false (0)
        DB::table('locks')
            ->whereNotIn('status', ['0', '1'])
            ->update(['status' => '0']);

        // Now change the column type to boolean
        Schema::table('locks', function (Blueprint $table) {
            $table->boolean('status')->default(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Convert back to string
        Schema::table('locks', function (Blueprint $table) {
            $table->string('status')->change();
        });

        // Convert boolean values back to string representations
        DB::table('locks')->where('status', '1')->update(['status' => 'Active']);
        DB::table('locks')->where('status', '0')->update(['status' => 'Inactive']);
    }
};
