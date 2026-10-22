<?php

namespace App\Filament\Admin\Resources;

use App\Filament\Admin\Resources\AccessLogResource\Pages;
use App\Models\AccessLog;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Access attempt log (granted / denied) across all shops. Read-only.
 */
class AccessLogResource extends Resource
{
    protected static ?string $model = AccessLog::class;

    protected static ?string $navigationIcon = 'heroicon-o-clipboard-document-list';

    protected static ?string $navigationLabel = 'Access Logs';

    protected static ?string $modelLabel = 'Access Log';

    protected static ?int $navigationSort = 4;

    public static function canCreate(): bool
    {
        return false;
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('created_at')
                    ->label('When')
                    ->dateTime()
                    ->sortable(),
                Tables\Columns\TextColumn::make('accessRule.lock.name')
                    ->label('Lock')
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('accessRule.handle')
                    ->label('Resource')
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('customer_id')
                    ->label('Customer')
                    ->placeholder('Anonymous')
                    ->searchable(),
                Tables\Columns\IconColumn::make('granted')
                    ->boolean(),
                Tables\Columns\TextColumn::make('reason')
                    ->placeholder('—')
                    ->wrap(),
                Tables\Columns\TextColumn::make('ip_address')
                    ->label('IP')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('created_at', 'desc')
            ->filters([
                Tables\Filters\TernaryFilter::make('granted')
                    ->placeholder('All')
                    ->trueLabel('Granted only')
                    ->falseLabel('Denied only'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListAccessLogs::route('/'),
        ];
    }
}
