<?php

namespace App\Http\Controllers;

use App\Support\CrispIdentity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Hands the embedded app the Crisp session token for the admin user viewing it.
 *
 * The app page can't work this out on its own: Shopify only puts `id_token` on
 * the URL for some loads (it is gone as soon as Inertia or App Bridge rewrites
 * the URL, so a refresh on any inner page arrives without it), whereas App
 * Bridge's `shopify.idToken()` always yields a fresh one. So the page fetches a
 * token client-side and asks us to turn it into its Crisp session id.
 *
 * Auth is the session token itself — verify.shopify checks it and logs the shop
 * in, and CrispIdentity re-verifies it before trusting the `sub` inside.
 */
class CrispSessionController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $shop = $request->user();

        return response()->json([
            'token' => $shop
                ? CrispIdentity::tokenFor($shop, (string) $request->bearerToken())
                : null,
        ]);
    }
}
