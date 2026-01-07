import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'love-alarm',
  brand: {
    displayName: '좋아하면 울리는', // 화면에 노출될 앱의 한글 이름
    primaryColor: '#FF6B6B', // 화면에 노출될 앱의 기본 색상 (하트 컬러)
    icon: 'https://static.toss.im/appsintoss/9737/f6aa6697-d258-40c2-a59f-91f8e8bab8be.png', // 화면에 노출될 앱의 아이콘 이미지 주소를 입력하세요. 자세한 내용은 SETUP.md 참고
    bridgeColorMode: 'basic',
  },
  web: {
    host: '192.168.45.111',
    port: 5173,
    commands: {
      dev: 'npm run vite:dev',
      build: 'npm run vite:build',
    },
  },
  permissions: [],
  outdir: 'dist',
});
