{{-- Vars: $shopName, $appUrl, $period (e.g. 'this week'), $activeLocks, $protectedItems, $blockedAttempts --}}
@extends('emails.layouts.master')

@section('title', 'Your weekly summary')
@section('icon', '📊')
@section('heading', 'Your weekly lock report')
@section('subheading', 'Here\'s how your store stayed protected ' . $period . '.')

@section('content')
    <p style="margin: 0 0 14px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, here's a quick snapshot of your {{ config('app.name') }}
        activity {{ $period }}.
    </p>

    @include('emails.partials.stats', [
        'stats' => [
            ['label' => 'Active locks', 'value' => number_format($activeLocks ?? 0), 'accent' => '#1a1d21'],
            ['label' => 'Protected items', 'value' => number_format($protectedItems ?? 0), 'accent' => '#008060'],
            ['label' => 'Blocked attempts', 'value' => number_format($blockedAttempts ?? 0), 'accent' => '#c2410c'],
        ],
    ])

    @include('emails.partials.note', [
        'tone' => 'success',
        'text' => 'Your locks are doing their job. Open the app anytime to review activity or adjust your rules.',
    ])

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'View dashboard'])
@endsection
