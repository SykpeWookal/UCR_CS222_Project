import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = Number(env.PORT || 8787);

  return {
    plugins: [react()],
    server: {
      // Listen on all interfaces so other devices on the LAN (or a tunnel) can
      // reach the dev server. Use 127.0.0.1 only if you want it private.
      host: true,
      port: 5174,
      // Allow any Host header (needed for public tunnels like cloudflared/ngrok,
      // which serve the app under their own domain).
      allowedHosts: true,
      // Poll instead of relying on inotify so the dev server also works on
      // machines with a low fs.inotify.max_user_watches limit (ENOSPC).
      watch: {
        usePolling: true,
        interval: 300
      },
      proxy: {
        '/api': `http://127.0.0.1:${apiPort}`
      }
    }
  };
});
