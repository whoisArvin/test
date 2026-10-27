# BERJIS REST API v1

Base path: `/api/v1`. Same-origin JSON. DEMO only. Mutations require exact `Origin: APP_URL` and `Content-Type: application/json`; the HMAC callback is exempt from cookie/Origin requirements. Session cookie is opaque, HttpOnly, SameSite=Lax, Secure on HTTPS. All private responses are `no-store`. Error shape:

```json
{
  "error": {
    "code": "PRICE_CHANGED",
    "message": "قیمت تغییر کرده است؛ پیشنهاد را دوباره بررسی کنید."
  },
  "requestId": "..."
}
```

Codes: 401 unauthenticated; 403 permission/CSRF/signature; 404 absent or another owner's resource; 409 state/capacity/quote/idempotency conflict; 422 invalid input; 429 throttled; 503 unavailable/degraded. Unexpected errors are redacted. JSON bodies are limited in application code; the reverse proxy must also enforce a streaming request limit.

## Public and identity

| Method | Route            | Contract                                                                                                                  |
| ------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`        | PostgreSQL, Redis and worker heartbeat; 503 if worker stale                                                               |
| GET    | `/catalog`       | Published hotel/tour demo offers and articles                                                                             |
| GET    | `/search`        | `product=FLIGHT\|HOTEL\|TOUR`, optional origin/destination (Persian city, airport name or IATA code), flightType=domestic | international, startDate/endDate ISO date, quantity 1–9; 20-second Redis cache |
| GET    | `/offers/:id`    | Offer, rules and daily demo inventory                                                                                     |
| GET    | `/articles/:id`  | Published plain-text article                                                                                              |
| POST   | `/auth/register` | `{name,email,password}`; password 12–128 chars; establishes a session                                                     |
| POST   | `/auth/login`    | `{email,password}`                                                                                                        |
| POST   | `/auth/logout`   | `{}`; revokes current session                                                                                             |
| GET    | `/auth/session`  | `{user: {id,name,email,role} \| null}`                                                                                    |

Redis cache/rate keys are namespaced by environment/database; test namespaces never share search results with the application. Search is advisory. Offer identifiers, totals and stock are rechecked at booking. All money fields ending in `Irr` are integer IRR. Search results use `startDate`, `endDate`, `totalIrr`, `available` and `demo`.

## Booking and payment

```http
POST /api/v1/orders
Origin: <APP_URL>
Content-Type: application/json
Idempotency-Key: <random UUID, stable for retries of this request>
Cookie: berjis_session=...
```

```json
{
  "items": [
    {
      "offerId": "flight-THR-KIH-0",
      "startDate": "<ISO future date>",
      "endDate": "<same date for flight/tour>",
      "quantity": 1
    }
  ],
  "passengers": [
    {
      "firstName": "Demo",
      "lastName": "Traveler",
      "birthDate": "1990-01-01",
      "documentNumber": "DEMO123456"
    }
  ],
  "expectedTotalIrr": 18500000
}
```

For hotels, `endDate` is exclusive and must be 1–30 nights after arrival. For multiple flight legs, dates strictly increase, destinations connect to the next origin, and each leg has the same passenger count. Max six flight legs, nine passengers. A changed body with the same idempotency key is rejected; successful identical retries return the existing reservation.

| Method | Route                    | Behavior                                                                                      |
| ------ | ------------------------ | --------------------------------------------------------------------------------------------- |
| GET    | `/orders`                | Current owner's latest 100 orders                                                             |
| GET    | `/orders/:id`            | Independent booking/payment/fulfilment states, sanitized passengers, refund and audit history |
| POST   | `/orders/:id/payments`   | `{}`; idempotently creates one sandbox transaction against an active hold                     |
| GET    | `/payments/:id`          | Owner's sandbox transaction                                                                   |
| POST   | `/payments/:id/simulate` | `{outcome: SUCCESS\|FAILED\|CANCELLED\|ISSUE_FAILURE}`; no card fields or real debit          |
| POST   | `/payments/callback`     | `{providerReference,eventId}`; raw body HMAC-SHA256 in `X-Payment-Signature`                  |
| GET    | `/orders/:id/receipt`    | Downloadable UTF-8 DEMO travel document only while confirmed and issued; no PDF claim         |
| POST   | `/orders/:id/cancel`     | `{reason}` (5–1000 chars); unpaid cancellation or request for review                          |

Callback facts are independently read from the demo gateway ledger. A valid signature alone does not prove payment: order ID, amount and currency must match. Event IDs are globally unique and checked against the payment. Provider-reference verification is idempotent. Confirmed payment and issuance outbox commit together. A callback after expiry/cancellation goes to refund recovery. No unissued/failed/cancelled document is downloadable.

The current sandbox gateway has one immutable terminal outcome per transaction; after a declined payment create a new reservation. Real gateway callbacks must implement the contracted provider's signature/verify protocol, not copy this sandbox protocol blindly.

## Customer tools

| Method   | Route                 | Body / output                                      |
| -------- | --------------------- | -------------------------------------------------- |
| GET/POST | `/travelers`          | Sanitized saved travelers / passenger input above  |
| DELETE   | `/travelers/:id`      | Owner-scoped deletion                              |
| GET      | `/notifications`      | Owner's latest 100 persistent in-app notifications |
| POST     | `/notifications/read` | `{}` marks owner's notifications read              |
| GET/POST | `/support`            | Own tickets / `{subject,message}`                  |

Document numbers use AES-256-GCM and never return through these APIs. Saved travelers are a directory; re-enter the document on checkout. Neither OTP nor outbound email/SMS is implemented.

## Operations (server-enforced RBAC)

| Method         | Route                       | Permission                                                         |
| -------------- | --------------------------- | ------------------------------------------------------------------ |
| GET            | `/admin/overview`           | analytics:read                                                     |
| GET            | `/admin/orders?q=reference` | orders:read; latest 100                                            |
| POST           | `/admin/orders/:id/approve` | orders:write; manual sandbox supplier confirmation                 |
| GET/POST/PATCH | `/admin/tours[/:id]`        | catalog:write; content, price, publication and one date's capacity |
| GET/PATCH      | `/admin/hotels[/:id]`       | catalog:write; existing hotel content and one night's capacity     |
| GET/POST       | `/admin/refunds[/:id]`      | refund:write; list / approve for worker processing                 |
| GET            | `/admin/finance`            | finance:read; up to 10,000 CSV rows, formula-safe cells, audited   |
| GET/POST       | `/admin/support[/:id]`      | support:write; list / `{reply}`                                    |
| GET/PATCH      | `/admin/users[/:id]`        | users:write; list / `{role}`; cannot change own role               |
| GET/PATCH      | `/admin/articles[/:id]`     | content:write; list / `{title,excerpt,body,published}`             |
| GET            | `/admin/suppliers`          | catalog:write; configured demo provider metadata only              |
| GET            | `/admin/audit`              | audit:read; latest 200 events                                      |

See Zod `tourSchema` in `src/server/validation.ts` for tour payloads. All exposed admin edits are audited. There is no API for mutating audit entries. Current admin CSV is an operational report; tax invoices, commission accounting, native XLSX, supplier settlement and bank reconciliation are not implemented.
