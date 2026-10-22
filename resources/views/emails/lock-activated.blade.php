{{-- Vars: $shopName, $appUrl, $lockName, $itemCount, $expiresAt? --}}
@extends('emails.layouts.master')

@section('title', 'Lock activated')
@section('icon', '🔐')
@section('heading', 'Your scheduled lock is now live')
@section('subheading', '“' . $lockName . '” just activated.')

@section('content')
    <p style="margin: 0 0 14px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, the scheduled lock <strong>{{ $lockName }}</strong> has
        reached its start time and is now protecting your content.
    </p>

    @include('emails.partials.stats', [
        'stats' => array_values(array_filter([
            ['label' => 'Protected items', 'value' => number_format($itemCount ?? 0), 'accent' => '#008060'],
            ['label' => 'Status', 'value' => 'Active', 'accent' => '#1a1d21'],
            !empty($expiresAt) ? ['label' => 'Expires', 'value' => $expiresAt, 'accent' => '#c2410c'] : null,
        ])),
    ])

    @include('emails.partials.note', [
        'tone' => 'success',
        'text' => 'Everything went live exactly as scheduled — no action needed from you.',
    ])

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'View lock'])
@endsection
