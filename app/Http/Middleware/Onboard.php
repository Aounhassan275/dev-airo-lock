<?php

namespace App\Http\Middleware;
use App\Models\Onboarding;
use Illuminate\Support\Facades\Auth;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class Onboard
{
    /**
     * Routes the onboarding flow itself calls while a store is still in it.
     * Setup builds a real first lock, so it has to be able to save one, re-read
     * the picker catalogues, create a widget design and check the app embed.
     */
    private const ONBOARDING_ROUTES = [
        'onboarding',
        'onboarding.*',
        'logout',
        'locks.store',
        'locks.store_price_rule',
        'locks.refreshCatalog',
        'widgets.quickCreate',
        'widgets.refreshLocales',
        'extension.status',
    ];

    /**
     * Sent by the onboarding page on the requests it makes. Inertia follows the
     * save endpoints' redirect to the lock list with the same headers, so this
     * is how that follow-up is recognised and sent back to the flow, which
     * shows its own result screen instead.
     */
    private const FLOW_HEADER = 'X-Airo-Onboarding';

    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::user();

        if (!$user) {
            return $next($request);
        }

        // Get or create onboarding record for the user
        $onboarding = Onboarding::firstOrCreate(
            ['user_id' => $user->id],
            ['status' => 0]
        );

        // A lock saved from the setup flow redirects to the lock list; land
        // back on the flow so it can show the result. Saving the first lock is
        // finishing setup, so the store is marked done here as well — leaving
        // the result screen any way at all must not restart the flow.
        if ($request->isMethod('GET')
            && $request->headers->has(self::FLOW_HEADER)
            && $request->routeIs('locks.index')) {
            if ($onboarding->status === 0) {
                $onboarding->markAsCompleted();
            }

            // Flashed so OnboardingController@index lets this one visit through
            // to the result screen even though the store is now marked done.
            return redirect()->route('onboarding', $request->query())->with('onboarding_result', true);
        }

        // If status is 0 (not completed), redirect to onboarding
        if ($onboarding->status === 0) {
            // Allow access to onboarding and the routes the flow calls
            if ($request->routeIs(...self::ONBOARDING_ROUTES)) {
                return $next($request);
            }

            return redirect()->route('onboarding', $request->query());
        }

        // If status is 1 (completed), allow access to dashboard
        return $next($request);
    }
}
