{{-- Vars: $shopName, $appUrl --}}
@extends('emails.layouts.master')

@section('title', 'Welcome back to Airo Access Lock')
@section('icon', '🎉')
@section('heading', 'Great to have you back' . ($shopName ? ', ' . $shopName : '') . '!')
@section('subheading', config('app.name') . ' is installed again and ready to go.')

@section('content')
    <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Welcome back! <strong>{{ config('app.name') }}</strong> is set up on your store again. You can pick up
        right where you left off and start protecting your content in seconds.
    </p>

    @include('emails.partials.note', [
        'tone' => 'success',
        'text' => 'Everything is reconnected. Head into the app to set up your locks again — it only takes a minute.',
    ])

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'Open the app'])
@endsection
