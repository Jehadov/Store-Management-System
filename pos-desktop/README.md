# Angular Desktop POS (starter)

This is a minimal starter to drop into a real Angular + Electron/Tauri shell.
It talks to the same API as the React web app: `../docs/API_CONTRACT.md`.

## Create real app

```bash
npx @angular/cli@21 new pos --standalone --style=css --routing
cd pos
ng add @angular/material   # optional for POS keypad
npm i -D electron electron-builder  # or: npm i -D @tauri-apps/cli
# copy src/app/core + src/app/features from this folder into pos/src/app
```

## Structure

```
src/app/core/api.service.ts       -> typed HttpClient for /categories /products /orders
src/app/core/offline-queue.service.ts -> localStorage queue for offline orders
src/app/features/pos/pos.component.ts  -> menu grid + cart + table + cash/cliq
src/app/features/kitchen/kitchen.component.ts -> pending/preparing/ready board
```

## Offline strategy (cashier must work without internet)

1. POS saves `POST /orders` payload to `offline-queue` (localStorage/IndexedDB) if fetch fails.
2. Background sync every 15s: flush queue when `/api/health` ok.
3. Stock/price always recomputed server-side, so conflicts resolve on sync.
4. Print via Electron `printer` / Tauri `shell` locally, don't wait for server.
