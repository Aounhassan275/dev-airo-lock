<?php

namespace App\Services;

/**
 * Resolves the lock popup's text at metafield-write time.
 *
 * Why not leave it to the storefront: the popup's translation layer lives in
 * the theme app extension, so it only exists on stores running an extension
 * version that shipped it. Baking the text into the metafield instead means
 * the popup renders in the merchant's chosen language on every store, because
 * every field written here is one the popup has read since long before
 * translations existed:
 *
 *   designOptions.headerSettings.text  -> the title
 *   designOptions.layout.buttonText    -> the submit button
 *   designOptions.placeholderText      -> the code input placeholder
 *   rule prompt                        -> the description line
 *   condition.label                    -> each generated field's label
 *
 * Anything the merchant typed themselves is left alone — their wording always
 * outranks a translation.
 *
 * Two modes, both honoured:
 *   fixed — every visitor gets one language, so plain strings are written.
 *   auto  — the visitor's own language wins, so locale-keyed objects are
 *           written ({"default": "...", "fr": "..."}), which the storefront's
 *           AccessUtils.localize() has always known how to resolve.
 */
class PopupTextBaker
{
    /** Condition types that put an input box in the popup. */
    private const INPUT_TYPES = [
        'singlePasscode',
        'passcode',
        'multiplePasscodes',
        'passcodeFromList',
        'specificEmail',
        'emailContains',
        'emailFromList',
        'ageVerification',
        'pairedCredentials',
    ];

    /** @return string[] condition types that put an input box in the popup */
    public static function inputTypes(): array
    {
        return self::INPUT_TYPES;
    }

    private string $mode;

    /** @var string[] locales to emit; one entry in fixed mode. */
    private array $locales;

    /** @var array<string, mixed> the widget's language.translations */
    private array $overrides;

    /**
     * @param  array<string, mixed>|null  $language     widget configuration's `language`
     * @param  string[]                   $storeLocales locales the shop publishes (auto mode)
     */
    public function __construct(?array $language, array $storeLocales = [])
    {
        $this->mode = ($language['mode'] ?? 'auto') === 'fixed' ? 'fixed' : 'auto';
        $this->overrides = is_array($language['translations'] ?? null) ? $language['translations'] : [];

        if ($this->mode === 'fixed') {
            $pinned = PopupTranslator::normalize($language['locale'] ?? '');
            $this->locales = $pinned !== '' ? [$pinned] : ['en'];

            return;
        }

        $locales = array_values(array_unique(array_filter(array_map(
            fn ($l) => PopupTranslator::normalize(is_array($l) ? ($l['locale'] ?? '') : $l),
            $storeLocales
        ))));

        $this->locales = $locales !== [] ? $locales : ['en'];
    }

    /** True when there is nothing to bake (single English locale, no overrides). */
    public function isNoop(): bool
    {
        return $this->mode === 'auto'
            && $this->locales === ['en']
            && $this->overrides === [];
    }

    /**
     * Resolve one key into whatever shape the storefront can read:
     * a plain string in fixed mode, a locale-keyed object in auto mode.
     *
     * @param  array<string, string|int>  $vars
     * @return string|array<string, string>
     */
    public function text(string $key, array $vars = [])
    {
        if ($this->mode === 'fixed') {
            return PopupTranslator::get($key, $this->locales[0], $vars, $this->overrides);
        }

        $out = ['default' => PopupTranslator::get($key, 'en', $vars, $this->overrides)];

        foreach ($this->locales as $locale) {
            $out[$locale] = PopupTranslator::get($key, $locale, $vars, $this->overrides);
        }

        return $out;
    }

    /**
     * The message key the popup would auto-generate for these conditions.
     * Mirrors conditionMessageKey() in access_ui.js — keep the two in step.
     *
     * @param  array<int, array<string, mixed>>  $conditions
     */
    public static function conditionMessageKey(array $conditions): string
    {
        if ($conditions === []) {
            return 'prompt.default';
        }

        $types = [];
        $signedInValues = [];

        foreach ($conditions as $group) {
            foreach (($group['conditions'] ?? []) as $condition) {
                $type = $condition['type'] ?? null;
                if ($type && ! in_array($type, $types, true)) {
                    $types[] = $type;
                }
                if ($type === 'signedIn') {
                    $signedInValues[] = $condition['value'] ?? 'loggedIn';
                }
            }
        }

        $isAnd = strtoupper($conditions[0]['operator'] ?? 'OR') === 'AND';
        $has = fn (string $type) => in_array($type, $types, true);
        $hasEmail = $has('specificEmail') || $has('emailContains') || $has('emailFromList');
        $hasInput = array_intersect($types, self::INPUT_TYPES) !== [];

        $guestOnly = $signedInValues !== [] && array_filter($signedInValues, fn ($v) => $v !== 'guest') === [];
        $signedInKey = $guestOnly ? 'prompt.guestOnly' : 'prompt.signIn';

        if ($hasInput && $has('signedIn')) {
            return $isAnd ? 'prompt.signInAndCode' : 'prompt.signInOrCode';
        }
        if ($hasInput && $has('tag')) {
            return $isAnd ? 'prompt.tagAndCode' : 'prompt.tagOrCode';
        }
        if ($hasInput && $hasEmail) {
            return $isAnd ? 'prompt.emailAndCode' : 'prompt.emailOrCode';
        }
        if ($hasInput && $has('location')) {
            return 'prompt.codeLocation';
        }
        if ($has('signedIn') && count($types) === 1) {
            return $signedInKey;
        }
        if ($has('tag') && count($types) === 1) {
            return 'prompt.members';
        }
        if ($has('singleSecretLink') || $has('secretLinkFromList')) {
            return 'prompt.secretLink';
        }
        if ($has('location') && count($types) === 1) {
            return 'prompt.region';
        }
        if ($has('ip') && count($types) === 1) {
            return 'prompt.network';
        }
        if ($hasEmail) {
            return 'prompt.authorizedEmail';
        }
        if ($has('signedIn')) {
            return $signedInKey;
        }
        if ($has('tag')) {
            return 'prompt.members';
        }

        return 'prompt.contact';
    }

