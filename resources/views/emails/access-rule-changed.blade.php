{{-- Vars: $shopName, $appUrl, $lockName, $changeSummary (e.g. 'Access changed from Password to Customer login') --}}
@extends('emails.layouts.master')

@section('title', 'Access rule updated')
@section('icon', '⚙️')
@section('heading', 'An access rule was changed')
@section('subheading', 'Settings for “' . $lockName . '” were updated.')

@section('content')
    <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, the access rules for the lock <strong>{{ $lockName }}</strong>
        were just updated.
    </p>

    @include('emails.partials.note', [
        'tone' => 'info',
        'text' => $changeSummary ?? 'The access settings for this lock have changed. Review them to make sure everything is correct.',
    ])

    <p style="margin: 0 0 26px; font-size: 14px; line-height: 1.6; color: #44474a;">
        If you didn't make this change, someone else with access to your store may have. Review the lock to confirm.
    </p>

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'Review lock settings'])
@endsection
