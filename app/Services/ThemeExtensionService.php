<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Detects whether the Airo Lock theme **app embed** is activated on the
 * merchant's live (published) theme, and builds the theme-editor deep link
 * that activates it with a single Save.
 *
 * Why this exists: the storefront locks are enforced by the `access_controll`
 * app embed (target: head). Shopify ships app embeds **deactivated by default**
 * after install — the merchant has to switch them on in
 * Online Store > Themes > Customize > App embeds. When they don't, every lock
 * silently does nothing ("the locks aren't working"). We detect that state and
 * nudge the merchant straight to the right screen.
 */
class ThemeExtensionService
{
    /**
     * The app embed block handle = the Liquid filename without extension
     * (extensions/access-controll/blocks/access_controll.liquid).
     * App embed block `type` values in settings_data.json look like:
     *   shopify://apps/<app-handle>/blocks/access_controll/<extension-uuid>
     * Matching on "/blocks/access_controll/" is independent of app handle/uuid.
     */
    private const BLOCK_HANDLE = 'access_controll';

    private const CACHE_TTL_MINUTES = 10;

    /**
     * Return ['enabled' => bool, 'reason' => string, 'deepLink' => string].
     *
     * `reason` is the diagnostic that tells us WHY the embed reads as on/off:
     *   embed-active | embed-disabled | embed-absent | graphql-error:… |
     *   no-theme-or-file | settings-unreadable | settings-not-json | check-failed:…
     */
    public function status(User $shop, bool $fresh = false): array
    {
        $check = $this->evaluate($shop, $fresh);

        return [
            'enabled' => $check['enabled'],
            'reason' => $check['reason'],
            'deepLink' => $this->deepLink($shop),
        ];
    }

    /**
     * Is the app embed activated on the published theme?
     */
    public function isEnabled(User $shop, bool $fresh = false): bool
    {
        return $this->evaluate($shop, $fresh)['enabled'];
    }

    /**
     * Resolve ['enabled' => bool, 'reason' => string], cached per-shop so we don't
     * hit the Admin API on every dashboard load.
     *
     * Fails "open" (enabled=true) on any thrown error so we never show a false
     * "disabled" alarm to a merchant who has, in fact, enabled it — but every
     * decision is logged with its reason so a silent fail-open is now diagnosable.
     */
    private function evaluate(User $shop, bool $fresh = false): array
    {
        // New cache key (was airo:embed_enabled) — also busts any stale boolean
        // cached by the previous implementation.
        $key = "airo:embed_status:{$shop->id}";

        if ($fresh) {
            Cache::forget($key);
        }

        return Cache::remember($key, now()->addMinutes(self::CACHE_TTL_MINUTES), function () use ($shop) {
            try {
                $result = $this->checkRemote($shop);

                Log::info('ThemeExtensionService: embed check', [
                    'shop_id' => $shop->id,
                    'enabled' => $result['enabled'],
                    'reason' => $result['reason'],
                ]);
            } catch (\Throwable $e) {
                Log::warning('ThemeExtensionService: embed check threw', [
                    'shop_id' => $shop->id,
                    'error' => $e->getMessage(),
                ]);

                // Assume enabled on failure — better to miss a disabled store
                // than to nag a merchant who already turned it on.
                $result = ['enabled' => true, 'reason' => 'check-failed:'.Str::limit($e->getMessage(), 160)];
            }

            // Mirror the result onto the store's admin record (best-effort) so
            // support can see which merchants have the embed enabled.
            $this->persistStatus($shop, $result);

            return $result;
        });
    }

