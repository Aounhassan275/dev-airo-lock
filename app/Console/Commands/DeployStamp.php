<?php

namespace App\Console\Commands;

use App\Support\GitInfo;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class DeployStamp extends Command
{
    protected $signature = 'deploy:stamp';

    protected $description = 'Record the currently-deployed git revision to storage/app/deploy.json (called by the deploy webhook).';

    public function handle(): int
    {
        // Priority: explicit DEPLOY_* env vars (set by the deploy script from
        // git) override everything — this gives full fidelity even when the
        // host disables exec()/proc_open. When they're absent, fall back to
        // reading the .git checkout directly, so a bare `php artisan deploy:stamp`
        // still records useful info.
        $git = GitInfo::resolve() ?? [];

        $payload = [
            'commit' => getenv('DEPLOY_SHA') ?: ($git['commit'] ?? null),
            'short' => getenv('DEPLOY_SHORT') ?: ($git['short'] ?? null),
            'branch' => getenv('DEPLOY_BRANCH') ?: ($git['branch'] ?? null),
            'message' => getenv('DEPLOY_MSG') ?: ($git['message'] ?? null),
            'author' => getenv('DEPLOY_AUTHOR') ?: ($git['author'] ?? null),
            'committed_at' => getenv('DEPLOY_CDATE') ?: ($git['committed_at'] ?? null),
            'deployed_at' => gmdate('c'),
        ];

        Storage::disk('local')->put(
            'deploy.json',
            json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );

        $this->info('Deploy stamp written: '.($payload['short'] ?? '?').' on '.($payload['branch'] ?? '?'));

        return self::SUCCESS;
    }
}
