<?php

namespace App\Filament\Admin\Resources;

use App\Filament\Admin\Resources\UserResource\Pages;
use App\Models\User;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

/**
 * Raw merchant (shop) records from the users table. Reads directly from
 * `users` — independent of StoreDetail — so installed shops are always visible
 * even when the post-install StoreDetail sync hasn't run.
 */
class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static ?string $navigationIcon = 'heroicon-o-users';

    protected static ?string $navigationLabel = 'Merchants';

    protected static ?string $modelLabel = 'Merchant';

    protected static ?int $navigationSort = 1;

    public static function canCreate(): bool
    {
        return false;
    }

    /** Include uninstalled (soft-deleted) shops so install history is visible. */
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->withoutGlobalScopes([SoftDeletingScope::class]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')
                    ->label('ID')
                    ->sortable(),
                Tables\Columns\TextColumn::make('name')
                    ->label('Shop domain')
                    ->searchable()
                    ->copyable()
                    ->weight('bold'),
                Tables\Columns\TextColumn::make('email')
                    ->searchable()
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('plan.name')
                    ->label('App plan')
                    ->badge()
                    ->color('success')
                    ->placeholder('No plan'),
                Tables\Columns\TextColumn::make('storeDetail.plan_name')
                    ->label('Shopify plan')
                    ->badge()
                    ->color(fn (?string $state) => in_array(strtolower((string) $state), config('plans.dev_store_plans', []), true) ? 'warning' : 'gray')
                    ->tooltip('Development/partner stores always receive TEST charges.')
                    ->placeholder('—')
                    ->toggleable(),
                Tables\Columns\ToggleColumn::make('shopify_freemium')
                    ->label('Free access')
                    ->tooltip('Admin-granted free access: shop passes the plan gate without paying.')
                    ->updateStateUsing(function (User $record, $state) {
                        $record->forceFill(['shopify_freemium' => (bool) $state])->save();

                        return $state;
                    }),
                Tables\Columns\ToggleColumn::make('allow_test_charges')
                    ->label('Test charges')
                    ->tooltip('Force Shopify TEST charges for this shop (no real billing).')
                    ->updateStateUsing(function (User $record, $state) {
                        $record->forceFill(['allow_test_charges' => (bool) $state])->save();

                        return $state;
                    }),
                Tables\Columns\IconColumn::make('is_admin')
                    ->label('Admin')
                    ->boolean(),
                Tables\Columns\TextColumn::make('status')
                    ->label('Status')
                    ->badge()
                    ->state(fn (User $record) => $record->trashed() ? 'Uninstalled' : 'Active')
                    ->color(fn (string $state) => $state === 'Active' ? 'success' : 'danger'),
                Tables\Columns\TextColumn::make('created_at')
                    ->label('Installed')
                    ->dateTime()
                    ->sortable(),
            ])
            ->defaultSort('created_at', 'desc')
            ->actions([
                Tables\Actions\Action::make('grantAdmin')
                    ->label(fn (User $record) => $record->is_admin ? 'Revoke admin' : 'Make admin')
                    ->icon('heroicon-o-shield-check')
                    ->color(fn (User $record) => $record->is_admin ? 'danger' : 'primary')
                    ->requiresConfirmation()
                    ->action(fn (User $record) => $record->forceFill(['is_admin' => ! $record->is_admin])->save()),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListUsers::route('/'),
        ];
    }
}
