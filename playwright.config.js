import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',timeout:45000,fullyParallel:false,workers:1,
 use:{baseURL:'http://localhost:4173',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
   {name:'iphone-webkit',use:{...devices['iPhone 13'],browserName:'webkit'}},
   {name:'desktop-edge',use:{browserName:'chromium',channel:'msedge',viewport:{width:1440,height:1000}}}
 ],
 webServer:{command:'node scripts/server.mjs --test',url:'http://localhost:4173/health',reuseExistingServer:true,timeout:15000}
});
