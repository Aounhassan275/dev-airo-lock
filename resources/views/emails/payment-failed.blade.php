{{-- Vars: $shopName, $appUrl, $planName, $retryAt?, $amount? --}}
@extends('emails.layouts.master')

@section('title', 'Payment failed')
@section('icon', '⚠️')
@section('heading', 'We couldn\'t process your payment')
@section('subheading', 'Action needed to keep your locks active.')

@section('content')
    <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, we weren't able to charge your <strong>{{ $planName }}</strong>
        subscription{{ !empty($amount) ? ' (' . $amount . ')' : '' }} on {{ config('app.name') }}.
    </p>

    @include('emails.partials.note', [
        'tone' => 'warning',
        'text' => !empty($retryAt)
            ? 'We\'ll automatically try again on ' . $retryAt . '. If it fails again, your locks may be paused and protected content will become public.'
            : 'Please update your billing details to avoid your locks being paused and your protected content becoming public.',
    ])

    <p style="margin: 0 0 26px; font-size: 14px; line-height: 1.6; color: #44474a;">
        This is usually a temporary issue with the payment method on file. Approving the charge in your
        Shopify admin resolves it right away.
    </p>

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'Fix payment now'])
@endsection
