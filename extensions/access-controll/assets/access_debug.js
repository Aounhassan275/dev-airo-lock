/**
 * Access Control Debug Panel
 * Drop into your theme extension assets. Renders a floating dev panel showing
 * every lock's live status, cache state, conditions, and why it fired or didn't.
 */

(function () {
    'use strict';

    // ─── Only run if debug flag is set OR if URL has ?access_debug=1 ──────────
    const forceViaURL = new URLSearchParams(window.location.search).has('access_debug');
    const forceViaWindow = window.__ACCESS_DEBUG === true;
    if (!forceViaURL && !forceViaWindow) {
        // Auto-enable on localhost / *.myshopify.com preview
        const isPreview =
            window.location.hostname.includes('myshopify.com') ||
            window.location.hostname === 'localhost' ||
            window.location.hostname.includes('127.0.0.1') ||
            window.Shopify?.designMode === true;
        if (!isPreview) return;
    }

    // ─── Constants ────────────────────────────────────────────────────────────
    const PANEL_ID = '__access_debug_panel__';
    const LOG_KEY = '__access_debug_log__';
    const VERSION = '1.0.1';

    // ─── Intercept console logs from AccessControl ───────────────────────────
    const _logs = [];
    const _origLog = console.log.bind(console);
    const _origWarn = console.warn.bind(console);
    const _origError = console.error.bind(console);

    function pushLog(level, args) {
        const msg = args.map(a => {
            try { return typeof a === 'object' ? JSON.stringify(a, null, 0) : String(a); }
            catch { return String(a); }
        }).join(' ');
        if (!msg.includes('[AccessControl') && !msg.includes('[AccessCore') && !msg.includes('[AccessUI') && !msg.includes('[AccessValidator') && !msg.includes('[AccessPrice') && !msg.includes('[AccessProduct')) return;
        _logs.push({ level, msg, time: new Date().toLocaleTimeString() });
        refreshLogs();
    }

    console.log = function (...a) { _origLog(...a); pushLog('log', a); };
    console.warn = function (...a) { _origWarn(...a); pushLog('warn', a); };
    console.error = function (...a) { _origError(...a); pushLog('error', a); };

    // ─── Collect state ────────────────────────────────────────────────────────
    function getInitData() {
        const el = document.getElementById('access-control-init');
        if (!el) return null;
        const raw = {
            type: el.dataset.type,
            handle: el.dataset.handle,
            shop: el.dataset.shop,
            loggedIn: el.dataset.customerLoggedIn === 'true',
            email: el.dataset.customerEmail || '—',
            tags: el.dataset.customerTags || '—',
            country: el.dataset.customerCountry || '—',
            localRule: null,
            globalConfig: null,
        };
        try { raw.localRule = JSON.parse(el.dataset.localRule || 'null'); } catch { }
        try { raw.globalConfig = JSON.parse(el.dataset.globalConfig || '{}'); } catch { }
        return raw;
    }

    function getAllLocks(initData) {
        if (!initData) return [];
        const locksMap = new Map();

        // Helper to add or update a lock in the map
        const addLock = (l, source, idx) => {
            let id = l.lock_id || l.rule_id || `${source.toLowerCase()}-${idx}`;
            id = String(id); // Normalize to string for Map key

            const ls = l.lock_settings || l.settings || {};
            const conds = ls.conditions || l.conditions || [];
            const target = l.target_type || l.resource_type || (source === 'Local Metafield' ? initData.type : '?');

            if (locksMap.has(id)) {
                const existing = locksMap.get(id);
                if (!existing.targets.includes(target)) {
                    existing.targets.push(target);
                }
                if (!existing.sources.includes(source)) {
                    existing.sources.push(source);
                }
            } else {
                locksMap.set(id, {
                    source: source, // Keep for backward compat if needed
                    sources: [source],
                    id: id,
                    enabled: l.enabled !== false,
                    targets: [target],
                    conditions: conds,
                    hidePrice: ls.hide_price || l.hide_price || false,
                    hideCart: ls.hide_add_to_cart || l.hide_add_to_cart || false,
                    raw: l,
                });
            }
        };

        // ── Local rule (metafield) ──────────────────────────────────────────
        const lr = initData.localRule;
        if (lr) {
            const candidates = Array.isArray(lr.locks) ? lr.locks : [lr];
            candidates.forEach((l, i) => addLock(l, 'Local Metafield', i));
        }

        // ── Global config ───────────────────────────────────────────────────
        const gc = initData.globalConfig;
        if (gc && Array.isArray(gc.locks)) {
            gc.locks.forEach((l, i) => addLock(l, 'Global Config', i));
        }

        return Array.from(locksMap.values());
    }

    function getCacheStatus(initData, lock) {
        if (!initData || !lock) return null;
        // Replicate getCacheKey logic
        function hashConditions(conditions) {
            if (!conditions || !Array.isArray(conditions)) return '';
            try {
                const str = JSON.stringify(conditions);
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                return Math.abs(hash).toString(36);
            } catch { return ''; }
        }
        const conditionsHash = hashConditions(lock.conditions);
        const key = `access_${initData.type}_${initData.handle}_${lock.id}_${conditionsHash}`;
        const value = localStorage.getItem(key);
        return { key, value, granted: value === 'granted' };
    }

    function getAllCacheEntries() {
        const entries = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('access_')) {
                entries.push({ key: k, value: localStorage.getItem(k) });
            }
        }
        return entries;
    }

    // ─── DOM helpers ──────────────────────────────────────────────────────────
    function el(tag, attrs, children) {
        const e = document.createElement(tag);
        Object.entries(attrs || {}).forEach(([k, v]) => {
            if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
            else if (k === 'class') e.className = v;
            else if (k.startsWith('on')) e[k] = v;
            else e.setAttribute(k, v);
        });
        (children || []).forEach(c => { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
        return e;
    }

    function badge(text, color) {
        return el('span', {
            style: {
                display: 'inline-block', padding: '1px 7px', borderRadius: '10px',
                fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em',
                background: color, color: '#fff', textTransform: 'uppercase',
                verticalAlign: 'middle', lineHeight: '18px',
            }
        }, [text]);
    }

    // ─── Build panel ──────────────────────────────────────────────────────────
    function buildPanel() {
        if (document.getElementById(PANEL_ID)) return;

        const initData = getInitData();
        const locks = getAllLocks(initData);
        const cacheEntries = getAllCacheEntries();

        /* ── Shell ────────────────────────────────────────────────────────── */
        const panel = el('div', {
            id: PANEL_ID,
            style: {
                position: 'fixed', bottom: '16px', right: '16px', zIndex: '2147483647',
                width: '380px', maxHeight: '80vh',
                fontFamily: '"Courier New", monospace',
                fontSize: '11px', lineHeight: '1.5',
                background: '#0d1117', color: '#c9d1d9',
                border: '1px solid #30363d', borderRadius: '10px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
            }
        });

        /* ── Header ───────────────────────────────────────────────────────── */
        const header = el('div', {
            style: {
                background: '#161b22', borderBottom: '1px solid #30363d',
                padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px',
                cursor: 'move', userSelect: 'none',
            }
        }, [
            el('span', { style: { fontSize: '14px' } }, ['🔐']),
            el('span', { style: { fontWeight: '700', color: '#58a6ff', fontSize: '12px' } }, ['Access Debug']),
            el('span', { style: { color: '#484f58', fontSize: '10px', flex: '1' } }, [` v${VERSION}`]),
        ]);

        const collapseBtn = el('button', {
            title: 'Minimize',
            style: {
                background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer',
                fontSize: '14px', padding: '0 4px', lineHeight: '1',
            },
            onclick: () => {
                const b = document.getElementById('__adb_body__');
                const t = document.getElementById('__adb_tabs__');
                const isHidden = b.style.display === 'none';
                b.style.display = isHidden ? 'flex' : 'none';
                t.style.display = isHidden ? 'flex' : 'none';
                collapseBtn.textContent = isHidden ? '▼' : '▲';
            }
        }, ['▼']);

        const closeBtn = el('button', {
            title: 'Close',
            style: {
                background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer',
                fontSize: '14px', padding: '0 4px', lineHeight: '1',
            },
            onclick: () => panel.remove()
        }, ['✕']);

        header.appendChild(collapseBtn);
        header.appendChild(closeBtn);

        /* ── Tabs ─────────────────────────────────────────────────────────── */
        const tabs = ['Locks', 'Cache', 'Logs'];
        let activeTab = 'Locks';
        const tabEls = {};
        const tabBar = el('div', { id: '__adb_tabs__', style: { display: 'flex', borderBottom: '1px solid #30363d', background: '#161b22' } });

        function activateTab(name) {
            activeTab = name;
            Object.entries(tabEls).forEach(([n, t]) => {
                t.style.borderBottom = n === name ? '2px solid #58a6ff' : '2px solid transparent';
                t.style.color = n === name ? '#58a6ff' : '#8b949e';
            });
            renderTabContent(name, initData, locks, cacheEntries);
        }

        tabs.forEach(name => {
            const t = el('button', {
                style: {
                    flex: '1', background: 'none', border: 'none', borderBottom: '2px solid transparent',
                    color: '#8b949e', fontSize: '11px', fontWeight: '600', padding: '6px 0', cursor: 'pointer',
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                },
                onclick: () => activateTab(name)
            }, [name]);
            tabEls[name] = t;
            tabBar.appendChild(t);
        });

        /* ── Body ─────────────────────────────────────────────────────────── */
        const body = el('div', { id: '__adb_body__', style: { flex: '1', overflowY: 'auto', display: 'flex', flexDirection: 'column' } });

        panel.appendChild(header);
        panel.appendChild(tabBar);
        panel.appendChild(body);
        document.body.appendChild(panel);

        // Drag
        let ox = 0, oy = 0, isDragging = false;
        header.addEventListener('mousedown', e => {
            isDragging = true;
            ox = e.clientX - panel.getBoundingClientRect().left;
            oy = e.clientY - panel.getBoundingClientRect().top;
        });
        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            panel.style.left = (e.clientX - ox) + 'px';
            panel.style.top = (e.clientY - oy) + 'px';
        });
        document.addEventListener('mouseup', () => { isDragging = false; });

        activateTab('Locks');
    }

    function renderTabContent(tab, initData, locks, cacheEntries) {
        const body = document.getElementById('__adb_body__');
        if (!body) return;
        body.innerHTML = '';
        if (tab === 'Locks') renderLocksTab(body, initData, locks);
        if (tab === 'Cache') renderCacheTab(body, initData, locks, cacheEntries);
        if (tab === 'Logs') renderLogsTab(body);
    }

    function renderLocksTab(body, initData, locks) {
        const wrap = el('div', { style: { padding: '10px' } });
        if (initData) {
            const infoBox = el('div', { style: { background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', padding: '8px 10px', marginBottom: '10px' } });
            infoBox.innerHTML = `
                <div style="color:#58a6ff;font-weight:700;margin-bottom:4px">📄 Current Page</div>
                <div><span style="color:#8b949e">Type:</span> <b>${initData.type || '?'}</b></div>
                <div><span style="color:#8b949e">Handle:</span> <b>${initData.handle || '?'}</b></div>
                <div><span style="color:#8b949e">Logged In:</span> ${initData.loggedIn ? '<span style="color:#3fb950">✔ Yes</span>' : '<span style="color:#f85149">✘ No</span>'}</div>
                <div><span style="color:#8b949e">Email:</span> ${initData.email}</div>
                <div><span style="color:#8b949e">Tags:</span> ${initData.tags}</div>
                <div><span style="color:#8b949e">Country:</span> ${initData.country}</div>
            `;
            wrap.appendChild(infoBox);
        }
        if (!initData) {
            wrap.appendChild(el('div', { style: { color: '#f85149', padding: '8px' } }, ['⚠ No #access-control-init element found.']));
            body.appendChild(wrap);
            return;
        }
        if (locks.length === 0) wrap.appendChild(el('div', { style: { color: '#8b949e', padding: '8px', fontStyle: 'italic' } }, ['No locks found.']));
        locks.forEach((lock, idx) => {
            const cache = getCacheStatus(initData, lock);
            const isCached = cache && cache.granted;
            let statusLabel = 'LOCKED', statusColor = '#f85149';
            if (!lock.enabled) { statusLabel = 'DISABLED'; statusColor = '#8b949e'; }
            else if (isCached) { statusLabel = 'UNLOCKED'; statusColor = '#3fb950'; }
            const card = el('div', { style: { background: '#161b22', border: `1px solid ${statusColor}44`, borderLeft: `3px solid ${statusColor}`, borderRadius: '6px', padding: '8px 10px', marginBottom: '8px' } });
            const badges = [badge(statusLabel, statusColor)];
            lock.sources.forEach(s => badges.push(badge(s, '#1f6feb')));
            card.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' } }, [el('span', { style: { fontWeight: '700' } }, [`Lock #${idx + 1}`]), ...badges]));
            card.innerHTML += `
                <div><span style="color:#8b949e">ID:</span> <code style="color:#79c0ff">${lock.id}</code></div>
                <div><span style="color:#8b949e">Targets:</span> ${lock.targets.join(', ')}</div>
                <div><span style="color:#8b949e">Conditions:</span> ${lock.conditions.length} group(s)</div>
                ${cache ? `<div><span style="color:#8b949e">Cache:</span> ${isCached ? '<span style="color:#3fb950">granted ✔</span>' : '<span style="color:#f85149">none</span>'}</div>` : ''}
            `;
            if (isCached) {
                card.appendChild(el('button', { style: { marginTop: '6px', background: '#da3633', border: 'none', color: '#fff', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }, onclick: () => { localStorage.removeItem(cache.key); panel_refresh(); } }, ['🗑 Clear Cache']));
            }
            wrap.appendChild(card);
        });
        body.appendChild(wrap);
    }

    function renderCacheTab(body, initData, locks, cacheEntries) {
        const wrap = el('div', { style: { padding: '10px' } });
        if (cacheEntries.length === 0) wrap.appendChild(el('div', { style: { color: '#8b949e', fontStyle: 'italic' } }, ['No cache entries.']));
        else {
            cacheEntries.forEach(entry => {
                const row = el('div', { style: { background: '#161b22', border: '1px solid #30363d', borderRadius: '5px', padding: '6px 8px', marginBottom: '6px', wordBreak: 'break-all' } });
                row.innerHTML = `<div style="color:#79c0ff;font-size:10px">${entry.key}</div><div>${entry.value === 'granted' ? '✅ granted' : entry.value}</div>`;
                row.appendChild(el('button', { style: { marginTop: '4px', background: 'none', border: '1px solid #6e3636', color: '#f85149', fontSize: '10px', cursor: 'pointer' }, onclick: () => { localStorage.removeItem(entry.key); panel_refresh(); } }, ['Delete']));
                wrap.appendChild(row);
            });
            wrap.appendChild(el('button', { style: { width: '100%', background: '#6e1c1c', border: '1px solid #da3633', color: '#ffa198', padding: '6px', fontWeight: '700', cursor: 'pointer' }, onclick: () => { cacheEntries.forEach(e => localStorage.removeItem(e.key)); panel_refresh(); } }, ['🧹 Clear All Cache']));
        }
        body.appendChild(wrap);
    }

    function renderLogsTab(body) {
        window.__adb_logs_el = el('div', { style: { padding: '10px' } });
        refreshLogs();
        body.appendChild(window.__adb_logs_el);
    }

    function refreshLogs() {
        const c = window.__adb_logs_el;
        if (!c) return;
        c.innerHTML = '';
        if (_logs.length === 0) { c.appendChild(el('div', { style: { color: '#8b949e' } }, ['No logs yet.'])); return; }
        c.appendChild(el('button', { style: { marginBottom: '6px', fontSize: '10px', cursor: 'pointer' }, onclick: () => { _logs.length = 0; refreshLogs(); } }, ['Clear Logs']));
        [..._logs].reverse().forEach(log => {
            const row = el('div', { style: { borderBottom: '1px solid #21262d', padding: '3px 0' } });
            row.innerHTML = `<span style="color:#484f58">[${log.time}]</span> ${log.msg}`;
            c.appendChild(row);
        });
    }

    function panel_refresh() {
        const p = document.getElementById(PANEL_ID);
        if (p) p.remove();
        buildPanel();
    }

    function boot() {
        buildPanel();
        document.addEventListener('AccessControlReady', () => setTimeout(panel_refresh, 100));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else setTimeout(boot, 300);
})();