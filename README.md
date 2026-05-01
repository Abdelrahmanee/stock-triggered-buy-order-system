# Stock Triggered Buy Order System

NestJS + MongoDB MVP for price-triggered buy orders with JWT auth, wallet balance management, stock price ingestion, BullMQ processing, and persistent execution audit records.

## Features

- JWT registration and login
- User wallet balance updates
- Stock catalog with current prices
- Triggered buy orders that execute when `currentPrice <= targetPrice`
- Price event ingestion via webhook-style endpoint
- BullMQ queues for price updates, trigger evaluation, order execution, and fallback price sync
- Mock stock-price provider with an external adapter contract for later
- Persistent trade executions, wallet ledger entries, portfolio positions, and price events

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users/me`
- `PATCH /api/users/me/wallet`
- `GET /api/stocks`
- `GET /api/stocks/:symbol`
- `POST /api/orders/buy-trigger`
- `GET /api/orders`
- `GET /api/orders/:id`
- `PATCH /api/orders/:id/cancel`
- `POST /api/stock-events/price-update`

## Local setup

```bash
npm install
copy .env.example .env
docker compose up -d
npm run start:dev
```

If you want to run without Redis for local testing, set `QUEUE_DRIVER=inline`. The e2e suite already does this automatically.

## Verification

```bash
npm test
npm run test:e2e
npm run build
```

## Postman

Postman files are available in [postman](E:\stock-triggered-buy-order-system\postman):

- [Stock Triggered Buy Order System.postman_collection.json](E:\stock-triggered-buy-order-system\postman\Stock%20Triggered%20Buy%20Order%20System.postman_collection.json)
- [Stock Triggered Buy Order System.local.postman_environment.json](E:\stock-triggered-buy-order-system\postman\Stock%20Triggered%20Buy%20Order%20System.local.postman_environment.json)
