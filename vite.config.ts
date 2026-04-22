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
          '/minimax-api': {
            target: 'https://api.minimaxi.chat',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/minimax-api/, ''),
            secure: true,
          },
          '/groq-api': {
            target: 'https://api.groq.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/groq-api/, ''),
            secure: true,
          },
        },
      },
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.MINIMAX_API_KEY': JSON.stringify(env.MINIMAX_API_KEY),
        'process.env.GROQ_API_KEY': JSON.stringify(env.GROQ_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
      },
    };
});
