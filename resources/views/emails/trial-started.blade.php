{{-- Vars: $shopName, $appUrl, $planName, $trialDays, $trialEndsAt --}}
@extends('emails.layouts.master')

@section('title', 'Your free trial has started')
@section('icon', '✨')
@section('heading', 'Your ' . $trialDays . '-day trial is on')
@section('subheading', 'Explore every feature, free until ' . $trialEndsAt . '.')

@section('content')
    <p style="margin: 0 0 22px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, your free trial of the <strong>{{ $planName }}</strong> plan
        on {{ config('app.name') }} is now active. Take it for a full spin — no charges until your trial ends.
    </p>

    @include('emails.partials.stats', [
        'stats' => [
            ['label' => 'Plan', 'value' => $planName, 'accent' => '#1a1d21'],
            ['label' => 'Trial ends', 'value' => $trialEndsAt, 'accent' => '#008060'],
        ],
    ])

    @include('emails.partials.note', [
        'tone' => 'success',
        'text' => 'You won\'t be charged until ' . $trialEndsAt . '. Cancel anytime before then and you won\'t pay a thing.',
    ])

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'Start exploring'])
@endsection
