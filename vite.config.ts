import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/gallerium/',
  plugins: [
    basicSsl(),
    VitePWA({
      // Auto-update: a new SW skips waiting + claims clients, and the registration
      // in main.ts reloads the page once it activates. We register the SW ourselves
      // (injectRegister: false) so we can poll for updates — essential for iOS
      // home-screen apps, which stay resident and otherwise never see new deploys.
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Gallerium',
        short_name: 'Gallerium',
        description:
          'Real-time sky awareness — stars, planets, Moon, and satellites from your location.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000008',
        theme_color: '#000008',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Precache the full app shell so it loads with no network.
        globPatterns: ['**/*.{js,css,html,svg}'],
        navigateFallback: 'index.html',
        // Bonus offline safety net for the cross-origin data sources. The app's
        // IndexedDB layer remains the primary cache; this just adds redundancy.
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname === 'raw.githubusercontent.com' ||
              url.hostname === 'celestrak.org',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'gallerium-data',
              expiration: { maxEntries: 8, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    https: true,
  },
})
