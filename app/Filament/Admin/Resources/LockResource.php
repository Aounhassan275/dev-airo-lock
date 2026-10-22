<?php

namespace App\Filament\Admin\Resources;

use App\Filament\Admin\Resources\LockResource\Pages;
use App\Models\Lock;
use Filament\Infolists\Components;
use Filament\Infolists\Infolist;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * All locks across every shop, for support and oversight. Read-only.
 */
class LockResource extends Resource
{
    protected static ?string $model = Lock::class;

    protected static ?string $navigationIcon = 'heroicon-o-lock-closed';

    protected static ?string $navigationLabel = 'Locks';

    protected static ?string $modelLabel = 'Lock';

    protected static ?int $navigationSort = 2;

    public static function canCreate(): bool
    {
        return false;
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->weight('bold'),
                Tables\Columns\TextColumn::make('shop.name')
                    ->label('Shop')
                    ->searchable()
                    ->placeholder('—'),
                Tables\Columns\IconColumn::make('status')
                    ->label('Active')
                    ->boolean(),
                Tables\Columns\TextColumn::make('type')
                    ->badge()
                    ->color('gray'),
                Tables\Columns\TextColumn::make('access_rules_count')
                    ->label('Protected items')
                    ->counts('accessRules')
                    ->badge()
                    ->color('info'),
                Tables\Columns\TextColumn::make('starts_at')
                    ->dateTime()
                    ->placeholder('—')
                    ->sortable(),
                Tables\Columns\TextColumn::make('expires_at')
                    ->dateTime()
                    ->placeholder('—')
                    ->sortable(),
                Tables\Columns\TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable(),
            ])
            ->defaultSort('created_at', 'desc')
            ->filters([
                Tables\Filters\TernaryFilter::make('status')
                    ->label('Active')
                    ->placeholder('All')
                    ->trueLabel('Active only')
                    ->falseLabel('Inactive only'),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
            ]);
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist->schema([
            Components\Section::make('Lock')
                ->columns(3)
                ->schema([
                    Components\TextEntry::make('name'),
                    Components\TextEntry::make('shop.name')->label('Shop'),
                    Components\IconEntry::make('status')->label('Active')->boolean(),
                    Components\TextEntry::make('type'),
                    Components\TextEntry::make('handle'),
                    Components\TextEntry::make('description')->placeholder('—')->columnSpanFull(),
                ]),
            Components\Section::make('Schedule')
                ->columns(2)
                ->schema([
                    Components\TextEntry::make('starts_at')->dateTime()->placeholder('Not scheduled'),
                    Components\TextEntry::make('expires_at')->dateTime()->placeholder('No expiry'),
                ]),
            Components\Section::make('Protected items')
                ->schema([
                    Components\RepeatableEntry::make('accessRules')
                        ->schema([
                            Components\TextEntry::make('resource_type')->badge(),
                            Components\TextEntry::make('handle'),
                            Components\IconEntry::make('enabled')->boolean(),
                        ])
                        ->columns(3),
                ]),
        ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListLocks::route('/'),
        ];
    }
}
