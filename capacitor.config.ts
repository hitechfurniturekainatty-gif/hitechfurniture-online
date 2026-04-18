import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.62d268eded094fa5bebdcb351acdde4a',
  appName: 'cushy-catalog',
  webDir: 'dist',
  server: {
    url: 'https://62d268ed-ed09-4fa5-bebd-cb351acdde4a.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    Contacts: {
      // iOS Info.plist usage description (also set via xcode/Info.plist after `npx cap add ios`)
    },
  },
};

export default config;
