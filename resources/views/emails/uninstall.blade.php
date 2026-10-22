{{-- Vars: $shopName, $appUrl --}}
@extends('emails.layouts.master')

@section('title', 'Sorry to see you go')
@section('icon', '👋')
@section('heading', 'You\'re always welcome back')
@section('subheading', config('app.name') . ' has been uninstalled.')

@section('content')
    <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, we've removed <strong>{{ config('app.name') }}</strong>
        from your store and unlocked any content that was protected. Thank you for giving us a try.
    </p>

    @include('emails.partials.note', [
        'tone' => 'info',
        'text' => 'Was a feature missing or did something not work as expected? We genuinely want to know — your feedback helps us improve.',
    ])

    <p style="margin: 0 0 26px; font-size: 14px; line-height: 1.6; color: #44474a;">
        If you change your mind, you can reinstall anytime and pick up right where you left off.
        We'd love to have you back.
    </p>

    @include('emails.partials.button', ['url' => 'mailto:' . config('mail.from.address') . '?subject=Feedback%20on%20' . rawurlencode(config('app.name')), 'label' => 'Tell us what went wrong'])
@endsection
