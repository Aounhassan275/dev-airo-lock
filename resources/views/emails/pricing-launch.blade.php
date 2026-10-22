{{-- Vars: $shopName, $appUrl, $pricingUrl, $activeLocks, $freeLockLimit, $planRows = [['name','locks','monthly','annual'], ...], $trialDays --}}
@extends('emails.layouts.master')

@section('title', 'Pricing has launched')
@section('icon', '🚀')
@section('heading', 'Our free period has ended — pricing is live')
@section('subheading', 'Here\'s exactly what changes for your store, and what stays free.')

@section('content')
    <p style="margin: 0 0 22px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, thank you for being one of the early merchants on
        <strong>{{ config('app.name') }}</strong>. Starting today the app moves to paid plans — and as a
        thank-you, <strong>your store keeps free access automatically</strong>. Nothing changes on your
        storefront and nothing is charged unless you choose to upgrade.
    </p>

    <p style="margin: 0 0 10px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">
        Your account today
    </p>

    @include('emails.partials.stats', [
        'stats' => [
            ['label' => 'Your plan', 'value' => 'Free', 'accent' => '#7c3aed'],
            ['label' => 'Your locks — still live', 'value' => number_format($activeLocks), 'accent' => '#008060'],
            ['label' => 'Free lock limit', 'value' => number_format($freeLockLimit), 'accent' => '#1a1d21'],
        ],
    ])

    @include('emails.partials.note', [
        'tone' => 'success',
        'text' => 'Your existing locks are untouched: everything you\'ve locked keeps protecting your storefront exactly as configured. You can enable, disable or delete them anytime — nothing was removed or deactivated.',
    ])

    <p style="margin: 22px 0 8px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">
        How free access works
    </p>
    <ul style="margin: 0 0 22px; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #2b2f33;">
        <li>Lock <strong>products, collections, pages &amp; blogs</strong> with passcode and sign-in rules.</li>
        <li>Up to <strong>{{ $freeLockLimit }} locks</strong> — your existing locks keep running even if you already have more.</li>
        <li>Premium access rules (secret links, customer tags, email rules, age gates, location/IP rules, price hiding, scheduling, variant &amp; store-wide locks) are part of the paid plans.</li>
    </ul>

    <p style="margin: 0 0 10px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">
        Need more? The new plans
    </p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
        style="margin: 0 0 14px; border: 1px solid #e6ece9; border-radius: 12px; border-collapse: separate; overflow: hidden;">
        <tr style="background-color: #f5f8f7;">
            <td style="padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280;">Plan</td>
            <td style="padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280;">Locks</td>
            <td style="padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280;">Price</td>
        </tr>
        @foreach ($planRows as $row)
            <tr>
                <td style="padding: 12px 14px; font-size: 14px; font-weight: 700; color: #1a1d21; border-top: 1px solid #eef2f0;">{{ $row['name'] }}</td>
                <td style="padding: 12px 14px; font-size: 14px; color: #2b2f33; border-top: 1px solid #eef2f0;">{{ $row['locks'] }}</td>
                <td style="padding: 12px 14px; font-size: 14px; color: #2b2f33; border-top: 1px solid #eef2f0;">
                    <strong>{{ $row['monthly'] }}/mo</strong>
                    @if (!empty($row['annual']))
                        <span style="font-size: 12px; color: #6b7280;">(or {{ $row['annual'] }}/yr)</span>
                    @endif
                </td>
            </tr>
        @endforeach
    </table>

    <p style="margin: 0 0 22px; font-size: 13px; line-height: 1.6; color: #6b7280;">
        Every paid plan starts with a <strong>{{ $trialDays }}-day free trial</strong>, and you can cancel
        anytime — billing runs securely through Shopify.
    </p>

    @include('emails.partials.button', ['url' => $pricingUrl ?? ($appUrl ?? config('app.url')), 'label' => 'See plans & pricing'])

    <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.6; color: #6b7280;">
        Questions about the change, or need a hand picking a plan? Just reply to this email — we read everything.
    </p>
@endsection
