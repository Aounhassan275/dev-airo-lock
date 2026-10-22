<?php

use Symfony\Component\HttpFoundation\Response;
use App\Exceptions\ShopifyGraphqlException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\HtmlString;
use Illuminate\Support\Str;
use Carbon\Carbon;

function vite_assets(): HtmlString
{
    $manifest = json_decode(file_get_contents(
        public_path('build/manifest.json')
    ), true);
    return new HtmlString(<<<HTML
        <script type="module" src="/build/{$manifest['resources/js/app.jsx']['file']}"></script>
        <link rel="stylesheet" href="/build/{$manifest['resources/js/app.jsx']['css'][0]}">
    HTML);
}
