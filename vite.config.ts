import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/minimax': {
            target: 'https://api.minimax.io',
            changeOrigin: true,
            rewrite: (reqPath) => reqPath.replace(/^\/api\/minimax/, '/anthropic/v1'),
            configure: (proxy) => {
              proxy.on('proxyReq', (proxyReq) => {
                proxyReq.setHeader('x-api-key', env.VITE_MINIMAX_API_KEY || '');
                proxyReq.setHeader('anthropic-version', '2023-06-01');
              });
            },
          },
        },
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
      },
    };
});
