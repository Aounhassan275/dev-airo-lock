{{-- Vars: $shopName, $appUrl, $oldPlan, $newPlan, $isUpgrade (bool), $effectiveAt? --}}
@extends('emails.layouts.master')

@section('title', 'Your plan was updated')
@section('icon', $isUpgrade ? '⬆️' : '🔄')
@section('heading', $isUpgrade ? 'You\'ve upgraded to ' . $newPlan : 'Your plan was changed')
@section('subheading', 'Now on the ' . $newPlan . ' plan.')

@section('content')
    <p style="margin: 0 0 22px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Hi{{ $shopName ? ' ' . $shopName : '' }}, your {{ config('app.name') }} subscription has changed.
    </p>

    @include('emails.partials.stats', [
        'stats' => [
            ['label' => 'Previous', 'value' => $oldPlan, 'accent' => '#6b7280'],
            ['label' => 'Current', 'value' => $newPlan, 'accent' => '#008060'],
        ],
    ])

    @include('emails.partials.note', [
        'tone' => $isUpgrade ? 'success' : 'info',
        'text' => $isUpgrade
            ? 'Your new plan is active immediately — enjoy your expanded limits.'
            : (!empty($effectiveAt)
                ? 'This change takes effect on ' . $effectiveAt . '. Until then, your current limits stay in place.'
                : 'Your plan has been updated. Review your limits in the app to make sure everything looks right.'),
    ])

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'View your plan'])
@endsection
