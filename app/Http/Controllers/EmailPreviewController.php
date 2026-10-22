<?php

namespace App\Http\Controllers;

use App\Support\EmailSamples;

/**
 * Renders the transactional email templates with representative sample data so
 * the designs can be eyeballed in a browser. Only routed when APP_DEBUG is on
 * (see routes/web.php) — never exposed in production.
 */
class EmailPreviewController extends Controller
{
    public function index()
    {
        $links = collect(array_keys(EmailSamples::all()))
            ->map(fn ($t) => '<li style="margin:6px 0"><a href="' . url('/emails/preview/' . $t) . '">' . $t . '</a></li>')
            ->implode('');

        return '<html><body style="font-family:sans-serif;padding:32px">'
            . '<h2>Email previews</h2><ul style="line-height:1.7">' . $links . '</ul></body></html>';
    }

    public function show(string $template)
    {
        $samples = EmailSamples::all();

        abort_unless(isset($samples[$template]), 404, 'Unknown template');

        return view('emails.' . $template, $samples[$template]);
    }
}
