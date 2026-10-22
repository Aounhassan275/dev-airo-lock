{{--
    Airo Partner Apps dock — physical 3D pull-tab on the RIGHT EDGE (vertically
    centered) that slides out a compact drawer of the published Airo apps with
    their REAL App Store logos, ratings and links.

    THEME: matches the Airo app-icon brand — matte BLACK surfaces, bold white
    type, and the purple-gradient "Airo" accent (the white wordmark pill from
    the logos is echoed in the drawer header mark).

    ── COPY-PASTE PORTABLE ────────────────────────────────────────────────────
    Fully self-contained (inline styles + vanilla JS, namespaced ffpad-): no
    build step, no framework — drop this file into resources/views/ of ANY app
    and include it from the app layout's content section:

        @include('partner-apps-dock', ['exclude' => 'barcode'])

    `exclude` hides the host app from its own list. Keys:
        barcode | flows | bulk-editor | locksmith | pos

    ── PERFORMANCE ────────────────────────────────────────────────────────────
    Animations are compositor-only (transform + opacity). No backdrop-filter,
    no box-shadow transitions (hover shadows are pre-rendered on ::after and
    faded via opacity), drawer stays in the DOM so logos preload and open AND
    close both glide.
--}}
@php
    $ffpadApps = [
        [
            'key' => 'barcode',
            'name' => 'Airo Retail Barcode Generator',
            'tagline' => 'Barcode generator & retail labels — UPC, GTIN, EAN & more',
            'url' => 'https://apps.shopify.com/airo-sku-barcode-generator',
            'logo' => 'https://cdn.shopify.com/s/files/1/0718/7723/0786/files/SKU.png?v=1772877734',
            'rating' => '4.9', 'reviews' => 68, 'monogram' => 'B',
        ],
        [
            'key' => 'flows',
            'name' => 'Ai Workflow Automation & Flow',
            'tagline' => 'Enterprise automation platform with integrations & workflows',
            'url' => 'https://apps.shopify.com/airoflows',
            'logo' => 'https://cdn.shopify.com/s/files/1/0786/1197/2334/files/Automation.png?v=1772704626',
            'rating' => '5.0', 'reviews' => 45, 'monogram' => 'W',
        ],
        [
            'key' => 'bulk-editor',
            'name' => 'Airo Bulk Product Editor',
            'tagline' => 'Smart AI bulk edit — prices, titles, metafields & tags',
            'url' => 'https://apps.shopify.com/airo-bulk-editor',
            'logo' => 'https://cdn.shopify.com/app-store/listing_images/a11463ebdf910068e50a071f6bb5affa/icon/CObLs6_Ro5IDEAE=.png',
            'rating' => '5.0', 'reviews' => 30, 'monogram' => 'E',
        ],
        [
            'key' => 'locksmith',
            'name' => 'Locksmith : Password Protect',
            'tagline' => 'Access control, password protect & unlock exclusive pages',
            'url' => 'https://apps.shopify.com/acesslock',
            'logo' => 'https://cdn.shopify.com/s/files/1/0718/7723/0786/files/Lock.png?v=1778586829',
            'rating' => '5.0', 'reviews' => 27, 'monogram' => 'L',
        ],
        [
            'key' => 'pos',
            'name' => 'Restaurant | Cafe: Coffee Shop',
            'tagline' => 'Run restaurant & cafe POS with KDS, modifiers, tickets & more',
            'url' => 'https://apps.shopify.com/airo-resturant-pos',
            'logo' => 'https://cdn.shopify.com/s/files/1/0805/0507/8001/files/Resturant_POS.png?v=1782885897',
            'rating' => '5.0', 'reviews' => 26, 'monogram' => 'P',
        ],
        [
            'key' => 'ymm',
            'name' => 'Airo YMM Search: Year Make Model',
            'tagline' => 'Year/Make/Model fitment search — shoppers find parts that fit',
            'url' => 'https://apps.shopify.com/airo-ymm-search',
            'logo' => 'https://cdn.shopify.com/app-store/listing_images/4f4b7df715421f63e90c7d56f648f572/icon/CP3Ev-Og9ZUDEAE=.png',
            'rating' => '5.0', 'reviews' => 25, 'monogram' => 'Y',
        ],
    ];
    $ffpadExclude = $exclude ?? '';
    $ffpadApps = array_values(array_filter($ffpadApps, fn ($a) => $a['key'] !== $ffpadExclude));
@endphp

