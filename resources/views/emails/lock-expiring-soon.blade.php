{{-- Vars: $shopName, $appUrl, $lockName, $itemCount, $expiresAt, $timeLeft (e.g. '24 hours') --}}
@extends('emails.layouts.master')

@section('title', 'Lock expiring soon')
@section('icon', '⏰')
@section('heading', 'A lock is about to expire')
@section('subheading', '“' . $lockName . '” expires in ' . $timeLeft . '.')

@section('content')
    <p style="margin: 0 0 14px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, a heads-up that your lock <strong>{{ $lockName }}</strong>
        is scheduled to expire {{ !empty($expiresAt) ? 'on ' . $expiresAt : 'soon' }}. Once it does, the
        protected content will become publicly visible.
    </p>

    @include('emails.partials.stats', [
        'stats' => [
            ['label' => 'Protected items', 'value' => number_format($itemCount ?? 0), 'accent' => '#008060'],
            ['label' => 'Expires in', 'value' => $timeLeft, 'accent' => '#c2410c'],
        ],
    ])

    @include('emails.partials.note', [
        'tone' => 'warning',
        'text' => 'Want to keep this content protected? Extend the expiry date or remove it before the lock expires.',
    ])

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'Extend or edit lock'])
@endsection
