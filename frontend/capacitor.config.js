/* ============================================================
   Capacitor — configuração do APK FreelaMZ
   Lida pelo CLI em `npx cap sync` / `npx cap add android`.

   MODO TESTE (Wi-Fi, sem HTTPS):
     VITE_API_URL=http://192.168.x.x:3000/api npx cap sync android
   O modo é detetado automaticamente: se VITE_API_URL começar por
   http://, o WebView usa http://localhost e permite cleartext.
   Em produção (https://...) volta a https e bloqueia HTTP.
   ============================================================ */
const apiUrl = process.env.VITE_API_URL || '';
const modoTeste = /^http:\/\//i.test(apiUrl);

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.freelamz.app',
  appName: 'FreelaMZ',
  webDir: 'dist',
  server: {
    androidScheme: modoTeste ? 'http' : 'https',
    cleartext: modoTeste,
  },
  android: {
    allowMixedContent: modoTeste,
    backgroundColor: '#0B1B3F',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0B1B3F',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0B1B3F',
      overlaysWebView: false,
    },
  },
};

module.exports = config;
