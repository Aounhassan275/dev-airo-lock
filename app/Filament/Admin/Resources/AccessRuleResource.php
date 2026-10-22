<?php

namespace App\Filament\Admin\Resources;

use App\Filament\Admin\Resources\AccessRuleResource\Pages;
use App\Models\AccessRule;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Access rules across all shops (which resource each lock protects). Read-only.
 */
class AccessRuleResource extends Resource
{
    protected static ?string $model = AccessRule::class;

    protected static ?string $navigationIcon = 'heroicon-o-key';

    protected static ?string $navigationLabel = 'Access Rules';

    protected static ?string $modelLabel = 'Access Rule';

    protected static ?int $navigationSort = 3;

    public static function canCreate(): bool
    {
        return false;
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('lock.name')
                    ->label('Lock')
                    ->searchable()
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('shop.name')
                    ->label('Shop')
                    ->searchable()
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('resource_type')
                    ->label('Type')
                    ->badge()
                    ->color('info')
                    ->sortable(),
                Tables\Columns\TextColumn::make('handle')
                    ->searchable()
                    ->copyable(),
                Tables\Columns\IconColumn::make('enabled')
                    ->boolean(),
                Tables\Columns\TextColumn::make('logs_count')
                    ->label('Log entries')
                    ->counts('logs')
                    ->badge()
                    ->color('gray'),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable(),
            ])
            ->defaultSort('created_at', 'desc')
            ->filters([
                Tables\Filters\SelectFilter::make('resource_type')
                    ->options([
                        'product' => 'Product',
                        'collection' => 'Collection',
                        'page' => 'Page',
                        'blog' => 'Blog',
                        'shop' => 'Shop',
                    ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListAccessRules::route('/'),
        ];
    }
}
