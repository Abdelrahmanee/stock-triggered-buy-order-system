# Stock Triggered Buy Order System

NestJS + MongoDB MVP for price-triggered buy orders with JWT auth, wallet balance management, stock price ingestion, BullMQ processing, and persistent execution audit records.

## Features

- JWT registration and login
- User wallet balance updates
- Stock catalog with current prices
- Triggered buy orders that execute when `currentPrice <= targetPrice`
- Price event ingestion via webhook-style endpoint
- BullMQ queues for price updates, trigger evaluation, order execution, and Polygon price sync
- Mock stock-price provider plus a Polygon free-tier external provider
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

## Polygon stock provider

The external stock provider uses Polygon free-tier end-of-day aggregate data, not live or delayed snapshot APIs. Configure these values to run price sync from Polygon:

```bash
STOCK_PROVIDER_MODE=external
STOCK_POLYGON_PROVIDER_API_KEY=your-key
PRICE_SYNC_PATTERN=0 30 5 * * 2-6
```

The scheduled sync uses `GET /v2/aggs/grouped/locale/us/market/stocks/{date}` and falls back across the configured lookback window. `getCurrentPrice(symbol)` uses `GET /v2/aggs/ticker/{symbol}/range/1/day/{from}/{to}`.

## Verification

```bash
npm test
npm run test:e2e
npm run build
```

For AWS SAM local Lambda build and invoke testing, see
[AWS SAM Local Testing Guide](docs/aws-sam-local-testing.md).

## CI/CD

GitHub Actions runs CI on pushes and pull requests to `main`, `master`, and
`develop`. The pipeline installs dependencies with `npm ci`, runs the Jest unit
suite, and builds the NestJS app.

On pushes to `main` or `master`, the CD job builds the Docker image and publishes
it to GitHub Container Registry as `ghcr.io/<owner>/<repo>`.

## Postman

Postman files are available in [postman](E:\stock-triggered-buy-order-system\postman):

- [Stock Triggered Buy Order System.postman_collection.json](E:\stock-triggered-buy-order-system\postman\Stock%20Triggered%20Buy%20Order%20System.postman_collection.json)
- [Stock Triggered Buy Order System.local.postman_environment.json](E:\stock-triggered-buy-order-system\postman\Stock%20Triggered%20Buy%20Order%20System.local.postman_environment.json)
