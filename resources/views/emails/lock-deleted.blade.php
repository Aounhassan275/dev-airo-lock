{{-- Vars: $shopName, $appUrl, $lockName, $itemCount --}}
@extends('emails.layouts.master')

@section('title', 'Lock deleted')
@section('icon', '🗑️')
@section('heading', 'A lock was removed')
@section('subheading', '“' . $lockName . '” has been deleted.')

@section('content')
    <p style="margin: 0 0 14px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, the lock <strong>{{ $lockName }}</strong> has been deleted
        from your store. Any content it was protecting is now publicly accessible again.
    </p>

    @include('emails.partials.stats', [
        'stats' => [
            ['label' => 'Unlocked items', 'value' => number_format($itemCount ?? 0), 'accent' => '#008060'],
            ['label' => 'Status', 'value' => 'Deleted', 'accent' => '#6b7280'],
        ],
    ])

    @include('emails.partials.note', [
        'tone' => 'warning',
        'text' => 'If you didn\'t expect this, someone with access to your store may have removed it. You can recreate the lock anytime.',
    ])

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'Open the app'])
@endsection
