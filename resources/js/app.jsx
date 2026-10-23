import './bootstrap';
import '../css/app.css';
import '../css/airo.css';
import { createRoot } from 'react-dom/client';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { AppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
// After Polaris, so the design system wins where the two describe one thing.
import '../css/airo-polaris.css';
import enTranslations from '@shopify/polaris/locales/en.json';
import { NavMenu } from '@shopify/app-bridge-react';
import GlobalExtensionNotice from './components/GlobalExtensionNotice';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) => resolvePageComponent(`./pages/${name}.jsx`, import.meta.glob('./pages/**/*.jsx', { eager: true })),
    setup({ el, App, props }) {
        createRoot(el).render(
            <AppProvider i18n={enTranslations}>
                <NavMenu>
                    {/* The app entry itself is the way to the dashboard; the four pages sit under it. */}
                    <a href="/" onClick={(event) => { event.preventDefault(); router.visit('/'); }} rel="home">Dashboard</a>
                    <a href="/locks" onClick={(event) => { event.preventDefault(); router.visit('/locks'); }}>Locks</a>
                    <a href="/widgetdashboard" onClick={(event) => { event.preventDefault(); router.visit('/widgetdashboard'); }}>Widgets</a>
                    <a href="/pricing" onClick={(event) => { event.preventDefault(); router.visit('/pricing'); }}>Subscriptions</a>
                    <a href="/onboarding" onClick={(event) => { event.preventDefault(); router.visit('/onboarding'); }}>Onboarding</a>
                </NavMenu>
                <App {...props} />
                {/* App-wide "app embed disabled" warning toast — shown on every page. */}
                <GlobalExtensionNotice />
            </AppProvider>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});
