<?php

namespace App\Filament\Admin\Resources;

use App\Filament\Admin\Resources\PlanResource\Pages;
use App\Models\Plan;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Manage the subscription plans merchants can buy. Prices/limits/features
 * here are exactly what the billing flow charges and the app enforces.
 */
class PlanResource extends Resource
{
    protected static ?string $model = Plan::class;

    protected static ?string $navigationIcon = 'heroicon-o-rectangle-stack';

    protected static ?string $navigationGroup = 'Plans & Billing';

    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Plan')
                ->columns(3)
                ->schema([
                    Forms\Components\TextInput::make('name')
                        ->required()
                        ->helperText('Tier name shown to merchants (Basic / Pro / Unlimited).'),
                    Forms\Components\Select::make('interval')
                        ->options([
                            'EVERY_30_DAYS' => 'Monthly',
                            'ANNUAL' => 'Annual',
                        ])
                        ->default('EVERY_30_DAYS')
                        ->required(),
                    Forms\Components\Select::make('type')
                        ->options(['RECURRING' => 'Recurring'])
                        ->default('RECURRING')
                        ->required(),
                    Forms\Components\TextInput::make('price')
                        ->numeric()
                        ->prefix('$')
                        ->required()
                        ->helperText('Charged via Shopify Billing in USD.'),
                    Forms\Components\TextInput::make('trial_days')
                        ->numeric()
                        ->default(7)
                        ->required()
                        ->helperText('Free-trial days before the first charge.'),
                    Forms\Components\TextInput::make('max_locks')
                        ->numeric()
                        ->default(5)
                        ->required()
                        ->helperText('0 = unlimited locks.'),
                    Forms\Components\TextInput::make('description')
                        ->columnSpan(2)
                        ->helperText('Short tagline shown on the pricing page.'),
                    Forms\Components\TextInput::make('terms')
                        ->helperText('Optional terms line (e.g. "Save 17% with annual billing").'),
                ]),

            Forms\Components\Section::make('Features')
                ->description('What this plan unlocks. Enforced server-side on every lock save.')
                ->schema([
                    Forms\Components\CheckboxList::make('features')
                        ->options(config('plans.features', []))
                        ->columns(2)
                        ->helperText('Leave empty to fall back to the tier defaults in config/plans.php (matched by plan name).'),
                ]),

            Forms\Components\Section::make('Flags')
                ->columns(4)
                ->schema([
                    Forms\Components\Toggle::make('is_active')
                        ->label('Active')
                        ->default(true)
                        ->helperText('Inactive plans are hidden from merchants.'),
                    Forms\Components\Toggle::make('is_popular')
                        ->label('Most popular badge'),
                    Forms\Components\Toggle::make('on_install')
                        ->label('Default on install')
                        ->helperText('Plan preselected by the package billing route.'),
                    Forms\Components\Toggle::make('test')
                        ->label('Always TEST charges')
                        ->helperText('DANGER: every charge for this plan is a test charge — no revenue. Dev stores already get test charges automatically; leave this OFF for real plans.'),
                ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->weight('bold')
                    ->searchable(),
                Tables\Columns\TextColumn::make('interval')
                    ->badge()
                    ->formatStateUsing(fn (?string $state) => $state === 'ANNUAL' ? 'Annual' : 'Monthly')
                    ->color(fn (?string $state) => $state === 'ANNUAL' ? 'info' : 'gray'),
                Tables\Columns\TextColumn::make('price')
                    ->money('USD')
                    ->sortable(),
                Tables\Columns\TextColumn::make('max_locks')
                    ->label('Locks')
                    ->formatStateUsing(fn ($state) => (int) $state === 0 ? 'Unlimited' : $state),
                Tables\Columns\TextColumn::make('trial_days')
                    ->label('Trial'),
                Tables\Columns\TextColumn::make('users_count')
                    ->label('Shops on plan')
                    ->counts('users'),
                Tables\Columns\IconColumn::make('is_active')
                    ->label('Active')
                    ->boolean(),
                Tables\Columns\IconColumn::make('is_popular')
                    ->label('Popular')
                    ->boolean(),
                Tables\Columns\IconColumn::make('test')
                    ->label('Test-only')
                    ->boolean()
                    ->trueColor('danger'),
            ])
            ->defaultSort('price')
            ->actions([
                Tables\Actions\EditAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPlans::route('/'),
            'create' => Pages\CreatePlan::route('/create'),
            'edit' => Pages\EditPlan::route('/{record}/edit'),
        ];
    }
}
