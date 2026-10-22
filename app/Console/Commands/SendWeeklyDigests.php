<?php

namespace App\Console\Commands;

use App\Models\AccessLog;
use App\Models\AccessRule;
use App\Models\Lock;
use App\Models\User;
use App\Services\MailService;
use Illuminate\Console\Command;

/**
 * Opt-in weekly summary email for each active shop. Gated behind
 * config('mail.digests') (env MAIL_DIGESTS) so it never sends unless explicitly
 * enabled. Scheduled weekly in routes/console.php.
 */
class SendWeeklyDigests extends Command
{
    protected $signature = 'mail:weekly-digest {--force : Send even when MAIL_DIGESTS is disabled}';

    protected $description = 'Send the weekly lock summary email to active shops';

    public function handle(MailService $mail): int
    {
        if (! config('mail.digests') && ! $this->option('force')) {
            $this->info('Digests are disabled (MAIL_DIGESTS=false). Use --force to override.');

            return self::SUCCESS;
        }

        $since = now()->subWeek();
        $sent = 0;

        User::query()->with('storeDetail')->chunkById(100, function ($shops) use ($mail, $since, &$sent) {
            foreach ($shops as $shop) {
                $activeLocks = Lock::where('shop_id', $shop->id)->where('status', true)->count();

                if ($activeLocks === 0) {
                    continue; // Nothing to report.
                }

                $ruleIds = AccessRule::where('shop_id', $shop->id)->pluck('id');
                $protectedItems = $ruleIds->count();
                $blockedAttempts = AccessLog::whereIn('access_rule_id', $ruleIds)
                    ->where('granted', false)
                    ->where('created_at', '>=', $since)
                    ->count();

                $mail->weeklyDigest($shop, 'this week', $activeLocks, $protectedItems, $blockedAttempts);
                $sent++;
            }
        });

        $this->info("Weekly digest queued for {$sent} shop(s).");

        return self::SUCCESS;
    }
}
