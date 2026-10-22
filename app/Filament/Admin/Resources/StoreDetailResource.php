<?php

namespace App\Filament\Admin\Resources;

use App\Filament\Admin\Resources\StoreDetailResource\Pages;
use App\Models\StoreDetail;
use Filament\Forms\Form;
use Filament\Infolists\Components;
use Filament\Infolists\Infolist;
use Filament\Resources\Resource;
use Filament\Tables\Table;
use Filament\Forms;
use Filament\Tables;

class StoreDetailResource extends Resource
{
    protected static ?string $model = StoreDetail::class;

    protected static ?string $navigationIcon = 'heroicon-o-building-storefront';

    protected static ?string $navigationLabel = 'Stores';

    protected static ?string $modelLabel = 'Store Details';

    public static function canCreate(): bool
    {
        return false;
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Adjust App Plan')
                    ->description('Change the current plan for this store')
                    ->schema([
                        Forms\Components\Select::make('user_plan_id')
                            ->label('Current App Plan')
                            ->options(\Osiset\ShopifyApp\Storage\Models\Plan::all()->pluck('name', 'id'))
                            ->afterStateHydrated(function (Forms\Components\Select $component, $record) {
                                if ($record) {
                                    $component->state($record->user?->plan_id);
                                }
                            })
                            ->saveRelationshipsUsing(function ($record, $state) {
                                if ($record->user) {
                                    $record->user->plan_id = $state;
                                    $record->user->shopify_freemium = 0;
                                    $record->user->save();
                                }
                            })
                            ->required(),
                    ]),
                Forms\Components\Section::make('Store Meta')
                    ->schema([
                        Forms\Components\TextInput::make('shop_name')->disabled(),
                        Forms\Components\TextInput::make('shopify_domain')->disabled(),
                        Forms\Components\TextInput::make('email')->disabled(),
                    ])
                    ->columns(3),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('shop_name')
                    ->searchable()
                    ->sortable()
                    ->weight('bold'),
                Tables\Columns\TextColumn::make('shopify_domain')
                    ->searchable()
                    ->copyable(),
                Tables\Columns\TextColumn::make('store_status')
                    ->label('Status')
                    ->badge()
                    ->formatStateUsing(fn (?string $state) => $state ? ucfirst($state) : 'Unknown')
                    ->placeholder('Unknown')
                    ->color(fn (?string $state) => match ($state) {
                        \App\Models\StoreDetail::STATUS_ACTIVE => 'success',
                        \App\Models\StoreDetail::STATUS_UNINSTALLED => 'gray',
                        \App\Models\StoreDetail::STATUS_FROZEN => 'warning',
                        \App\Models\StoreDetail::STATUS_CLOSED => 'danger',
                        default => 'gray',
                    })
                    ->icon(fn (?string $state) => match ($state) {
                        \App\Models\StoreDetail::STATUS_ACTIVE => 'heroicon-m-check-circle',
                        \App\Models\StoreDetail::STATUS_UNINSTALLED => 'heroicon-m-arrow-left-start-on-rectangle',
                        \App\Models\StoreDetail::STATUS_FROZEN => 'heroicon-m-pause-circle',
                        \App\Models\StoreDetail::STATUS_CLOSED => 'heroicon-m-x-circle',
                        default => 'heroicon-m-question-mark-circle',
                    })
                    ->tooltip(function ($record) {
                        $bits = array_filter([
                            $record->store_status_reason,
                            $record->store_status_changed_at ? 'since '.$record->store_status_changed_at->diffForHumans() : null,
                            $record->store_status_checked_at ? 'checked '.$record->store_status_checked_at->diffForHumans() : null,
                        ]);

                        return $bits ? implode(' · ', $bits) : 'Not checked yet — runs daily via stores:check-status';
                    })
                    ->sortable(),
                Tables\Columns\TextColumn::make('email')
                    ->searchable(),
                Tables\Columns\TextColumn::make('plan_name')
                    ->label('Shopify Plan')
                    ->badge()
                    ->color('info')
                    ->sortable(),
                Tables\Columns\TextColumn::make('user.plan.name')
                    ->label('App Plan')
                    ->badge()
                    ->color('success')
                    ->sortable(),
                Tables\Columns\TextColumn::make('country')
                    ->sortable(),
                Tables\Columns\TextColumn::make('embed_enabled')
                    ->label('Storefront Extension')
                    ->badge()
                    ->formatStateUsing(fn ($state) => $state === null ? 'Not checked' : ($state ? 'Enabled' : 'Disabled'))
                    ->color(fn ($state) => $state === null ? 'gray' : ($state ? 'success' : 'danger'))
                    ->icon(fn ($state) => $state === null ? 'heroicon-m-question-mark-circle' : ($state ? 'heroicon-m-check-circle' : 'heroicon-m-x-circle'))
                    ->tooltip(fn ($record) => $record->embed_reason ? 'Reason: '.$record->embed_reason : null)
                    ->sortable(),
                Tables\Columns\TextColumn::make('embed_checked_at')
                    ->label('Embed Checked')
                    ->since()
                    ->placeholder('—')
                    ->sortable()
                    ->toggleable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('store_status')
                    ->label('Store status')
                    ->options([
                        \App\Models\StoreDetail::STATUS_ACTIVE => 'Active',
                        \App\Models\StoreDetail::STATUS_UNINSTALLED => 'Uninstalled',
                        \App\Models\StoreDetail::STATUS_CLOSED => 'Closed',
                        \App\Models\StoreDetail::STATUS_FROZEN => 'Frozen',
                    ]),
                Tables\Filters\TernaryFilter::make('embed_enabled')
                    ->label('Storefront extension')
                    ->placeholder('All stores')
                    ->trueLabel('Enabled only')
                    ->falseLabel('Disabled only'),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\EditAction::make(),
                Tables\Actions\Action::make('uninstall')
                    ->label('Uninstall App')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Uninstall App from Store')
                    ->modalDescription('This will delete the local merchant record and their access token. The merchant will need to re-authenticate if they open the app again.')
                    ->action(function ($record) {
                        $user = $record->user;
                        if ($user) {
                            // Trigger total uninstall on Shopify via GraphQL mutation
                            $mutation = 'mutation appUninstall {
                                appUninstall {
                                    userErrors {
                                        field
                                        message
                                    }
                                }
                            }';

                            try {
                                $user->api()->graph($mutation);
                            } catch (\Exception $e) {
                                // Log error but proceed with local cleanup if API fails
                                \Illuminate\Support\Facades\Log::error("Failed to trigger Shopify uninstall mutation for {$user->name}: " . $e->getMessage());
                            }

                            $user->delete();
                        }
                        $record->delete();
                    })
                    ->successNotificationTitle('Merchant uninstalled successfully'),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->schema([
                Components\Section::make('General Information')
                    ->columns(3)
                    ->schema([
                        Components\TextEntry::make('shop_name')->label('Store Name'),
                        Components\TextEntry::make('email'),
                        Components\TextEntry::make('phone'),
                        Components\TextEntry::make('shopify_domain'),
                        Components\TextEntry::make('primary_domain'),
                        Components\TextEntry::make('country'),
                    ]),
                Components\Section::make('Shopify Subscription')
                    ->columns(2)
                    ->schema([
                        Components\TextEntry::make('plan_name')->label('Plan Display Name'),
                        Components\IconEntry::make('shopify_plus')
                            ->label('Shopify Plus')
                            ->boolean(),
                    ]),
                Components\Section::make('Storefront Extension (App Embed)')
                    ->columns(3)
                    ->schema([
                        Components\TextEntry::make('embed_enabled')
                            ->label('Status')
                            ->badge()
                            ->formatStateUsing(fn ($state) => $state === null ? 'Not checked yet' : ($state ? 'Enabled' : 'Disabled'))
                            ->color(fn ($state) => $state === null ? 'gray' : ($state ? 'success' : 'danger')),
                        Components\TextEntry::make('embed_checked_at')
                            ->label('Last checked')
                            ->dateTime()
                            ->placeholder('—'),
                        Components\TextEntry::make('embed_reason')
                            ->label('Detection reason')
                            ->placeholder('—'),
                    ]),
                Components\Section::make('Localization & Technical')
                    ->columns(4)
                    ->schema([
                        Components\TextEntry::make('currency')->label('Currency Code'),
                        Components\TextEntry::make('iana_timezone')->label('Timezone'),
                        Components\TextEntry::make('money_format'),
                        Components\TextEntry::make('weight_unit'),
                    ]),
                Components\Section::make('Description')
                    ->schema([
                        Components\TextEntry::make('description')
                            ->html()
                            ->columnSpanFull(),
                    ])
                    ->collapsible(),
                Components\Section::make('System Timestamps')
                    ->columns(2)
                    ->schema([
                        Components\TextEntry::make('shopify_created_at')->dateTime(),
                        Components\TextEntry::make('shopify_updated_at')->dateTime(),
                        Components\TextEntry::make('created_at')->label('Imported At')->dateTime(),
                        Components\TextEntry::make('updated_at')->label('Last Updated At')->dateTime(),
                    ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListStoreDetails::route('/'),
            'view' => Pages\ViewStoreDetail::route('/{record}'),
            'edit' => Pages\EditStoreDetail::route('/{record}/edit'),
        ];
    }
}
