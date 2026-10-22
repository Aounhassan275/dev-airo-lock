<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Inertia-aware replacement for the package's `billable` middleware.
 *
 * The package middleware passes SPA page loads straight through and answers
 * Inertia XHRs with a bare 402 JSON the frontend never handles — so it never
 * actually gates an Inertia app. This one redirects shops without an active
 * plan to the in-app pricing page (which lives OUTSIDE this middleware),
 * where they pick a plan and get sent through Shopify's charge approval.
 *
 * Free passes: admin-granted freemium or grandfathered shops.
 */
class EnsurePlan
{
    public function handle(Request $request, Closure $next): Response
    {
        if (config('shopify-app.billing_enabled') !== true) {
            return $next($request);
        }

        $shop = Auth::user();

        // Not a shop session (or not authenticated yet) — verify.shopify owns that.
        if (! $shop instanceof User) {
            return $next($request);
        }

        if ($shop->plan_id !== null || $shop->isFreemium() || $shop->isGrandfathered()) {
            return $next($request);
        }

        // Preserve the embedded-app context params Shopify needs.
        $query = array_filter([
            'shop' => $request->get('shop'),
            'host' => $request->get('host'),
            'embedded' => $request->get('embedded'),
            'locale' => $request->get('locale'),
            'session' => $request->get('session'),
        ], fn ($value) => $value !== null && $value !== '');

        return redirect()->route('prices.index', $query);
    }
}
