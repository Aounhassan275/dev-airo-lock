@extends('shopify-app::layouts.default')

@section('styles')
    <meta name="csrf-token" content="{{ csrf_token() }}">

    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])




    {{-- {{ vite_assets() }} --}}

    @inertiaHead
@endsection

@section('content')
    @inertia
    {{-- Airo partner-apps pull-tab (right edge). Self-contained partial. --}}
    @include('partner-apps-dock', ['exclude' => 'locksmith'])
@endsection





@section('scripts')
    @parent
    @include('partials.clarity')
    @include('partials.crisp')
@endsection
