/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/gallerium/',
  // Test discovery is declared here in one place. Unit tests stay co-located with the
  // code they cover (`src/**/*.test.ts`) — the Vitest/TS best practice — so tests move
  // with their module and imports stay relative. See CLAUDE.md "Test index" for the map.
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  plugins: [
    basicSsl(),
    VitePWA({
      // Auto-update: a new SW skips waiting + claims clients, and the registration
      // in main.ts reloads the page once it activates. We register the SW ourselves
      // (injectRegister: false) so we can poll for updates — essential for iOS
      // home-screen apps, which stay resident and otherwise never see new deploys.
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: [
        'icon.svg',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-512.png',
        'apple-touch-icon-180.png',
      ],
      manifest: {
        id: '/gallerium/',
        name: 'Gallerium',
        short_name: 'Gallerium',
        description:
          'Real-time sky awareness: stars, planets, Moon, and satellites from your location.',
        lang: 'en',
        dir: 'ltr',
        categories: ['education', 'utilities'],
        display: 'standalone',
        orientation: 'portrait',
        scope: '/gallerium/',
        start_url: '/gallerium/',
        background_color: '#000008',
        theme_color: '#000008',
        // PNG icons broaden install support (iOS ignores SVG apple-touch icons); the
        // maskable variant carries a safe zone so Android's circular mask doesn't clip it.
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the full app shell so it loads with no network.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
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
