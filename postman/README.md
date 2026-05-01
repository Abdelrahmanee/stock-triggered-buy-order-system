# Postman Documentation

Files:

- `Stock Triggered Buy Order System.postman_collection.json`
- `Stock Triggered Buy Order System.local.postman_environment.json`

How to use:

1. Import both files into Postman.
2. Select the `Stock Triggered Buy Order System - Local` environment.
3. Start the API locally on `http://localhost:3000`.
4. Run `Auth > Register` or `Auth > Login`.
5. The collection stores `accessToken` automatically.
6. Run `Orders > Create Buy Trigger Order`.
7. The collection stores `orderId` automatically.
8. Run `Price Events > Push Price Update` to trigger order evaluation and execution.
9. Check `Orders > Get Order By Id` and `Users > Get Current User`.

Notes:

- Authenticated requests use `Bearer {{accessToken}}`.
- `source` for price updates can be `webhook`, `mock`, `polling`, `external`, or `seed`.
- If you want a quick happy path, create an order for `AAPL` with target price `170`, then push a price update with `169`.
