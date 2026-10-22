<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => [
                'user' => $request->user(),
            ],
            // Plan + usage snapshot for global banners (trial countdown,
            // lock-limit warnings, dev-store test-mode notice). Closure so it
            // is only evaluated for authenticated shop sessions.
            'billing' => function () use ($request) {
                $user = $request->user();

                if (! $user instanceof \App\Models\User) {
                    return null;
                }

                try {
                    return app(\App\Services\BillingService::class)->usage($user);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning('[Billing] shared usage prop failed', ['error' => $e->getMessage()]);

                    return null;
                }
            },
        ];
    }
}
