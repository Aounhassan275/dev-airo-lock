<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\MailService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Daily reminder for merchants whose free trial ends soon, so the first real
 * charge never comes as a surprise. Sent once per trial (stamped on the shop,
 * re-armed on every plan activation).
 */
class SendTrialEndingReminders extends Command
{
    protected $signature = 'billing:trial-reminders';

    protected $description = 'Email shops whose plan trial ends within the reminder window';

    public function handle(MailService $mail): int
    {
        $reminderDays = (int) config('plans.trial_reminder_days', 3);
        $sent = 0;

        User::query()
            ->whereNotNull('plan_id')
            ->whereNull('trial_reminder_sent_at')
            ->with(['plan', 'storeDetail'])
            ->each(function (User $shop) use ($mail, $reminderDays, &$sent) {
                $charge = $shop->activePlanCharge();

                if (! $charge || (int) $charge->trial_days <= 0 || ! $charge->trial_ends_on) {
                    return;
                }

                $trialEndsOn = Carbon::parse($charge->trial_ends_on);
                $daysLeft = (int) ceil(now()->diffInDays($trialEndsOn, false));

                // Only inside the reminder window (still in trial, ending soon).
                if ($daysLeft < 0 || $daysLeft > $reminderDays) {
                    return;
                }

                $mail->trialEnding(
                    $shop,
                    $shop->plan?->name ?? 'Your plan',
                    max(0, $daysLeft),
                    $trialEndsOn
                );

                $shop->forceFill(['trial_reminder_sent_at' => now()])->save();
                $sent++;
            });

        $this->info("Trial-ending reminders sent: {$sent}");

        return self::SUCCESS;
    }
}
