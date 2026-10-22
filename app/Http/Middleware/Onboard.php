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

        // If status is 0 (not completed), redirect to onboarding
        if ($onboarding->status === 0) {
            // Allow access to onboarding and related routes
            if ($request->routeIs('onboarding', 'onboarding.*', 'logout')) {
                return $next($request);
            }

            return redirect()->route('onboarding', $request->query());
        }

        // If status is 1 (completed), allow access to dashboard
        return $next($request);
    }
}
