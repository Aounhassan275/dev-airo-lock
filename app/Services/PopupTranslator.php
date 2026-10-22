<?php

namespace App\Services;

/**
 * Server-side twin of the storefront's AccessI18n.
 *
 * The popup's own JS can translate itself, but only in the extension version
 * that ships that code — a storefront still serving an older extension has no
 * translation layer at all and renders English whatever the metafield says.
 * Resolving the text here and writing it into the metafield means the popup
 * comes out in the merchant's chosen language on ANY extension version, since
 * every field we write is one the popup has always read.
 *
 * Lookup order matches AccessI18n.t() exactly:
 *   merchant override (exact locale -> language -> "default")
 *   -> built-in catalog (exact locale -> language)
 *   -> English -> the key itself
 */
class PopupTranslator
{
    /** @var array<string, array<string, string>>|null */
    private static ?array $catalog = null;

    /** Locale codes Shopify publishes that our catalog keys differently. */
    private const ALIASES = [
        'zh' => 'zh-cn',
        'zh-hans' => 'zh-cn',
        'zh-hant' => 'zh-tw',
        'zh-hk' => 'zh-tw',
        'zh-mo' => 'zh-tw',
        'zh-sg' => 'zh-cn',
        'no' => 'nb',
        'nn' => 'nb',
        'pt-br' => 'pt',
        'pt-pt' => 'pt',
    ];

    /** @return array<string, array<string, string>> */
    private static function catalog(): array
    {
        if (self::$catalog !== null) {
            return self::$catalog;
        }

        $path = base_path('resources/lang/popup_translations.json');
        $decoded = is_readable($path)
            ? json_decode((string) file_get_contents($path), true)
            : null;

        self::$catalog = is_array($decoded['strings'] ?? null) ? $decoded['strings'] : ['en' => []];

        return self::$catalog;
    }

    public static function normalize(?string $locale): string
    {
        return strtolower(str_replace('_', '-', trim((string) $locale)));
    }

    /**
     * Candidate catalog keys for a locale, most specific first.
     *
     * @return string[]
     */
    private static function candidates(string $locale): array
    {
        $locale = self::normalize($locale);
        if ($locale === '') {
            return [];
        }

        $out = [];
        if (isset(self::ALIASES[$locale])) {
            $out[] = self::ALIASES[$locale];
        }
        $out[] = $locale;

        $language = explode('-', $locale)[0];
        if ($language !== '' && $language !== $locale) {
            if (isset(self::ALIASES[$language])) {
                $out[] = self::ALIASES[$language];
            }
            $out[] = $language;
        }

        return $out;
    }

    /** @param array<string, mixed> $bag */
    private static function lookup(array $bag, string $locale, string $key): ?string
    {
        foreach (self::candidates($locale) as $candidate) {
            $value = $bag[$candidate][$key] ?? null;
            if (is_string($value) && trim($value) !== '') {
                return $value;
            }
        }

        return null;
    }

    /**
     * Translate one key.
     *
     * @param  array<string, string|int>  $vars       fills {placeholders}
     * @param  array<string, mixed>       $overrides  the widget's language.translations
     */
    public static function get(string $key, ?string $locale, array $vars = [], array $overrides = []): string
    {
        $value = self::lookup($overrides, (string) $locale, $key);

        if ($value === null) {
            $fallback = $overrides['default'][$key] ?? null;
            if (is_string($fallback) && trim($fallback) !== '') {
                $value = $fallback;
            }
        }

        $value ??= self::lookup(self::catalog(), (string) $locale, $key);
        $value ??= self::catalog()['en'][$key] ?? $key;

        foreach ($vars as $name => $replacement) {
            $value = str_replace('{'.$name.'}', (string) $replacement, $value);
        }

        return $value;
    }

    /** True when the catalog ships translations for this locale. */
    public static function isSupported(?string $locale): bool
    {
        foreach (self::candidates((string) $locale) as $candidate) {
            if (isset(self::catalog()[$candidate])) {
                return true;
            }
        }

        return false;
    }
}
