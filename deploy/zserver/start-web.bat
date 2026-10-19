@echo off
cd /d C:\atlas
npm run start --workspace @atlas/web >> deploy\zserver\logs\web.log 2>&1
