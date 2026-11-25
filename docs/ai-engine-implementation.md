# ChatShop AI engine: implementation and operations

This guide maps the scalable AI architecture onto ChatShop's current MERN
application. It reuses the public website assistant, WhatsApp auto-reply,
MongoDB webhook queues, and optional Redis catalog cache. It does not introduce
a second queue service or a vector database.

## Request paths

### Public website assistant

`POST /api/assistant/chat/stream` validates a bounded message history, applies
the visitor rate limit, assigns the System Guardian request ID, and accepts an
optional `Idempotency-Key`. A planner identifies up to
`ASSISTANT_MAX_QUESTIONS` questions. The provider receives the questions in one
numbered prompt so related questions share context and do not create an
unbounded number of model calls. When a visitor asks multiple distinct
questions, the planner now executes their provider calls independently with a
bounded concurrency limit and emits per-question completion status in plan
order. Independent database tools are not used on this public path; current
plan facts are loaded from the existing billing/settings services.

The server streams provider deltas as SSE and emits `request.accepted`,
`plan.created`, `task.started`, `answer.delta`, `answer.replace`,
`answer.question.completed`, `request.completed`, or `request.failed` events.
It sends heartbeat comments, disables proxy buffering, and aborts provider work
when the visitor explicitly stops a request. The React widget renders deltas,
handles final replacement on provider failure, and can retrieve a completed
answer after a dropped connection.

Request status and the final answer are stored for 24 hours so the widget can
recover a completed stream. The submitted conversation history is not stored.
The public request ID is a random capability URL; keep it private. Duplicate
idempotency keys return the existing result or an in-progress response rather
than starting a second provider call.

The existing non-streaming `POST /api/assistant/chat` and Super Admin test
endpoint remain available. The streaming UI is the default website widget
path.

### WhatsApp

Meta webhooks are signature-checked, deduplicated, and persisted in MongoDB
before the API acknowledges them. With `JOB_QUEUE_BACKEND=bullmq`, BullMQ/Redis
dispatches webhook and invoice jobs while MongoDB remains the idempotency
ledger and recovery source. Workers preserve sender order for webhooks, use
leases, retry with backoff, and reconcile pending Mongo records after restart.
Queue admission is serialized with a Mongo lease and checks the active backlog
before accepting new unique events. When the queue is full or admission is
busy, the webhook returns `503` so Meta can retry. Oversized webhook batches
also return `503`; events are not silently discarded.

Rules and catalog facts answer common questions first. Gemini work is optional,
time-limited, shop-rate-limited, and concurrency-limited. The catalog cache is
tenant-scoped; live stock and financial data are queried fresh. The AI is not
given access to order, payment, dues, or invoice lookups.

## Configuration

Website assistant:

| Variable | Default | Purpose |
|---|---:|---|
| `ASSISTANT_RATE_LIMIT` | 15 | Requests per IP per minute, per API process |
| `ASSISTANT_MAX_CONCURRENCY` | 20 | Simultaneous model calls per API process |
| `ASSISTANT_GLOBAL_MAX_CONCURRENCY` | 50 | Shared simultaneous model calls when `REDIS_URL` is configured |
| `ASSISTANT_REQUEST_TIMEOUT_MS` | 20000 | Provider timeout (1000-120000 ms) |
| `ASSISTANT_MAX_QUESTIONS` | 5 | Maximum questions parsed from one message (1-10) |
| `ASSISTANT_TASK_CONCURRENCY` | 3 | Maximum independent question calls per request (1-10) |

WhatsApp queue:

| Variable | Default | Purpose |
|---|---:|---|
| `WHATSAPP_WEBHOOK_CONCURRENCY` | 8 | Jobs processed per worker process |
| `WHATSAPP_WEBHOOK_MAX_BACKLOG` | 5000 | Maximum queued and processing events |
| `WHATSAPP_WEBHOOK_MAX_EVENTS_PER_REQUEST` | 5000 | Maximum events accepted in one webhook; cannot exceed backlog limit |
| `WHATSAPP_WEBHOOK_MAX_ATTEMPTS` | 8 | Retry limit before a job is marked failed |
| `WHATSAPP_WEBHOOK_LEASE_MS` | 60000 | Worker and admission lease duration |
| `JOB_QUEUE_BACKEND` | `mongodb` | Set to `bullmq` to dispatch webhook and invoice work through Redis; requires `REDIS_URL` |

The webhook backlog and idempotency records remain Mongo-backed in either
queue mode. In BullMQ mode, a reconciler re-dispatches queued or lease-expired
records after worker restarts. Website provider concurrency and visitor rate
limits use Redis when configured; Redis failures fall back to each process's
local caps. Without Redis, aggregate model concurrency and visitor rate limits
multiply by the replica count. Size limits against provider quotas and measured
latency; they are not capacity guarantees.

