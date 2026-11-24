import type { CapacitorConfig } from '@capacitor/cli';

// Mobile app wrapper (Capacitor). It opens the live website, so every website update
// reaches the app without a new app release. Until 2026-11-24 this pointed at the old
// Lovable preview address (now dead); it now uses our own domain.
// No android/ios project has been built from this repo yet: run `npx cap add android`
// (or ios) the first time an app is needed.
const config: CapacitorConfig = {
  appId: 'online.hitechfurniture.app',
  appName: 'Hitech Furniture',
  webDir: 'dist',
  server: {
    url: 'https://hitechfurniture.online',
  },
  plugins: {
    Contacts: {
      // iOS Info.plist usage description (also set via xcode/Info.plist after `npx cap add ios`)
    },
  },
};

export default config;
