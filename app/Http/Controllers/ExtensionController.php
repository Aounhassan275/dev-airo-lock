<?php

namespace App\Http\Controllers;

use App\Services\ThemeExtensionService;
use Illuminate\Support\Facades\Auth;

class ExtensionController extends Controller
{
    /**
     * Live re-check of the theme app embed status.
     *
     * The dashboard calls this (bypassing the cache) when the merchant returns
     * to the app tab after visiting the theme editor, so the "extension
     * disabled" notice disappears the moment they've saved.
     */
    public function status(ThemeExtensionService $service)
    {
        $shop = Auth::user();

        // `/extension/status?debug=1` returns the full, uncached diagnostic
        // (theme read, settings_data.json fetch, matched embed block + disabled
        // flag, raw GraphQL errors, final reason) so the reason is verifiable.
        if (request()->boolean('debug')) {
            try {
                return response()->json($service->inspect($shop));
            } catch (\Throwable $e) {
                return response()->json(['reason' => 'check-failed', 'error' => $e->getMessage()]);
            }
        }

        // Default = cached (fast; the slow Admin API theme read only runs on a
        // cache miss). ?fresh=1 bypasses the cache — the notice does this when the
        // merchant returns from the theme editor so it self-clears once saved.
        return response()->json($service->status($shop, fresh: request()->boolean('fresh')));
    }
}
