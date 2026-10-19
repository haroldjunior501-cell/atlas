@echo off
cd /d C:\atlas
npm run start --workspace @atlas/gateway >> deploy\zserver\logs\gateway.log 2>&1
