# WhatsApp Cloud API, shop onboarding, and performance

**Implementation note:** the backend acknowledges signed WhatsApp webhooks only
after durable MongoDB enqueue. The Mongo queue is shared by app instances and
uses per-sender leases; it already provides durable distributed work without
requiring BullMQ. Shop auto-replies and customer-confirmed invoices are separate
opt-ins. Catalog search can use a short-lived Redis cache, while stock and
financial data remain fresh database reads. Meta onboarding still needs the
deployment's approval and credentials; the local load test is not a production
capacity guarantee.

## 1. Meta Cloud API in one page

Meta hosts the WhatsApp Business Platform Cloud API. A business portfolio owns
the business assets and its WhatsApp account (historically WABA) holds the
phone number. API calls use the **phone number ID**, not the displayed number
or account ID. A bearer token authorizes calls: API Setup tokens are temporary;
system-user tokens can be long-lived until revoked. The separate app secret
signs webhooks.

Meta verifies the callback with `GET /api/whatsapp/webhook`, query
`hub.mode=subscribe`, `hub.verify_token`, and `hub.challenge`. Our route compares
the token with `WHATSAPP_VERIFY_TOKEN` and returns the challenge. For each
`POST`, Meta sends a JSON message or status event and an
`X-Hub-Signature-256: sha256=...` HMAC of the exact request bytes. The app
retains the raw body and verifies the HMAC using `META_APP_SECRET` with a
constant-time comparison. Invalid signatures get 401. Valid events are saved
before 200; persistence failure returns 503 for Meta retry.

Send through `POST /{phone_number_id}/messages` with the shop's bearer token.
The payload `type` selects text, media, template, or interactive content (for
example reply buttons and lists). The current backend sends text/media and
templates; its current interactive-message support is limited.

A user's message opens/resets a **24-hour customer-service window**. Free-form
service replies are allowed inside; outside it, use an approved template. As of
**1 Oct 2026**, Meta charges per delivered business message by category and
market, not per conversation; inbound messages are free. Each number gets
1,000 free service messages/month, then India's published rate applies.
Utility/authentication messages may have volume discounts; check Meta's
[current India rate card](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing).

Messaging limits count unique recipients outside the service window per
rolling 24 hours, **not messages/second**. Current tiers start at 250, then
2,000, 10,000, 100,000 and unlimited. The often-quoted 1K tier is outdated;
1,000 is the monthly free service-message allowance. Throughput/quality limits
are separate; 100 messages/minute can still overwhelm a serial LLM worker.

## 2. Connecting a shop today

### One-time ChatShop/Meta setup

