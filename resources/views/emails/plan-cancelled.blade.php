{{-- Vars: $shopName, $appUrl, $planName, $activeUntil?, $activeLocks? --}}
@extends('emails.layouts.master')

@section('title', 'Your subscription was cancelled')
@section('icon', '🙏')
@section('heading', 'Your plan has been cancelled')
@section('subheading', 'We\'re sorry to see you downgrade.')

@section('content')
    <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, your <strong>{{ $planName }}</strong> subscription on
        {{ config('app.name') }} has been cancelled.
    </p>

    @include('emails.partials.note', [
        'tone' => 'warning',
        'text' => !empty($activeUntil)
            ? 'Your plan stays active until ' . $activeUntil . '. After that, locks above the free limit may be paused and that content will become public.'
            : 'Locks above the free limit may now be paused, which means that content will become publicly visible.',
    ])

    @if (!empty($activeLocks))
        <p style="margin: 0 0 22px; font-size: 14px; line-height: 1.6; color: #44474a;">
            You currently have <strong>{{ number_format($activeLocks) }}</strong> active lock(s). Resubscribe anytime
            to keep them all running.
        </p>
    @endif

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'Reactivate my plan'])
@endsection
