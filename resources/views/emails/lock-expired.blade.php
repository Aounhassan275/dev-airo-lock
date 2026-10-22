{{-- Vars: $shopName, $appUrl, $lockName, $itemCount, $expiredAt? --}}
@extends('emails.layouts.master')

@section('title', 'Lock expired')
@section('icon', '🔓')
@section('heading', 'Your content is unlocked again')
@section('subheading', '“' . $lockName . '” reached its expiry time.')

@section('content')
    <p style="margin: 0 0 14px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, the timed lock <strong>{{ $lockName }}</strong> has expired
        {{ !empty($expiredAt) ? 'on ' . $expiredAt : '' }} and was automatically removed. The affected content
        is now publicly visible again.
    </p>

    @include('emails.partials.stats', [
        'stats' => [
            ['label' => 'Unlocked items', 'value' => number_format($itemCount ?? 0), 'accent' => '#008060'],
            ['label' => 'Status', 'value' => 'Expired', 'accent' => '#6b7280'],
        ],
    ])

    @include('emails.partials.note', [
        'tone' => 'info',
        'text' => 'This happened automatically based on the schedule you set. Want to keep it protected? Create a new lock anytime.',
    ])

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'Create a new lock'])
@endsection
