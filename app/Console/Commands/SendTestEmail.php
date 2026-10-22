<?php

namespace App\Console\Commands;

use App\Mail\AppMail;
use App\Support\EmailSamples;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Sends a real email through the configured SMTP transport using sample data,
 * to verify mailer credentials and template rendering.
 *
 *   php artisan mail:test you@example.com                 # sends "welcome"
 *   php artisan mail:test you@example.com lock-created    # sends a specific template
 *   php artisan mail:test you@example.com all             # sends every template
 */
class SendTestEmail extends Command
{
    protected $signature = 'mail:test {email : Recipient address} {template=welcome : Template name or "all"}';

    protected $description = 'Send a sample transactional email to verify the mailer and templates';

    public function handle(): int
    {
        $email = $this->argument('email');
        $template = $this->argument('template');
        $samples = EmailSamples::all();

        $targets = $template === 'all'
            ? array_keys($samples)
            : [$template];

        foreach ($targets as $name) {
            if (! isset($samples[$name])) {
                $this->error("Unknown template: {$name}");
                $this->line('Available: '.implode(', ', array_keys($samples)));

                return self::FAILURE;
            }

            $subject = '[Test] '.Str::headline($name);

            try {
                // sendNow bypasses the queue so the result is immediate.
                Mail::to($email)->sendNow(new AppMail($name, $subject, $samples[$name] + ['preheader' => $subject]));
                $this->info("Sent {$name} → {$email}");
            } catch (\Throwable $e) {
                $this->error("Failed {$name}: ".$e->getMessage());

                return self::FAILURE;
            }
        }

        return self::SUCCESS;
    }
}
