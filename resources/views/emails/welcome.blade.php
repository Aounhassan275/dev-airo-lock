{{-- Vars: $shopName, $appUrl --}}
@extends('emails.layouts.master')

@section('title', 'Welcome to Airo Access Lock')
@section('icon', '🔒')
@section('heading', 'Welcome aboard' . ($shopName ? ', ' . $shopName : '') . '!')
@section('subheading', 'Your store is ready to be locked down.')

@section('content')
    <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.65; color: #2b2f33;">
        Thanks for installing <strong>{{ config('app.name') }}</strong>. You can now restrict access to any
        page, product, collection or blog — by password, customer login, country, or a schedule — all from one place.
    </p>

    @include('emails.partials.note', [
        'tone' => 'success',
        'text' => 'You\'re all set. Create your first lock in under a minute — no code or theme edits required.',
    ])

    <p style="margin: 0 0 10px; font-size: 14px; font-weight: 600; color: #1a1d21;">A few things you can do:</p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 28px;">
        <tr>
            <td style="padding: 6px 0; font-size: 14px; line-height: 1.6; color: #44474a;">🔒&nbsp;&nbsp;Lock pages, products & collections behind a password or login</td>
        </tr>
        <tr>
            <td style="padding: 6px 0; font-size: 14px; line-height: 1.6; color: #44474a;">⏰&nbsp;&nbsp;Schedule locks to start and expire automatically</td>
        </tr>
        <tr>
            <td style="padding: 6px 0; font-size: 14px; line-height: 1.6; color: #44474a;">🌍&nbsp;&nbsp;Restrict access by country or customer tag</td>
        </tr>
    </table>

    @include('emails.partials.button', ['url' => ($appUrl ?? config('app.url')), 'label' => 'Create your first lock'])
@endsection
