{{-- Vars: $shopName, $appUrl, $period (e.g. 'last 7 days'), $deniedCount, $allowedCount?, $topLock? --}}
@extends('emails.layouts.master')

@section('title', 'Access activity summary')
@section('icon', '🛡️')
@section('heading', 'Your access activity')
@section('subheading', 'A summary of blocked attempts in the ' . $period . '.')

@section('content')
    <p style="margin: 0 0 14px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, here's how your locks performed over the {{ $period }}.
    </p>

    @include('emails.partials.stats', [
        'stats' => array_values(array_filter([
            ['label' => 'Blocked attempts', 'value' => number_format($deniedCount ?? 0), 'accent' => '#c2410c'],
            isset($allowedCount) ? ['label' => 'Granted', 'value' => number_format($allowedCount), 'accent' => '#008060'] : null,
        ])),
    ])

    @if (!empty($topLock))
        @include('emails.partials.note', [
            'tone' => 'info',
            'text' => 'Most active lock: “' . $topLock . '”. It blocked the highest number of access attempts this period.',
        ])
    @endif

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'View full access log'])
@endsection
