{{-- Vars: $shopName, $appUrl, $planName, $daysLeft, $trialEndsAt --}}
@extends('emails.layouts.master')

@section('title', 'Your trial is ending soon')
@section('icon', '⏳')
@section('heading', 'Your trial ends in ' . $daysLeft . ' ' . \Illuminate\Support\Str::plural('day', $daysLeft))
@section('subheading', 'Keep your locks active after ' . $trialEndsAt . '.')

@section('content')
    <p style="margin: 0 0 22px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, your free trial of the <strong>{{ $planName }}</strong> plan
        ends on <strong>{{ $trialEndsAt }}</strong>. Subscribe now to keep your content protected without interruption.
    </p>

    @include('emails.partials.stats', [
        'stats' => [
            ['label' => 'Plan', 'value' => $planName, 'accent' => '#1a1d21'],
            ['label' => 'Days left', 'value' => $daysLeft, 'accent' => '#c2410c'],
        ],
    ])

    @include('emails.partials.note', [
        'tone' => 'warning',
        'text' => 'When your trial ends, locks may be paused until you choose a plan. Subscribe now to avoid any gap in protection.',
    ])

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'Choose a plan'])
@endsection
