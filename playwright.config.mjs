import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/ui',
  timeout:30000,
  workers:1,
  use:{baseURL:'http://127.0.0.1:4173',viewport:{width:393,height:852},locale:'zh-CN',timezoneId:'Asia/Shanghai',screenshot:'only-on-failure'},
  webServer:{command:'node scripts/serve.mjs',url:'http://127.0.0.1:4173',reuseExistingServer:true},
  reporter:'list'
});
