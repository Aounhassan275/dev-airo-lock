<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Telescope is gone (it was a production dependency, recording every request,
 * query and cache hit with no pruning — 6.6M rows / 5.3 GiB, about 96% of this
 * database). Drop its tables.
 *
 * DROP is what actually returns the disk: each table has its own tablespace, so
 * the .ibd file goes with it. Deleting rows would not have shrunk anything.
 *
 * Those rows were also a liability: TelescopeServiceProvider only redacted
 * cookies and CSRF headers outside the local environment, and the box was
 * running as local — so request headers, form payloads (lock passcodes are
 * submitted as form data) and SQL bindings were being stored in the clear.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Child first — telescope_entries_tags has an FK onto telescope_entries.
        Schema::dropIfExists('telescope_entries_tags');
        Schema::dropIfExists('telescope_entries');
        Schema::dropIfExists('telescope_monitoring');
    }

    public function down(): void
    {
        // No way back: the package is no longer installed, so there is nothing
        // to recreate these for. Reinstall laravel/telescope to get them back.
    }
};
