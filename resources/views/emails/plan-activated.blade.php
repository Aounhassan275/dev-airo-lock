{{-- Vars: $shopName, $appUrl, $planName, $price?, $lockLimit? (null/0 = unlimited) --}}
@extends('emails.layouts.master')

@section('title', 'Your plan is active')
@section('icon', '🚀')
@section('heading', $planName . ' is live!')
@section('subheading', 'Thanks for subscribing — your plan is active.')

@section('content')
    <p style="margin: 0 0 22px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, your subscription to the <strong>{{ $planName }}</strong> plan
        on {{ config('app.name') }} is now active. Here's what you've unlocked:
    </p>

    @include('emails.partials.stats', [
        'stats' => array_values(array_filter([
            ['label' => 'Plan', 'value' => $planName, 'accent' => '#1a1d21'],
            empty($lockLimit)
                ? ['label' => 'Locks', 'value' => '∞', 'accent' => '#008060']
                : ['label' => 'Lock limit', 'value' => number_format($lockLimit), 'accent' => '#008060'],
            !empty($price) ? ['label' => 'Price', 'value' => $price, 'accent' => '#6b7280'] : null,
        ])),
    ])

    @include('emails.partials.note', [
        'tone' => 'success',
        'text' => empty($lockLimit)
            ? 'You can now create unlimited locks and protect as much content as you like.'
            : 'You\'re all set. Create and manage your locks without interruption.',
    ])

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'Start using your plan'])
@endsection