1. In [Meta for Developers](https://developers.facebook.com/apps), create a
   WhatsApp-use-case app and attach your business portfolio.
2. **WhatsApp → API Setup:** create/select the account, add a test recipient,
   send the sample, and note the phone number/account IDs.
3. Configure `https://<host>/api/whatsapp/webhook`, the server's
   `WHATSAPP_VERIFY_TOKEN`, and subscribe the `messages` field. The manual
   flow subscribes a WABA when its ID is supplied; Embedded Signup subscribes
   during completion.
4. Configure `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, MongoDB, and HTTPS in
   server secrets. Generate a persistent 32-byte
   `WHATSAPP_TOKEN_ENCRYPTION_KEY`; set `WHATSAPP_BILL_URL_SECRET` and
   `PUBLIC_BASE_URL` for sending invoice PDFs. Never enable
   `META_WEBHOOK_SKIP_SIGNATURE` in production.

### Each shop's current manual connection

1. Owner creates/uses a business portfolio and WhatsApp account, verifies a
   phone number, and enables Cloud API.
2. **Business Settings → Users → System users:** assign the app/account and
   generate a system-user token with `whatsapp_business_messaging` and
   `whatsapp_business_management` (and any Meta-required business permission).
3. In ChatShop **Settings → Channels → WhatsApp**, enter the numeric phone
   number ID, token, and (recommended) WABA ID. The server verifies the
   credentials and subscribes the app to the WABA when the ID is supplied.
4. If the WABA ID is omitted, the number can send, but incoming webhooks will
   not arrive until the app is subscribed to that WABA in Meta. The channel
   settings page warns about this.
5. Message from an allowed test phone and check the ChatShop inbox.

Common blocks: entering the visible number instead of its ID, an expired test
token, missing asset permissions/subscription, or an unapproved test recipient.
Shop tokens are encrypted at rest with AES-256-GCM and excluded from profile
responses. Before deploying the new version, set the persistent encryption key
and run `npm run migrate:whatsapp-tokens` in `backend` to encrypt legacy
plaintext tokens. Back up the key securely; losing it makes encrypted tokens
unreadable. Embedded Signup expiry is recorded and sends stop with a reconnect
error after expiry/revocation; owners must reconnect. Disconnecting ChatShop
does not revoke the Meta system-user token or remove Meta-side access.

**Embedded Signup is supported in the UI, but not “one API key and done.”** v4
needs Tech Provider/Solution Partner onboarding, an HTTPS app domain,
`META_APP_ID`, `META_APP_SECRET`, `META_EMBEDDED_SIGNUP_CONFIG_ID`, OAuth code
exchange, phone registration, webhook subscription, managed token storage,
and App Review/advanced access. Tech Provider customers add their own payment
method. The browser sends the returned code and WABA/phone IDs to the backend;
the app secret and exchanged token never go to the browser. The owner enters
the number's six-digit two-step-verification PIN to finish. Follow
[Meta's v4 guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation);
the button stays disabled when server config is absent. Coexistence with the
WhatsApp Business App is not implemented.

### Message path

```text
Customer
  → Meta Cloud API
  → HTTPS POST /api/whatsapp/webhook
  → app-secret HMAC check
  → Mongo durable job (dedupe by Meta message ID; keyed by phone ID + sender)
  → HTTP 200 to Meta
  → worker resolves phone_number_id to connected shop
  → customer/conversation/message records + inbox event
  → (opt-in) local rules/catalog, then approved Gemini fallback if enabled
  → reply via POST /{phone_number_id}/messages
```

Webhook jobs retry with backoff (8 attempts); a Mongo lease serializes one
sender across instances while different senders run concurrently. Completed
jobs expire in 7 days, permanent failures in 30. Bill-PDF deliveries use a
separate durable Mongo queue, an idempotency key, bounded retries, and an
outgoing-message idempotency record. This queue was retained instead of adding
BullMQ because it is already persistent and multi-instance; revisit Redis/BullMQ
only if measured Mongo queue pressure justifies another service.

## 3. Ranked performance improvements

| Rank | Change | Effort | Expected gain |
|---|---|---:|---|
| 1 | Durable ACK, retry, dedupe, sender locks (done) | M | Meta waits for persistence, not processing |
| 2 | Rules + catalog replies before LLM (done) | M | Common greetings/price/stock/address skip LLM |
| 3 | Gemini timeout, short fact-only prompt, fallback (done) | M | 4s provider cap; no history; not yet load-tested |
| 4 | Shop rate cap + per-process/per-shop LLM concurrency (done) | M | Limits noisy shops; tune for number of app instances |
| 5 | Shared Redis catalog search cache + product-write invalidation (done) | M | Fewer text searches; stock is still read fresh |
| 6 | Per-step queue/DB/LLM/send timings (done); p95/p99 alerting | S–M | Timings are logged; dashboards/alerts need deployment monitoring |
| 7 | Durable Mongo queue across instances (done); BullMQ only if saturated | S | Avoids another worker service until metrics justify it |
| 8 | WhatsApp typing indicator for slow Gemini work (done) | S | Shows progress after a short delay |

Replies default off per shop. Deterministic replies cover greetings, matching
catalog prices/stock, and shop address; unknown questions get a safe handoff
fallback. If `WHATSAPP_AI_GEMINI_DATA_SHARING_ENABLED=true` and a Gemini key is
present, only an unknown text question plus limited shop/catalog facts is sent
to Gemini. Common email/phone patterns are redacted; arbitrary personal data
may remain in free text, so the server gate must stay off until data handling
is approved. No conversation history, billing/dues, order lookup, or bill
creation is sent to Gemini. The existing public-site assistant stays separate.
Gemini uses the first model in `GEMINI_MODEL`, at most 160 output tokens, and a
single request with a 4s default timeout. A per-shop Mongo minute bucket and
per-process concurrency caps avoid unrestricted provider load. When a Gemini
call is still running after `WHATSAPP_AI_TYPING_DELAY_MS` (default 1.2s), the
Cloud API receives a typing indicator; indicator failure does not block the
reply.

The app sends a completed WhatsApp message, not streamed tokens. Prompt
caching for shop replies is not implemented. Catalog text-search results use
`REDIS_URL` when configured, expire after `WHATSAPP_CATALOG_CACHE_TTL_MS`
(default 30s), and are invalidated after product writes. Without Redis the
bounded local cache is used. Current stock is always fetched fresh; billing
settings, dues, and invoice values are never served from this cache.

A local isolated-Mongo burst test posted 100 signed webhooks with AI and Meta
network calls disabled: ACK p95 was **573ms**, ACK throughput **163.93/s**, and
queue-plus-processing p95 **1,761ms** on this development machine. This is not
a sustained 100/minute Gemini test or a production guarantee. Provider/send
latency, storage, Redis availability, and deployment capacity still need
production-like measurement; the <2s simple and <5s AI targets remain goals.
Repeat with `backend/scripts/benchmark-whatsapp-webhooks.js`, setting
`WHATSAPP_BENCHMARK_MONGODB_URI` to a disposable database whose name contains
`benchmark`; the script drops only that database before and after the run.

## 4. MongoDB, billing, and verification plan

The billing module does not expose LLM tools for customer dues/order lookup.
Customer bill creation is a separate, default-off shop setting, independent of
Gemini. The customer sends `BILL:` followed by exact catalog lines such as
`2 x Product name`; the bot quotes the current total and due date and issues
nothing until that same WhatsApp customer replies with the one-time confirmation
code. The quote expires after 15 minutes. Issuance is limited to one active
store, known customer GST state, non-serialized catalog items, and enabled
shop pay-later settings. Price, stock, tax, and due date are rechecked at
confirmation. The existing `createSale` path writes the invoice, stock,
receivable/dues, order, and journals under a tenant-scoped idempotency key and
Mongo transaction where supported. This creates an **unpaid credit invoice**;
it does not take payment. Ambiguous branch, GST state, serialized stock, or
disabled credit is handed to staff.

Invoice download remains tenant-scoped. WhatsApp sends are durable jobs: the
worker renders the PDF in the background, stores it privately in Mongo GridFS,
then asks Meta to fetch it from a 10-minute HMAC-signed, tenant-checked URL.
Expired PDF artifacts are cleaned by the worker. The public route rejects
invalid/expired URLs and does not expose guessable static files. Document
messages work in the 24-hour customer-service window; an approved document
template outside it is not implemented. Current query indexes:

* `Message`: unique sparse `metadata.platformMessageId` (webhook dedupe) and
  `{userId, customerId, createdAt}` for chat history.
* `Customer`: `{userId, platform, platformId}` (`shop_platform_contact`) for
  inbound sender lookup; `{userId, phone}` for billing phone matching.
* `Product`: `{userId, isActive, name:text}` (`shop_active_product_text`) for
  shop-scoped catalog search.
* `Order`: `{userId, customerId, createdAt:-1}` (`shop_customer_orders`) for
  recent customer orders.
* `InventoryItem`: tenant/product/status for serialized stock counts.
* EMI invoice due lists: tenant/status/dueDate and tenant/store/status/dueDate.
  The integration tests run `explain("executionStats")` against the local
  MongoDB for these query shapes (using a hint for the due-list index). This
  verifies index use, not production-scale latency or selectivity.

Use `.lean()`, `.select()`, and pagination; message history and EMI dues do so,
and due lists cap at 500. The legacy `utils/cache.js` still holds admin report
summaries per process; the hot WhatsApp catalog search has its own shared
short-TTL Redis cache. Do not cache stock or dues for bill creation.

EMI checkout/payments use `withTxn` and idempotency keys; a standalone Mongo
server falls back without transaction rollback, so production money writes
need a replica set. The WhatsApp bill flow uses the same checkout path after
the customer's explicit confirmation and queues PDF delivery only after the
invoice transaction returns successfully.

PDF links, private GridFS storage, customer quote/confirmation/idempotency,
shop token encryption/migration, and message dedupe are covered by tests. Meta
Embedded Signup and the typing indicator cannot be live-tested without Tech
Provider approval/credentials. The local benchmark confirms webhook ACK and
queue handling under a burst, not Gemini <5s at 100/min; run that test with
production-like infrastructure before setting capacity.

### Meta references

* [Cloud API quickstart, tokens, and test webhook](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
* [Webhooks setup](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks)
* [Send messages and 24-hour window](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)
* [Pricing and current India rate card](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
* [Messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)
* [Embedded Signup v4 implementation](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation)

Meta Dashboard navigation above is current text guidance, not screenshots: no
Meta business account is connected in this development environment, so live
account screenshots/test-number onboarding could not be captured.
