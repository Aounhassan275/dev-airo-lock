<?php

namespace App\Http\Controllers;

use App\Models\Lock;
use App\Models\Widget;
use App\Services\ShopLocaleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class WidgetController extends Controller
{
    /**
     * Extract a base64 data URI image from configuration and save it to disk.
     * Returns the updated configuration with the image URL instead of base64.
     */
    private function processBackgroundImage(array $configData, ?array $oldConfig = null): array
    {
        $image = $configData['designOptions']['background']['image'] ?? null;

        if (!$image || !is_string($image) || !str_starts_with($image, 'data:image/')) {
            return $configData;
        }

        // Parse the data URI: data:image/jpeg;base64,/9j/4AAQ...
        if (!preg_match('/^data:image\/(\w+);base64,(.+)$/', $image, $matches)) {
            return $configData;
        }

        $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
        $imageData = base64_decode($matches[2]);

        if ($imageData === false) {
            return $configData;
        }

        // Delete old image file if it exists
        $this->deleteOldBackgroundImage($oldConfig);

        $directory = 'widget_images/' . Auth::id();
        Storage::disk('public')->makeDirectory($directory);
        $filename = $directory . '/' . time() . '_' . uniqid() . '.' . $extension;
        Storage::disk('public')->put($filename, $imageData);

        // Replace base64 with full absolute URL (needed for storefront on different domain)
        $configData['designOptions']['background']['image'] = asset('storage/' . $filename);

        return $configData;
    }

    /**
     * Delete an old background image file from storage.
     */
    private function deleteOldBackgroundImage(?array $config): void
    {
        $oldImage = $config['designOptions']['background']['image'] ?? null;

        if (!$oldImage || !is_string($oldImage) || str_starts_with($oldImage, 'data:')) {
            return;
        }

        // Extract relative path from URL (handles both /storage/... and https://.../storage/...)
        $parts = explode('/storage/', $oldImage, 2);
        $relativePath = $parts[1] ?? null;

        if ($relativePath && Storage::disk('public')->exists($relativePath)) {
            Storage::disk('public')->delete($relativePath);
        }
    }

    private function syncWidgetToLockRules(Widget $widget): void
    {
        $shop = Auth::user();
        $widgetPayload = [
            'id' => $widget->id,
            'type' => $widget->type,
            'name' => $widget->name,
            'settings' => $widget->configuration,
        ];

        $locks = Lock::where('shop_id', $shop->id)
            ->where(function ($q) use ($widget) {
                $q
                    ->where('widget_id', $widget->id)
                    ->orWhere('text_widget_id', $widget->id);
            })
            ->with('accessRules')
            ->get();

        $lockController = app(AccessLockcontroller::class);

        foreach ($locks as $lock) {
            foreach ($lock->accessRules as $rule) {
                $settings = is_array($rule->settings) ? $rule->settings : [];

                if ((int) $lock->widget_id === (int) $widget->id) {
                    $settings['widget_json'] = $widgetPayload;
                }
                if ((int) $lock->text_widget_id === (int) $widget->id) {
                    $settings['text_widget_json'] = $widgetPayload;
                }

                $rule->settings = $settings;
                $rule->save();

                if ($rule->enabled) {
                    $lockController->pushRuleToMetafield($shop, $rule);
                }
            }
        }

        $lockController->updateGlobalMetafield($shop);
    }

    public function index()
    {
        $widgets = Widget::where('user_id', Auth::id())
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($widget) {
                return [
                    'id' => (string) $widget->id,
                    'name' => $widget->name,
                    'type' => $widget->type,
                    'fieldsCount' => 0,
                    'status' => $widget->is_active ? 'active' : 'deactive',
                    'createdAt' => $widget->created_at->toISOString(),
                    'submissions' => 0,  // Placeholder for future implementation
                    'formData' => $widget->type === 'form' ? $widget->configuration : null,
                    'textData' => $widget->type === 'text' ? $widget->configuration : null,
                ];
            });

        $locales = app(ShopLocaleService::class)->get(Auth::user());

        return Inertia::render('widget/Widgetsdashboard', [
            'widgets' => $widgets,
            'storeLocales' => $locales['locales'],
            'primaryLocale' => $locales['primary'],
        ]);
    }

    /**
     * Re-read the shop's published languages from Shopify. Merchants hit this
     * after adding a language in Shopify admin, so the editor picks it up
     * without waiting for a cache to expire.
     */
    public function refreshLocales()
    {
        app(ShopLocaleService::class)->refresh(Auth::user());

        return redirect()->back()->with('success', 'Store languages updated');
    }

    /**
     * Create a widget with default styling, without leaving the page.
     *
     * The lock builder needs this: picking a widget design is part of building
     * a lock, but the only way to make one was the widget editor — and getting
     * there meant abandoning a half-built lock. This creates the widget in
     * place and redirects BACK, so Inertia re-renders the caller with a
     * refreshed widget list while the builder keeps its in-progress state.
     *
     * Styling is deliberately not asked for here. A merchant naming a design
     * mid-lock wants it to exist and be selectable; they refine it later in the
     * widget editor, where every control already lives.
     */
    public function quickCreate(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:form,text',
            // The builder sends the full design from the embedded editor.
            // Absent (or empty) falls back to the defaults below, so the
            // endpoint is still usable without one.
            'configuration' => 'nullable|array',
        ]);

        $configuration = $validated['configuration'] ?? null;
        $configuration = is_array($configuration) && $configuration !== []
            ? $this->processBackgroundImage($configuration)
            : self::defaultConfiguration();

        Widget::create([
            'user_id' => Auth::id(),
            'name' => $validated['name'],
            'type' => $validated['type'],
            'configuration' => $configuration,
            'is_active' => true,
        ]);

        return redirect()->back()->with('success', 'Widget created.');
    }

    /**
     * The shape the widget editor saves (see getSubmitData in Widgets.jsx):
     * colours as hex, and the blanks that mean "use the translated default".
     *
     * @return array<string, mixed>
     */
    private static function defaultConfiguration(): array
    {
        return [
            'designOptions' => [
                'colors' => [
                    'text' => '#333333',
                    'card' => '#FFFFFF',
                    'buttonBg' => '#15518C',
                    'buttonText' => '#FFFFFF',
                ],
                'layout' => [
                    'textAlignment' => 'center',
                    'verticalAlignment' => 'top',
                    'formPadding' => '10',
                    'borderRadius' => '16',
                    'cardPadding' => '10',
                    'cardBorderRadius' => '12',
                    // Empty on purpose: a blank button label falls through to
                    // the translated default, so it reads correctly in every
                    // storefront language. See PopupTextBaker.
                    'buttonText' => '',
                ],
            ],
            'customCss' => '',
            'language' => ['mode' => 'auto', 'locale' => '', 'translations' => []],
        ];
    }

    public function store(Request $request)
    {
        try {
            // Test DB connection first
            \DB::connection()->getPdo();
        } catch (\Exception $e) {
            \Log::error('DB connection FAILED in widget store', ['error' => $e->getMessage()]);
            throw \Illuminate\Validation\ValidationException::withMessages([
                'database' => 'Database connection failed: ' . $e->getMessage(),
            ]);
        }

        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'type' => 'required|in:form,text',
                'configuration' => 'required|array',
            ]);

            // Additional validation based on widget type
            if ($validated['type'] === 'form') {
                $request->validate([
                    'configuration.designOptions' => 'required|array',
                ]);
            }

            $configData = $request->input('configuration');

            // Extract base64 background image to file storage
            $configData = $this->processBackgroundImage($configData);

            $widget = Widget::create([
                'user_id' => Auth::id(),
                'name' => $validated['name'],
                'type' => $validated['type'],
                'configuration' => $configData,
                'is_active' => true,
            ]);

            return redirect()->route('widgetdashboard')->with('success', 'Widget created successfully!');
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::error('Widget store validation failed', [
                'errors' => $e->errors(),
            ]);
            throw $e;
        } catch (\Exception $e) {
            \Log::error('Widget creation FAILED with exception', [
                'error_class' => get_class($e),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw \Illuminate\Validation\ValidationException::withMessages([
                'widget' => 'Failed to create widget: ' . $e->getMessage(),
            ]);
        }
    }

    public function show(Widget $widget)
    {
        // Ensure user owns this widget
        if ($widget->user_id !== Auth::id()) {
            abort(403);
        }

        return response()->json([
            'id' => (string) $widget->id,
            'name' => $widget->name,
            'type' => $widget->type,
            'status' => $widget->is_active ? 'active' : 'deactive',
            'configuration' => $widget->configuration,
            'createdAt' => $widget->created_at->toISOString(),
        ]);
    }

    public function update(Request $request, Widget $widget)
    {
        // Ensure user owns this widget
        if ($widget->user_id !== Auth::id()) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'type' => 'sometimes|in:form,text',
            'configuration' => 'sometimes|array',
            'is_active' => 'sometimes|boolean',
        ]);

        // Extract base64 background image to file storage (pass old config for cleanup)
        if (isset($validated['configuration'])) {
            $validated['configuration'] = $this->processBackgroundImage(
                $validated['configuration'],
                $widget->configuration
            );
        }

        $widget->update($validated);
        $widget->refresh();
        $this->syncWidgetToLockRules($widget);

        return redirect()->route('widgetdashboard')->with('success', 'Widget updated successfully!');
    }

    public function destroy(Widget $widget)
    {
        // Ensure user owns this widget
        if ($widget->user_id !== Auth::id()) {
            abort(403);
        }

        // Clean up background image file
        $this->deleteOldBackgroundImage($widget->configuration);

        $widget->delete();

        return redirect()->route('widgetdashboard')->with('success', 'Widget deleted successfully!');
    }

    public function widgets()
    {
        return Inertia::render('widget/Widgets', [
            'submitRoute' => route('widgets.store'),
        ]);
    }

    public function updateStatus(Request $request, Widget $widget)
    {
        // Ensure user owns this widget
        if ($widget->user_id !== Auth::id()) {
            abort(403);
        }

        $validated = $request->validate([
            'is_active' => 'required|boolean',
        ]);

        $widget->update(['is_active' => $validated['is_active']]);

        return redirect()->back()->with('success', 'Widget status updated successfully');
    }

    public function bulkDelete(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:widgets,id',
        ]);

        // Clean up background image files
        $widgets = Widget::whereIn('id', $validated['ids'])->where('user_id', Auth::id())->get();
        foreach ($widgets as $w) {
            $this->deleteOldBackgroundImage($w->configuration);
        }

        Widget::whereIn('id', $validated['ids'])
            ->where('user_id', Auth::id())
            ->delete();

        return redirect()->back()->with('success', count($validated['ids']) . ' widget(s) deleted successfully!');
    }

    public function bulkStatusUpdate(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:widgets,id',
            'is_active' => 'required|boolean',
        ]);

        Widget::whereIn('id', $validated['ids'])
            ->where('user_id', Auth::id())
            ->update(['is_active' => $validated['is_active']]);

        $status = $validated['is_active'] ? 'activated' : 'deactivated';

        return redirect()->back()->with('success', count($validated['ids']) . " widget(s) {$status} successfully!");
    }
}
