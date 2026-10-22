<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use App\Models\Onboarding;

class OnboardingController extends Controller
{
    public function index()
    {
        $shop = Auth::user()->load('plan');

        // NOTE (free period): plan / trial data is temporarily not sent to the
        // onboarding screen so no plan or trial info is shown. The app is free
        // with unlimited locks. Restore the block below to re-enable plans.
        //
        // $plan = $shop->plan;
        // $isFreemium = $shop->isFreemium();
        // $isInTrial = $shop->isInTrial();
        // $daysRemaining = $shop->getTrialDaysRemaining();
        //
        // // Determine plan display name
        // $planName = 'Free Trial';
        // if ($plan && !$isFreemium) {
        //     $planName = $plan->name;
        // } elseif ($plan) {
        //     $planName = $plan->name ?? 'Free Trial';
        // }

        return Inertia::render('Onboarding', [
            // 'plan' => [
            //     'name' => $planName,
            //     'daysRemaining' => $daysRemaining,
            //     'isInTrial' => $isInTrial,
            // ],
        ]);
    }

    public function complete()
    {
        $user = Auth::user();

        // Find or create onboarding record and mark as completed
        $onboarding = Onboarding::firstOrCreate(
            ['user_id' => $user->id],
            ['status' => 0]
        );

        $onboarding->markAsCompleted();
        
        return redirect()->route('home', request()->query());
    }
}
