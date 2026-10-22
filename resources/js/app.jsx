import './bootstrap';
import '../css/app.css';
import { createRoot } from 'react-dom/client';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { AppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
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
                    <a href="/" onClick={(event) => { event.preventDefault(); router.visit('/'); }} rel="home">Home</a>
                    <a href="/lock/create" onClick={(event) => { event.preventDefault(); router.visit('/lock/create'); }}>Create Lock</a>
                    <a href="/widgetdashboard" onClick={(event) => { event.preventDefault(); router.visit('/widgetdashboard'); }}>Widgets</a>
                    <a href="/pricing" onClick={(event) => { event.preventDefault(); router.visit('/pricing'); }}>Plans & Billing</a>
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
