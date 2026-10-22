{{-- Vars: $shopName, $appUrl, $planName, $lockLimit, $usedLocks --}}
@extends('emails.layouts.master')

@section('title', 'You\'ve reached your lock limit')
@section('icon', '📦')
@section('heading', 'You\'ve hit your plan limit')
@section('subheading', 'Upgrade to keep creating locks.')

@section('content')
    <p style="margin: 0 0 14px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, you've used all the locks included in your
        <strong>{{ $planName }}</strong> plan. To create more, upgrade to a higher plan.
    </p>

    @include('emails.partials.stats', [
        'stats' => [
            ['label' => 'Locks used', 'value' => number_format($usedLocks ?? 0), 'accent' => '#c2410c'],
            ['label' => 'Plan limit', 'value' => number_format($lockLimit ?? 0), 'accent' => '#1a1d21'],
        ],
    ])

    @include('emails.partials.note', [
        'tone' => 'info',
        'text' => 'Your existing locks keep working as normal. Upgrading simply lets you protect more content.',
    ])

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'Upgrade plan'])
@endsection