<style id="ffpad-styles">
.ffpad-tab{position:fixed;right:0;top:50%;z-index:460;display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px 9px 14px;border:0;border-radius:12px 0 0 12px;cursor:pointer;user-select:none;-webkit-user-select:none;background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,0) 40%),linear-gradient(160deg,#232326 0%,#121214 45%,#050506 100%);box-shadow:inset 1.5px 1.5px 1px rgba(255,255,255,.18),inset -1px -2px 3px rgba(0,0,0,.7),inset 0 0 0 1px rgba(139,92,246,.35),-6px 8px 18px -6px rgba(0,0,0,.6);transform:translateY(-50%) translateZ(0);will-change:transform;transition:transform .2s cubic-bezier(.2,.7,.3,1),opacity .2s ease}
.ffpad-tab::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:-12px 14px 30px -8px rgba(124,58,237,.5);opacity:0;transition:opacity .2s ease;pointer-events:none}
.ffpad-tab:hover{transform:translateY(-50%) translateX(-3px) translateZ(0)}
.ffpad-tab:hover::after{opacity:1}
.ffpad-tab:active{transform:translateY(-50%) translateX(1px) scale(.99) translateZ(0)}
.ffpad-tab.is-hidden{transform:translateY(-50%) translateX(110%) translateZ(0);opacity:0;pointer-events:none}
.ffpad-tab__grip{display:grid;grid-template-columns:repeat(2,3px);gap:3px}
.ffpad-tab__grip i{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.45)}
.ffpad-tab__label{writing-mode:vertical-rl;text-orientation:mixed;transform:rotate(180deg);color:#fff;font-size:11.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 1px 2px rgba(0,0,0,.7);font-family:inherit}
.ffpad-tab__dot{width:7px;height:7px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#c4b5fd,#7c3aed);box-shadow:0 0 6px rgba(139,92,246,.9)}
.ffpad-scrim{position:fixed;inset:0;z-index:470;background:rgba(0,0,0,.55);opacity:0;visibility:hidden;transition:opacity .22s ease,visibility 0s linear .22s}
.ffpad-scrim.is-open{opacity:1;visibility:visible;transition:opacity .22s ease}
.ffpad-drawer{position:fixed;right:0;top:50%;z-index:480;width:min(348px,calc(100vw - 40px));max-height:min(78vh,640px);display:flex;flex-direction:column;border-radius:18px 0 0 18px;overflow:hidden;background:#0b0b0d;box-shadow:-24px 30px 70px -22px rgba(0,0,0,.75),-2px 4px 14px rgba(0,0,0,.5),inset 0 0 0 1px rgba(139,92,246,.28);transform:translateY(-50%) translateX(105%) translateZ(0);opacity:0;visibility:hidden;will-change:transform,opacity;transition:transform .28s cubic-bezier(.2,.7,.3,1),opacity .22s ease,visibility 0s linear .28s;font-family:inherit}
.ffpad-drawer.is-open{transform:translateY(-50%) translateX(0) translateZ(0);opacity:1;visibility:visible;transition:transform .28s cubic-bezier(.2,.7,.3,1),opacity .18s ease}
.ffpad-drawer__head{display:flex;align-items:center;gap:12px;padding:16px 16px 14px;background:radial-gradient(120% 140% at 0% 0%,rgba(124,58,237,.3),transparent 55%),linear-gradient(160deg,#101013,#050506);border-bottom:1px solid rgba(255,255,255,.06)}
.ffpad-drawer__mark{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(139,92,246,.75),0 4px 12px rgba(0,0,0,.5);flex-shrink:0}
.ffpad-drawer__mark b{font-weight:800;font-size:18px;line-height:1;background:linear-gradient(135deg,#8b5cf6,#5b21b6);-webkit-background-clip:text;background-clip:text;color:transparent}
.ffpad-drawer__title{color:#fff;font-size:14.5px;font-weight:700;letter-spacing:.01em;line-height:1.2;margin:0}
.ffpad-drawer__sub{color:rgba(255,255,255,.58);font-size:11.5px;line-height:1.35;margin:2px 0 0}
.ffpad-drawer__close{margin-left:auto;width:30px;height:30px;border:0;border-radius:9px;cursor:pointer;color:rgba(255,255,255,.75);font-size:15px;line-height:1;display:grid;place-items:center;background:rgba(255,255,255,.08);transition:transform .15s ease,opacity .15s ease;flex-shrink:0}
.ffpad-drawer__close:hover{opacity:.85}
.ffpad-drawer__close:active{transform:scale(.94)}
.ffpad-drawer__list{padding:12px;display:flex;flex-direction:column;gap:9px;overflow-y:auto;overscroll-behavior:contain}
.ffpad-card{position:relative;display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:14px;text-decoration:none;background:#141417;border:1px solid rgba(255,255,255,.08);box-shadow:0 1px 2px rgba(0,0,0,.4);transition:transform .16s cubic-bezier(.2,.7,.3,1),border-color .16s ease}
.ffpad-card::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:0 14px 28px -14px rgba(124,58,237,.65);opacity:0;transition:opacity .16s ease;pointer-events:none}
.ffpad-card:hover{transform:translateY(-2px) translateZ(0);border-color:rgba(139,92,246,.55)}
.ffpad-card:hover::after{opacity:1}
.ffpad-card:active{transform:translateY(0) scale(.995)}
.ffpad-card__tile{position:relative;width:44px;height:44px;border-radius:12px;overflow:hidden;display:grid;place-items:center;color:#fff;font-weight:800;font-size:18px;flex-shrink:0;background:linear-gradient(145deg,#232326,#050506);box-shadow:0 5px 12px -5px rgba(0,0,0,.8);text-shadow:0 1px 2px rgba(0,0,0,.6)}
.ffpad-card__tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ffpad-card__tile::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:inset 0 1px 1px rgba(255,255,255,.14),inset 0 -1.5px 3px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.12)}
.ffpad-card__body{min-width:0}
.ffpad-card__name{color:#f4f3f8;font-size:12.8px;font-weight:700;line-height:1.25;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ffpad-card__tag{color:#9b98ab;font-size:11px;line-height:1.35;margin:2px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ffpad-card__meta{display:flex;align-items:center;gap:7px;margin-top:4px;font-size:10.5px;font-weight:600}
.ffpad-card__stars{color:#e3b341}
.ffpad-card__stars b{color:#f4f3f8}
.ffpad-card__free{padding:1px 7px;border-radius:999px;background:rgba(16,185,129,.16);color:#34d399}
.ffpad-card__go{margin-left:auto;color:#55525f;font-size:15px;flex-shrink:0;transition:transform .16s cubic-bezier(.2,.7,.3,1),color .16s ease}
.ffpad-card:hover .ffpad-card__go{transform:translateX(3px);color:#a78bfa}
.ffpad-drawer__foot{padding:11px 16px 13px;border-top:1px solid rgba(255,255,255,.06);background:#0e0e11}
.ffpad-drawer__foot a{color:#a78bfa;font-size:11.5px;font-weight:700;text-decoration:none}
.ffpad-drawer__foot a:hover{text-decoration:underline}
@media (prefers-reduced-motion:reduce){.ffpad-tab,.ffpad-tab::after,.ffpad-scrim,.ffpad-drawer,.ffpad-card,.ffpad-card::after,.ffpad-card__go{transition:none}}
</style>

<button type="button" id="ffpad-tab" class="ffpad-tab" aria-haspopup="dialog" aria-expanded="false" title="Partner apps by Airo">
    <span class="ffpad-tab__grip" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
    <span class="ffpad-tab__label">Partner Apps</span>
    <span class="ffpad-tab__dot" aria-hidden="true"></span>
</button>

<div id="ffpad-scrim" class="ffpad-scrim" aria-hidden="true"></div>

<aside id="ffpad-drawer" class="ffpad-drawer" role="dialog" aria-modal="true" aria-label="Airo Apps — partner apps">
    <header class="ffpad-drawer__head">
        <span class="ffpad-drawer__mark" aria-hidden="true"><b>A</b></span>
        <div>
            <h2 class="ffpad-drawer__title">Airo Apps</h2>
            <p class="ffpad-drawer__sub">More apps from our team — trusted by 70+ five-star reviews</p>
        </div>
        <button type="button" id="ffpad-close" class="ffpad-drawer__close" aria-label="Close">✕</button>
    </header>

    <div class="ffpad-drawer__list">
        @foreach ($ffpadApps as $ffpadApp)
            <a class="ffpad-card" href="{{ $ffpadApp['url'] }}" target="_blank" rel="noopener noreferrer">
                <span class="ffpad-card__tile" aria-hidden="true">
                    {{ $ffpadApp['monogram'] }}
                    @if (! empty($ffpadApp['logo']))
                        <img src="{{ $ffpadApp['logo'] }}" alt="" width="44" height="44" decoding="async" onerror="this.style.display='none'">
                    @endif
                </span>
                <span class="ffpad-card__body">
                    <p class="ffpad-card__name">{{ $ffpadApp['name'] }}</p>
                    <p class="ffpad-card__tag">{{ $ffpadApp['tagline'] }}</p>
                    <span class="ffpad-card__meta">
                        <span class="ffpad-card__stars">★ <b>{{ $ffpadApp['rating'] }}</b> ({{ $ffpadApp['reviews'] }})</span>
                        <span class="ffpad-card__free">Free</span>
                    </span>
                </span>
                <span class="ffpad-card__go" aria-hidden="true">→</span>
            </a>
        @endforeach
    </div>

    <footer class="ffpad-drawer__foot">
        <a href="https://apps.shopify.com/partners/airo-apps" target="_blank" rel="noopener noreferrer">
            View all Airo apps on the Shopify App Store →
        </a>
    </footer>
</aside>

<script>
(function () {
    'use strict';
    if (window.__ffpadInit) return;
    window.__ffpadInit = true;
    var tab = document.getElementById('ffpad-tab');
    var scrim = document.getElementById('ffpad-scrim');
    var drawer = document.getElementById('ffpad-drawer');
    if (!tab || !scrim || !drawer) return;
    function open() {
        tab.classList.add('is-hidden');
        scrim.classList.add('is-open');
        drawer.classList.add('is-open');
        tab.setAttribute('aria-expanded', 'true');
    }
    function close() {
        tab.classList.remove('is-hidden');
        scrim.classList.remove('is-open');
        drawer.classList.remove('is-open');
        tab.setAttribute('aria-expanded', 'false');
    }
    tab.addEventListener('click', open);
    scrim.addEventListener('click', close);
    document.getElementById('ffpad-close').addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
    });
})();
</script>
