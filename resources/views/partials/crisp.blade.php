{{--
    Crisp chatbox with session continuity.

    Include it once, from the blade layout that renders the embedded app, inside
    the scripts section:

        @include('partials.crisp')

    Renders nothing unless CRISP_WEBSITE_ID is set, so it is safe to deploy
    before the app has a Crisp website.
--}}

@php
    $crispShop = Auth::user();

    /*
     | Shop context for the support agent. This app caches the shop's Shopify
     | details in `store_details` (App\Models\StoreDetail, hasOne `storeDetail`
     | on the user), so the columns below are named for THIS schema rather than
     | the lowest common denominator across our apps — if you port this partial
     | to another app, re-check the column names against its migrations.
     |
     | The relation is null until StoreDetailSync has run, so every read is
     | null-safe: a brand-new install must still get a working chatbox.
     |
     | None of this affects session continuity. It is only what the agent sees
     | beside the conversation, so it is ordered by what they reach for first
     | and empty values are dropped rather than shown blank.
     */
    $crispStore = $crispShop?->storeDetail;

    $crispData = [];
    $crispPut = function (string $key, $value) use (&$crispData) {
        $value = is_string($value) ? trim($value) : $value;
        if ($value !== null && $value !== '') {
            $crispData[$key] = (string) $value;
        }
    };

    $crispPut('app_name', config('crisp.app_name'));
    // $crispPut('store_id', $crispShop?->getKey());
    // users.name IS the myshopify domain; store_details.shop_name is the
    // merchant-facing store name. Show both — the agent searches by one and
    // recognises the other.
    $crispPut('store_name', $crispStore?->shop_name ?: $crispShop?->name);
    $crispPut('myshopify_domain', $crispStore?->shopify_domain ?: $crispShop?->name);
    $crispPut('storefront_url', $crispStore?->primary_domain);

    $crispPut('app_plan', $crispShop?->plan?->name);
    // if ($crispShop && $crispShop->isInTrial()) {
    //     $crispPut('app_trial', $crispShop->getTrialDaysRemaining() . ' days left');
    // }

    /*
     | THE first question on any "the app isn't working" ticket. Shopify ships
     | app embeds deactivated after install, and until the merchant switches the
     | theme embed on every lock they create silently does nothing (see section
     | 4.1 of DEVELOPER.md). embed_enabled is nullable: null means we have never
     | managed to check, which is not the same as "off".
     */
    if ($crispStore) {
        // $crispPut('theme_embed', match (true) {
        //     $crispStore->embed_enabled === true => 'Enabled',
        //     $crispStore->embed_enabled === false => 'OFF — locks do nothing'
        //         . ($crispStore->embed_reason ? ' (' . $crispStore->embed_reason . ')' : ''),
        //     default => 'Never checked',
        // });

        // Plus decides whether the checkout hard-block is available at all, and
        // a dev store is always billed in test mode — both change the answer to
        // "why am I seeing this?", so they ride along with the Shopify plan.
        $crispShopifyPlan = array_filter([
            $crispStore->plan_name,
            $crispStore->shopify_plus ? 'Plus' : null,
            $crispStore->partner_development ? 'dev store' : null,
        ]);
        $crispPut('shopify_plan', implode(' · ', $crispShopifyPlan));

        // Anything other than active explains a shop that has gone quiet.
        // if ($crispStore->store_status && $crispStore->store_status !== \App\Models\StoreDetail::STATUS_ACTIVE) {
        //     $crispPut('store_status', $crispStore->store_status
        //         . ($crispStore->store_status_reason ? ' (' . $crispStore->store_status_reason . ')' : ''));
        // }

        // Timezone is here because locks are scheduled: "it activated at the
        // wrong time" is nearly always a timezone question.
        // $crispPut('store_locale', implode(' · ', array_filter([
        //     $crispStore->country,
        //     $crispStore->currency,
        //     $crispStore->iana_timezone,
        // ])));

        // Multi-language stores resolve the popup's text differently (section
        // 18), so the agent needs to know before debugging any wording report.
        // shop_locales is the full published list including the primary one,
        // so the count is a total, not an "and N more".
        $crispLocaleCount = is_array($crispStore->shop_locales) ? count($crispStore->shop_locales) : 0;
        // $crispPut('storefront_languages', $crispStore->primary_locale
        //     ? $crispStore->primary_locale . ($crispLocaleCount > 1 ? " · {$crispLocaleCount} languages" : '')
        //     : null);
    }
@endphp

@if (config('crisp.website_id'))
<script type="text/javascript">
    window.$crisp = [];
    window.CRISP_WEBSITE_ID = @js(config('crisp.website_id'));

    window.$crisp.push(["config", "position:reverse", [true]]);
@if (config('crisp.avatar'))
    window.$crisp.push(["set", "user:avatar", @js(config('crisp.avatar'))]);
@endif
@if ($crispShop)
    {{-- Nickname only. Deliberately no `user:email`: Crisp merges people by
         email, so tagging the shop's address onto whoever is signed in would
         fold staff and collaborator sessions into the merchant's record. --}}
    window.$crisp.push(["set", "user:nickname", [@js((string) ($crispStore?->shop_name ?: ($crispShop->name ?? '')))]]);
@endif
    window.$crisp.push(["set", "session:data", [
        [
@foreach ($crispData as $crispKey => $crispValue)
            [@js($crispKey), @js($crispValue)],
@endforeach
        ]
    ]]);

    /*
     * Session continuity. The app runs inside the Shopify admin iframe, so the
     * session id Crisp keeps in the browser is third-party storage and gets
     * dropped between visits — the merchant comes back and support sees a brand
     * new conversation with none of the history. CRISP_TOKEN_ID is the stable
     * session id of whoever is signed into this admin, so Crisp restores their
     * thread instead, on any browser or device.
     *
     * The id comes from the server (see CrispIdentity) in exchange for an App
     * Bridge session token, because Shopify only puts `id_token` on the URL for
     * some loads — it is gone once the URL is rewritten client-side, so a
     * refresh on an inner page arrives without it. `shopify.idToken()` always
     * has one.
     *
     * The token has to be set BEFORE l.js is injected; Crisp only reads it at
     * boot. Anything that goes wrong along the way just boots the chatbox
     * untokenised — support stays reachable, it only loses the history.
     */
    (function () {
        var booted = false;

        function boot() {
            if (booted) return;
            booted = true;
            var d = document, s = d.createElement("script");
            s.src = "https://client.crisp.chat/l.js";
            s.async = 1;
            d.getElementsByTagName("head")[0].appendChild(s);
        }

        // Never let a slow lookup cost us the chatbox entirely.
        setTimeout(boot, 3000);

        if (!window.shopify || typeof window.shopify.idToken !== "function") {
            boot();
            return;
        }

        window.shopify.idToken()
            .then(function (idToken) {
                return fetch(@js(route('crisp.session')), {
                    headers: {
                        "Authorization": "Bearer " + idToken,
                        "Accept": "application/json"
                    }
                });
            })
            .then(function (response) {
                return response.ok ? response.json() : null;
            })
            .then(function (data) {
                if (data && data.token && !booted) {
                    window.CRISP_TOKEN_ID = data.token;
                }
            })
            .catch(function () {})
            .then(boot);
    })();
</script>
@endif