## Separate worker deployment

The API continues to run workers in-process by default for local development
and existing single-service deployments. To separate the runtime:

1. Set `RUN_BACKGROUND_WORKERS=false` on every API replica.
2. Start one or more worker services from `backend` with `npm run worker`.
3. Give API and worker services the same MongoDB URI and WhatsApp encryption,
   Meta, and public URL secrets needed by their jobs.
4. On multiple API replicas, set `EMI_CRON=off` on all but the one service that
   owns the existing EMI and subscription cron jobs.

Workers stop claiming new queue work on `SIGTERM`/`SIGINT` and wait for active
jobs to finish. Mongo leases allow another worker to recover jobs after a hard
process failure. Set the same `JOB_QUEUE_BACKEND` and `REDIS_URL` on API and
worker services when enabling BullMQ; API replicas enqueue into Redis while
workers process and reconcile the Mongo-backed records.

## Operational limits and next scale decision

- Provider concurrency, request counts, source, question count, error code, and
  stage timings are recorded without logging visitor prompts or secrets.
- The Super Admin website assistant status shows provider health, aggregate
  outcomes, approximate p95/p99 latency buckets, and queue depth/age. Provider
  token usage and cost still need provider usage aggregation and pricing data.
- The website assistant uses public product facts and deterministic rules; it
  is not tenant-scoped product RAG. WhatsApp catalog retrieval does enforce the
  shop tenant and reads current stock.

  ### Local tenant-scoped product Vector Search

  The WhatsApp catalog can use semantic retrieval over product name, description,
  category, SKU, and tags. Every vector query is pre-filtered by the trusted shop
  `userId` and `isActive`; price and stock are still read from MongoDB after the
  search and are never taken from an embedding. The embedding vector is excluded
  from normal product API reads.

  The Product collection has a text index today, but the current local MongoDB
  standalone (`8.2.5`) does not expose Search index commands. Use an Atlas Local
  deployment for local Search/Vector Search. Atlas Local is a separate local
  deployment managed by Atlas CLI and Docker; MongoDB Compass can connect to it,
  but Compass alone does not provide the search engine. Do not point the app at
  the new deployment or copy existing data until its URI and a backup are
  confirmed.

  After Docker Desktop is running, create the local search-capable deployment
  with `atlas local setup` and use the connection string it returns. Set that URI
  in the app's local environment. For containers, replace `localhost` in the
  returned URI with `host.docker.internal` and keep the selected host port.
  Start Redis, then create the approved
  `chatshop_products_vector_v1` index and queue existing products:

  ```powershell
  cd backend
  npm run vector:index:create
  npm run vector:reindex
  ```

  The index has a 768-dimensional cosine vector field named `vectorEmbedding`
  and filter fields `userId` and `isActive`. Product embeddings and query
  embeddings use Gemini `gemini-embedding-001`; only product catalog text
  (name/category/description/SKU/tags) and, with the separately approved
  `RAG_GEMINI_QUERY_ENABLED=true` setting, the visitor's product query are sent
  to Gemini. This uses the configured Gemini API key and may incur provider
  charges. Both `PRODUCT_VECTOR_SEARCH_ENABLED=true` and
  `RAG_GEMINI_QUERY_ENABLED=true` are required for semantic retrieval. If vector retrieval fails, WhatsApp catalog lookup
  logs the failure and falls back to the existing tenant-filtered text search.

  Product changes enqueue embedding jobs in BullMQ. Run `npm run worker` with the
  same MongoDB and Redis configuration to process them. The embedding backfill
  script is idempotent and can be rerun after an interruption.

  For local API load-balancer testing, copy `backend/.env.example` to
  `backend/.env`, set valid secrets and the Atlas Local connection URI, then run
  `docker compose up --build --scale api=3`. Nginx listens on port 8080, uses
  sticky routing for Socket.IO, and disables response buffering for SSE. Redis
  shares rate limits, provider caps, cache entries, and Socket.IO events across
  API replicas. This Compose stack is a local scale test, not production
  autoscaling or a cloud load-balancer deployment.

  No live Vector Search index was created in this workspace: Docker Desktop is
  not running, so Atlas Local is not available here. The approved index
  definition and creation script are included; do not enable vector search
  against the current standalone MongoDB connection.
- Provider concurrency and visitor rate limits are shared through Redis when
  configured; outage fallback is process-local to keep the help chat available.
- Reconnect recovers only completed results. A still-running request can be
  observed through `GET /api/assistant/requests/:requestId`; it is not replayed
  as a second provider stream.
- Do not claim unlimited capacity. Run the repository's webhook benchmark and
  repeat it with provider calls enabled in a staging environment before raising
  limits or promising latency targets.