    /**
     * Record the last-known embed status on the store's admin row. Best-effort —
     * a persistence hiccup must never break the status check itself.
     */
    private function persistStatus(User $shop, array $result): void
    {
        try {
            \App\Models\StoreDetail::updateOrCreate(
                ['user_id' => $shop->id],
                [
                    'embed_enabled' => (bool) $result['enabled'],
                    'embed_reason' => $result['reason'] ?? null,
                    'embed_checked_at' => now(),
                ]
            );
        } catch (\Throwable $e) {
            Log::warning('ThemeExtensionService: failed to persist embed status', [
                'shop_id' => $shop->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Deep link that opens the theme editor with the app embed pre-activated.
     * Merchant only has to press "Save".
     *
     * Format (api_key is the non-deprecated form of the old {uuid}):
     *   https://<shop>/admin/themes/current/editor?context=apps&activateAppId=<api_key>/<handle>
     */
    public function deepLink(User $shop): string
    {
        $domain = $shop->getDomain()->toNative();
        $apiKey = config('shopify-app.api_key');

        return "https://{$domain}/admin/themes/current/editor"
            . '?context=apps'
            . '&activateAppId=' . $apiKey . '/' . self::BLOCK_HANDLE;
    }

    /**
     * Slim cached check used by the notice — delegates to inspect() and keeps
     * only the two fields the cache + dashboard need.
     *
     * @return array{enabled: bool, reason: string}
     */
    private function checkRemote(User $shop): array
    {
        $d = $this->inspect($shop);

        return ['enabled' => $d['enabled'], 'reason' => $d['reason']];
    }

    /**
     * Full, UNCACHED diagnostic of the embed state. Backs `/extension/status?debug=1`
     * so the reason can be *verified* (not guessed): it returns every fact that
     * fed the decision — the theme it read, whether settings_data.json was
     * fetched, the matched embed block + its `disabled` flag, and any raw GraphQL
     * errors. Branches that can't prove the embed is off fail "open"
     * (enabled=true) but each carries a distinct reason.
     *
     * reason ∈ { embed-active, embed-disabled, embed-absent, graphql-error:…,
     *            no-theme-or-file, settings-unreadable, settings-not-json }
     *
     * @return array{enabled: bool, reason: string, blockHandle: string, theme: ?array, settings: array, embed: array, graphqlErrors: ?array}
     */
    public function inspect(User $shop): array
    {
        $debug = [
            'enabled' => true,
            'reason' => 'unknown',
            'blockHandle' => self::BLOCK_HANDLE,
            'theme' => null,
            'settings' => ['found' => false, 'source' => null, 'bytes' => null],
            'embed' => ['found' => false, 'type' => null, 'disabled' => null],
            'graphqlErrors' => null,
        ];

        $query = <<<'GQL'
            query AiroLockThemeEmbedStatus {
                themes(first: 1, roles: [MAIN]) {
                    nodes {
                        id
                        name
                        role
                        files(filenames: ["config/settings_data.json"], first: 1) {
                            nodes {
                                body {
                                    __typename
                                    ... on OnlineStoreThemeFileBodyText { content }
                                    ... on OnlineStoreThemeFileBodyUrl { url }
                                }
                            }
                        }
                    }
                }
            }
            GQL;

        $response = $shop->api()->graph($query);
        $body = json_decode(json_encode($response['body'] ?? []), true);

        // GraphQL-level errors (e.g. the access token was granted before
        // read_themes was added to the app's scopes → "Access denied for themes
        // field. Required access: `read_themes` scope.").
        if (! empty($body['errors'])) {
            Log::warning('ThemeExtensionService: themes graphql errors', [
                'shop_id' => $shop->id,
                'errors' => $body['errors'],
            ]);

            $debug['graphqlErrors'] = $body['errors'];
            $debug['reason'] = 'graphql-error:'.Str::limit(json_encode($body['errors']), 200);

            return $debug;
        }

        $themeNode = $body['data']['themes']['nodes'][0] ?? null;
        if ($themeNode) {
            $debug['theme'] = [
                'id' => $themeNode['id'] ?? null,
                'name' => $themeNode['name'] ?? null,
                'role' => $themeNode['role'] ?? null,
            ];
        }

        $fileBody = $themeNode['files']['nodes'][0]['body'] ?? null;
        if (! $fileBody) {
            // No main theme / file unreadable — can't prove it's disabled.
            $debug['reason'] = 'no-theme-or-file';

            return $debug;
        }

        $json = $fileBody['content'] ?? null;
        $debug['settings']['source'] = $json !== null ? 'inline' : (! empty($fileBody['url']) ? 'url' : null);

        // Large settings_data.json is returned as a URL instead of inline text.
        if ($json === null && ! empty($fileBody['url'])) {
            $json = Http::timeout(8)->get($fileBody['url'])->body();
        }

        if (! is_string($json) || $json === '') {
            $debug['reason'] = 'settings-unreadable';

            return $debug;
        }

        $debug['settings']['found'] = true;
        $debug['settings']['bytes'] = strlen($json);

        // Shopify's newer themes (e.g. Horizon) ship settings_data.json as
        // *relaxed* JSON — it can contain // and /* */ comments, trailing
        // commas, and a leading BOM, all of which make strict json_decode()
        // return null. Try strict first (fast path for well-formed files), then
        // fall back to a tolerant parse so a valid-but-relaxed file isn't
        // misread as "not JSON" (which previously failed open and hid the
        // notice for every merchant on such a theme).
        $settings = json_decode($json, true);
        if (! is_array($settings)) {
            $settings = json_decode($this->relaxedJsonToStrict($json), true);
            $debug['settings']['relaxed'] = is_array($settings);
        }
        if (! is_array($settings)) {
            $debug['reason'] = 'settings-not-json';

            return $debug;
        }

        $embed = $this->scanForEmbed($settings);

        // Not present at all → never activated → disabled.
        if ($embed === null) {
            $debug['enabled'] = false;
            $debug['reason'] = 'embed-absent';

            return $debug;
        }

        // Present but explicitly disabled → disabled.
        $disabled = ($embed['disabled'] ?? false) === true;
        $debug['embed'] = [
            'found' => true,
            'type' => $embed['type'] ?? null,
            'disabled' => $disabled,
        ];
        $debug['enabled'] = ! $disabled;
        $debug['reason'] = $disabled ? 'embed-disabled' : 'embed-active';

        return $debug;
    }

    /**
     * Recursively walk the decoded settings_data.json for any block entry whose
     * `type` references our app embed. Robust to theme-specific nesting
     * (current.blocks, presets, sections, …).
     */
    private function scanForEmbed($node): ?array
    {
        if (! is_array($node)) {
            return null;
        }

        if (isset($node['type']) && is_string($node['type'])
            && str_contains($node['type'], '/blocks/' . self::BLOCK_HANDLE . '/')) {
            return $node;
        }

        foreach ($node as $child) {
            if (is_array($child)) {
                $found = $this->scanForEmbed($child);
                if ($found !== null) {
                    return $found;
                }
            }
        }

        return null;
    }

    /**
     * Convert Shopify's relaxed theme JSON (which may contain `//` and block
     * comments, trailing commas, and a leading UTF-8 BOM) into strict JSON that
     * json_decode() accepts.
     *
     * String literals are walked verbatim, so comment-like text or commas that
     * appear *inside* a value (e.g. a URL or a message) are never altered — only
     * structural comments and trailing commas are stripped.
     */
    private function relaxedJsonToStrict(string $json): string
    {
        // Drop a leading UTF-8 BOM if present.
        if (str_starts_with($json, "\xEF\xBB\xBF")) {
            $json = substr($json, 3);
        }

        $out = '';
        $len = strlen($json);
        $inString = false;
        $i = 0;

        while ($i < $len) {
            $char = $json[$i];
            $next = $i + 1 < $len ? $json[$i + 1] : '';

            if ($inString) {
                // Copy escaped pairs (\", \\, \/, …) verbatim so an escape can't
                // hide the closing quote.
                if ($char === '\\' && $next !== '') {
                    $out .= $char.$next;
                    $i += 2;
                    continue;
                }
                $out .= $char;
                if ($char === '"') {
                    $inString = false;
                }
                $i++;
                continue;
            }

            if ($char === '"') {
                $inString = true;
                $out .= $char;
                $i++;
                continue;
            }

            // Line comment // … → skip to end of line.
            if ($char === '/' && $next === '/') {
                $i += 2;
                while ($i < $len && $json[$i] !== "\n" && $json[$i] !== "\r") {
                    $i++;
                }
                continue;
            }

            // Block comment /* … */ → skip to the closing */.
            if ($char === '/' && $next === '*') {
                $i += 2;
                while ($i + 1 < $len && ! ($json[$i] === '*' && $json[$i + 1] === '/')) {
                    $i++;
                }
                $i += 2;
                continue;
            }

            $out .= $char;
            $i++;
        }

        // Remove trailing commas before a closing } or ].
        return preg_replace('/,(\s*[}\]])/', '$1', $out);
    }
}
