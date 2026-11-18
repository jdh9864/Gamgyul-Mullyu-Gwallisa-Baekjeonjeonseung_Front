import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // 1순위: Server A (문제 출제 및 상태 폴링 전담)
      '/api/v1/problems': {
        target: 'http://13.125.244.134:8080',
        changeOrigin: true,
      },
      // 2순위: Server B (회원가입, 로그인, 채점, 오답노트 전담)
      '/api/v1': {
        target: 'http://52.79.251.42:8081',
        changeOrigin: true,
      },
    },
  },
});
