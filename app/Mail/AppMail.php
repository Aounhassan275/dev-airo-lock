<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Generic transactional email.
 *
 * Renders one of the resources/views/emails/*.blade.php templates with the
 * given data. Queued (database queue) so SMTP latency never blocks a request.
 * All sends are funnelled through App\Services\MailService.
 */
class AppMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    /**
     * Transient SMTP failures (rate limiting during bulk sends, dropped
     * connections) auto-retry with growing delays instead of landing in
     * failed_jobs on the first error.
     */
    public $tries = 3;

    public $backoff = [90, 600];

    /**
     * @param  string  $template  Blade view name under emails.* (e.g. "welcome")
     * @param  string  $heading  Email subject line
     * @param  array  $data  Variables passed to the template
     */
    public function __construct(
        public string $template,
        public string $heading,
        public array $data = [],
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->heading);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.'.$this->template,
            with: $this->data,
        );
    }
}
