<?php

namespace App\Filament\Admin\Resources;

use App\Filament\Admin\Resources\ChargeResource\Pages;
use App\Models\Charge;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

/**
 * Read-only ledger of every Shopify charge the app has created — the
 * accounting source of truth. Rows are written by the billing flow
 * (plan activation) and updated by the APP_SUBSCRIPTIONS_UPDATE webhook;
 * nothing here is editable by hand.
 */
class ChargeResource extends Resource
{
    protected static ?string $model = Charge::class;

    protected static ?string $navigationIcon = 'heroicon-o-banknotes';

    protected static ?string $navigationGroup = 'Plans & Billing';

    protected static ?string $navigationLabel = 'Charges';

    protected static ?int $navigationSort = 2;

    public static function canCreate(): bool
    {
        return false;
    }

    /** Include soft-deleted charges (uninstalled shops) — history must survive. */
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
                Tables\Columns\TextColumn::make('user.name')
                    ->label('Shop')
                    ->searchable()
                    ->copyable()
                    ->weight('bold')
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('plan.name')
                    ->label('Plan')
                    ->badge()
                    ->color('info')
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('price')
                    ->money('USD')
                    ->sortable(),
                Tables\Columns\TextColumn::make('interval')
                    ->formatStateUsing(fn (?string $state) => $state === 'ANNUAL' ? 'Annual' : ($state ? 'Monthly' : '—'))
                    ->badge()
                    ->color('gray'),
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (?string $state) => match (strtoupper((string) $state)) {
                        'ACTIVE', 'ACCEPTED' => 'success',
                        'PENDING' => 'warning',
                        'CANCELLED', 'DECLINED', 'EXPIRED', 'FROZEN' => 'danger',
                        default => 'gray',
                    }),
                Tables\Columns\IconColumn::make('test')
                    ->label('Test')
                    ->boolean()
                    ->trueColor('warning')
                    ->tooltip('Test charges generate no revenue (dev stores / admin test mode).'),
                Tables\Columns\TextColumn::make('trial_ends_on')
                    ->label('Trial ends')
                    ->date()
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('billing_on')
                    ->label('Next billing')
                    ->date()
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('activated_on')
                    ->label('Activated')
                    ->date()
                    ->sortable()
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('cancelled_on')
                    ->label('Cancelled')
                    ->date()
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('created_at', 'desc')
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'ACTIVE' => 'Active',
                        'ACCEPTED' => 'Accepted',
                        'PENDING' => 'Pending',
                        'CANCELLED' => 'Cancelled',
                        'DECLINED' => 'Declined',
                        'EXPIRED' => 'Expired',
                        'FROZEN' => 'Frozen',
                    ]),
                Tables\Filters\TernaryFilter::make('test')
                    ->label('Test charges'),
                Tables\Filters\SelectFilter::make('plan_id')
                    ->label('Plan')
                    ->relationship('plan', 'name'),
            ])
            ->actions([])
            ->bulkActions([]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCharges::route('/'),
        ];
    }
}
