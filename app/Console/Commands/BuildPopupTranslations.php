<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Process;

/**
 * Regenerates resources/lang/popup_translations.json from the storefront
 * catalog in extensions/access-controll/assets/access_i18n.js.
 *
 * The JS file stays the single source of truth — it is what the storefront
 * loads. PHP needs the same strings so it can resolve popup text at
 * metafield-write time, and copying them by hand would guarantee drift.
 * Run this after editing the catalog:
 *
 *   php artisan popup:build-translations
 */
class BuildPopupTranslations extends Command
{
    protected $signature = 'popup:build-translations';

    protected $description = 'Regenerate the PHP popup translation catalog from access_i18n.js';

    public function handle(): int
    {
        $source = base_path('extensions/access-controll/assets/access_i18n.js');
        $target = base_path('resources/lang/popup_translations.json');

        if (! file_exists($source)) {
            $this->error("Catalog not found: {$source}");

            return self::FAILURE;
        }

        // Evaluating the real asset (rather than parsing it) guarantees the
        // PHP copy matches exactly what the storefront will resolve.
        $script = <<<'JS'
        require(process.argv[1]);
        const I = globalThis.AccessI18n;
        process.stdout.write(JSON.stringify({
            _generated: 'php artisan popup:build-translations — do not edit by hand',
            strings: I.strings,
        }, null, 2) + "\n");
        JS;

        $result = Process::run(['node', '-e', $script, $source]);

        if (! $result->successful()) {
            $this->error('node failed: '.$result->errorOutput());

            return self::FAILURE;
        }

        file_put_contents($target, $result->output());

        $count = count(json_decode($result->output(), true)['strings'] ?? []);
        $this->info("Wrote {$target} ({$count} locales).");

        return self::SUCCESS;
    }
}