    /**
     * Which key the description line should use — mirrors renderModal(): an
     * input-only lock keeps the generic line, anything else describes the
     * condition that has to be satisfied.
     *
     * @param  array<int, array<string, mixed>>  $conditions
     */
    public static function promptKey(array $conditions): string
    {
        $types = [];
        foreach ($conditions as $group) {
            foreach (($group['conditions'] ?? []) as $condition) {
                if ($type = $condition['type'] ?? null) {
                    $types[] = $type;
                }
            }
        }

        $hasInput = array_intersect($types, self::INPUT_TYPES) !== [];
        $hasNonInput = array_diff($types, self::INPUT_TYPES) !== [];

        return ($hasInput && ! $hasNonInput) ? 'prompt.default' : self::conditionMessageKey($conditions);
    }

    /**
     * Fill in each generated field's label, so "Enter Passcode" is not the one
     * English string left in an otherwise translated popup. Repeated fields of
     * the same kind stay numbered, matching the storefront's own labelling.
     *
     * @param  array<int, array<string, mixed>>  $conditions
     * @return array<int, array<string, mixed>>
     */
    public function withFieldLabels(array $conditions): array
    {
        // Count first: a lone passcode reads "Enter Passcode", but two of them
        // must read "Passcode 1" / "Passcode 2" or the customer cannot tell
        // which box takes which code.
        $totals = [];
        foreach ($conditions as $group) {
            foreach (($group['conditions'] ?? []) as $condition) {
                $key = $this->labelKeyFor($condition['type'] ?? '');
                if ($key !== null && ($condition['label'] ?? '') === '') {
                    $totals[$key] = ($totals[$key] ?? 0) + 1;
                }
            }
        }

        $seen = [];
        $numbered = ['label.passcode' => 'label.passcodeN', 'label.email' => 'label.emailN'];

        foreach ($conditions as $groupIndex => $group) {
            foreach (($group['conditions'] ?? []) as $index => $condition) {
                $key = $this->labelKeyFor($condition['type'] ?? '');

                // A label the merchant typed is their wording; never touch it.
                if ($key === null || ($condition['label'] ?? '') !== '') {
                    continue;
                }

                if (($totals[$key] ?? 0) > 1 && isset($numbered[$key])) {
                    $seen[$key] = ($seen[$key] ?? 0) + 1;
                    $label = $this->text($numbered[$key], ['n' => $seen[$key]]);
                } else {
                    $label = $this->text($key);
                }

                $conditions[$groupIndex]['conditions'][$index]['label'] = $label;
            }
        }

        return $conditions;
    }

    private function labelKeyFor(string $type): ?string
    {
        if (! in_array($type, self::INPUT_TYPES, true)) {
            return null;
        }

        // A condition gets ONE baked label, which cannot describe a condition
        // that renders two fields of different kinds. 'pairedCredentials' draws
        // an email box and a passcode box, and the storefront applies a label
        // on the condition to its FIRST field — so baking one here put "Enter
        // Passcode" above the email input. Left unbaked, the popup labels each
        // field from its own labelKey and translates both per visitor, which is
        // what this method was trying to achieve in the first place.
        if ($type === 'pairedCredentials') {
            return null;
        }

        if (str_contains(strtolower($type), 'email')) {
            return 'label.email';
        }
        if ($type === 'ageVerification') {
            return 'label.dob';
        }

        return 'label.passcode';
    }

    /**
     * Write translated defaults into the widget's design payload, leaving
     * every merchant-authored value untouched.
     *
     * @param  array<string, mixed>  $widgetPayload
     * @return array<string, mixed>
     */
    public function withWidgetText(array $widgetPayload): array
    {
        $settings = $widgetPayload['settings'] ?? null;
        if (! is_array($settings)) {
            return $widgetPayload;
        }

        $design = is_array($settings['designOptions'] ?? null) ? $settings['designOptions'] : [];

        // Title — only when the merchant has not written their own header.
        $header = is_array($design['headerSettings'] ?? null) ? $design['headerSettings'] : [];
        if (($header['text'] ?? '') === '') {
            $header['text'] = $this->text('header.locked');
            $design['headerSettings'] = $header;
        }

        // Submit button — blank means "use the translated default".
        $layout = is_array($design['layout'] ?? null) ? $design['layout'] : [];
        if (($layout['buttonText'] ?? '') === '') {
            $layout['buttonText'] = $this->text('button.submit');
            $design['layout'] = $layout;
        }

        if (($design['placeholderText'] ?? '') === '') {
            $design['placeholderText'] = $this->text('placeholder.code');
        }

        if (($design['emailPlaceholderText'] ?? '') === '') {
            $design['emailPlaceholderText'] = $this->text('placeholder.email');
        }

        $settings['designOptions'] = $design;
        $widgetPayload['settings'] = $settings;

        return $widgetPayload;
    }
}
