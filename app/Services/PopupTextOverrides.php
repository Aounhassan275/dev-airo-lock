<?php

namespace App\Services;

/**
 * Per-lock popup wording.
 *
 * The popup's title, button text and input placeholders live on the WIDGET,
 * which is shared by every lock pointing at it — so wording one lock
 * differently used to mean cloning the whole design. `locks.popup_text` holds
 * per-lock overrides and this applies them.
 *
 * WHY NO STOREFRONT CHANGE IS NEEDED: `buildRuleMetafieldData()` resolves a
 * fresh copy of the widget payload for each rule and writes it into that rule's
 * own metafield. Overwriting strings in that per-rule copy therefore affects
 * only this lock, and the popup already reads those exact fields — so overrides
 * work on every extension version, including ones already published.
 *
 * ORDER MATTERS. This must run BEFORE PopupTextBaker, which fills *blank*
 * fields with translated defaults. Applied first, an override looks like
 * merchant-authored text and the baker leaves it alone — which is the
 * precedence we want:
 *
 *     lock override  >  widget value  >  translated default
 *
 * Every value is optional; a blank override is simply not applied, so the
 * previous behaviour is what you get when the merchant has typed nothing.
 */
class PopupTextOverrides
{
    /** The keys `locks.popup_text` may carry. Anything else is ignored. */
    public const KEYS = [
        'header',
        'button',
        'passcode_label',
        'passcode_placeholder',
        'email_label',
        'email_placeholder',
    ];

    /** @var array<string, string> */
    private array $text;

    /**
     * @param  array<string, mixed>|null  $popupText  the lock's `popup_text`
     */
    public function __construct(?array $popupText)
    {
        $this->text = self::sanitize($popupText);
    }

    /**
     * Trim, drop blanks and unknown keys. Used both here and by the controller
     * before saving, so the column never accumulates junk.
     *
     * @param  array<string, mixed>|null  $popupText
     * @return array<string, string>
     */
    public static function sanitize(?array $popupText): array
    {
        if (! is_array($popupText)) {
            return [];
        }

        $out = [];
        foreach (self::KEYS as $key) {
            $value = $popupText[$key] ?? null;
            if (is_string($value) && trim($value) !== '') {
                $out[$key] = trim($value);
            }
        }

        return $out;
    }

    public function isEmpty(): bool
    {
        return $this->text === [];
    }

    /**
     * Overlay the title, button and placeholders onto one widget payload.
     *
     * @param  array<string, mixed>|null  $widget
     * @return array<string, mixed>|null
     */
    public function withWidgetText(?array $widget): ?array
    {
        if ($widget === null || $this->isEmpty()) {
            return $widget;
        }

        $design = $widget['settings']['designOptions'] ?? [];
        if (! is_array($design)) {
            $design = [];
        }

        if (isset($this->text['header'])) {
            $header = is_array($design['headerSettings'] ?? null) ? $design['headerSettings'] : [];
            $header['text'] = $this->text['header'];
            $design['headerSettings'] = $header;
        }

        if (isset($this->text['button'])) {
            $layout = is_array($design['layout'] ?? null) ? $design['layout'] : [];
            $layout['buttonText'] = $this->text['button'];
            $design['layout'] = $layout;
        }

        if (isset($this->text['passcode_placeholder'])) {
            $design['placeholderText'] = $this->text['passcode_placeholder'];
        }

        if (isset($this->text['email_placeholder'])) {
            $design['emailPlaceholderText'] = $this->text['email_placeholder'];
        }

        $settings = is_array($widget['settings'] ?? null) ? $widget['settings'] : [];
        $settings['designOptions'] = $design;
        $widget['settings'] = $settings;

        return $widget;
    }

    /**
     * Overlay the field labels onto the condition groups.
     *
     * The popup labels each input from its condition, so a label is written
     * onto the condition rather than into the widget. A label the merchant
     * typed on an individual condition is more specific than a lock-wide
     * override and wins over it.
     *
     * KNOWN GAP: 'pairedCredentials' renders two fields from one condition and
     * the popup applies a condition's label to the FIRST of them, so that
     * type takes `email_label` only — its passcode box keeps the translated
     * default. Reaching the second field needs a second label on the condition,
     * which the storefront would have to be taught to read.
     *
     * @param  array<int, array<string, mixed>>  $conditions
     * @return array<int, array<string, mixed>>
     */
    public function withFieldLabels(array $conditions): array
    {
        if ($this->isEmpty()) {
            return $conditions;
        }

        foreach ($conditions as $groupIndex => $group) {
            foreach (($group['conditions'] ?? []) as $index => $condition) {
                if (! is_array($condition)) {
                    continue;
                }

                // Never overwrite wording typed on the condition itself.
                if (($condition['label'] ?? '') !== '') {
                    continue;
                }

                $label = $this->labelFor($condition['type'] ?? '');
                if ($label !== null) {
                    $conditions[$groupIndex]['conditions'][$index]['label'] = $label;
                }
            }
        }

        return $conditions;
    }

    /** Which override wording, if any, applies to this condition's first field. */
    private function labelFor(string $type): ?string
    {
        if (! in_array($type, PopupTextBaker::inputTypes(), true)) {
            return null;
        }

        // Two fields, email first (see the gap noted above).
        if ($type === 'pairedCredentials') {
            return $this->text['email_label'] ?? null;
        }

        if ($type === 'ageVerification') {
            return null; // the date field has its own wording
        }

        if (str_contains(strtolower($type), 'email')) {
            return $this->text['email_label'] ?? null;
        }

        return $this->text['passcode_label'] ?? null;
    }
}
