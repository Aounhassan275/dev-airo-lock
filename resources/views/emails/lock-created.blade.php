{{-- Vars: $shopName, $appUrl, $lockName, $protection (e.g. 'Password'), $itemCount, $startsAt?, $expiresAt? --}}
@extends('emails.layouts.master')

@section('title', 'Lock created')
@section('icon', '🔒')
@section('heading', 'Your content is now protected')
@section('subheading', '“' . $lockName . '” is live on your store.')

@section('content')
    <p style="margin: 0 0 14px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, the lock <strong>{{ $lockName }}</strong> has been created
        and is now protecting your selected content. Here's a quick summary:
    </p>

    @include('emails.partials.stats', [
        'stats' => array_values(array_filter([
            ['label' => 'Protected items', 'value' => number_format($itemCount ?? 0), 'accent' => '#008060'],
            !empty($protection) ? ['label' => 'Access', 'value' => $protection, 'accent' => '#1a1d21'] : null,
            !empty($expiresAt) ? ['label' => 'Expires', 'value' => $expiresAt, 'accent' => '#c2410c'] : null,
        ])),
    ])

    @include('emails.partials.note', [
        'tone' => !empty($startsAt) ? 'info' : 'success',
        'text' => !empty($startsAt)
            ? 'This lock is scheduled to activate on ' . $startsAt . '. We\'ll let you know when it goes live.'
            : 'The lock is active right now. Visitors will need to meet your access rules to view this content.',
    ])

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'Manage this lock'])
@endsection
