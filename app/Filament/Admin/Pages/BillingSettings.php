<?php

namespace App\Filament\Admin\Pages;

use App\Models\Setting;
use App\Models\User;
use Filament\Forms;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

/**
 * Global billing switches. Merchants ALWAYS get real charges unless:
 *  - the shop is a Shopify development store (auto-detected, forced by Shopify),
 *  - the shop is flagged "Allow test charges" on the Merchants page, or
 *  - the global test mode below is enabled (dev/QA only).
 */
class BillingSettings extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-cog-6-tooth';

    protected static ?string $navigationGroup = 'Plans & Billing';

    protected static ?string $navigationLabel = 'Billing Settings';

    protected static ?string $title = 'Billing Settings';

    protected static ?int $navigationSort = 3;

    protected static string $view = 'filament.admin.pages.billing-settings';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill([
            'billing_test_mode' => (bool) Setting::get('billing_test_mode', false),
        ]);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Charge mode')
                    ->description('How Shopify charges are created for merchants.')
                    ->schema([
                        Forms\Components\Placeholder::make('billing_enabled_state')
                            ->label('Billing enforcement')
                            ->content(fn () => config('shopify-app.billing_enabled')
                                ? '✅ ENABLED — merchants must have an active paid plan (SHOPIFY_BILLING_ENABLED=true).'
                                : '⚠️ DISABLED — no plan is required. Set SHOPIFY_BILLING_ENABLED=true in the server .env to enforce paid plans.'),

                        Forms\Components\Toggle::make('billing_test_mode')
                            ->label('Global TEST mode — every new charge is a test charge')
                            ->helperText('DEV/QA ONLY. While enabled, no merchant is really charged and no revenue is generated. '
                                .'Leave OFF in production: development stores automatically receive test charges anyway, '
                                .'and individual shops can be flagged per-store on the Merchants page.'),

                        Forms\Components\Placeholder::make('dev_store_info')
                            ->label('Automatic test charges')
                            ->content(fn () => 'Development/partner stores detected right now: '
                                .$this->devStoreCount().' — these always receive test charges (Shopify requirement). '
                                .'Shops flagged "Allow test charges": '.User::where('allow_test_charges', true)->count().'.'),
                    ]),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $state = $this->form->getState();

        Setting::set('billing_test_mode', (bool) ($state['billing_test_mode'] ?? false));

        Notification::make()
            ->title('Billing settings saved')
            ->success()
            ->send();
    }

    private function devStoreCount(): int
    {
        return \App\Models\StoreDetail::query()
            ->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(plan_name)'), config('plans.dev_store_plans', []))
            ->count();
    }
}
