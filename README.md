# Debales Webhook Automation Engine

This is a demo webhook automation engine (multi-tenant system) with:

- tenant-authenticated webhook ingestion
- tenant-scoped deduplication
- BullMQ rule evaluation and action dispatch
- replay for failed jobs
- a minimal Next.js dashboard

## Production Deployment

This app is deployed on:

- **API**: https://debalesapi-production.up.railway.app
- **Dashboard**: https://webhook-engine-web.vercel.app

## Setup

1. Start the containers:

```bash
docker-compose up mongo redis echo-server -d
```

2. Seed the database:

```bash
npm run seed
```

3. Start the api service:

```bash
npm run dev:api
```

4. Start the web service:

```bash
npm run dev:web
```

5. Open the dashboard:

- API: `http://localhost:3000`
- Web: `http://localhost:3001`
- Echo server: `http://localhost:8888`

If you want to exercise the webhook flow end to end from the shell, run:

```bash
npm run test:webhook
```

The helper defaults to the local API. Set `API_URL=http://localhost:3000` if you want to point it at your local API explicitly.

## Seeded Demo Data

The seed script creates deterministic data so the demo commands stay fixed.

Tenant A:

- name: `Acme Corp`
- API key: `key_acme_abc123`
- source slug: `shopify-acme`
- rules:
  - high-value order alert
  - order cancelled notice

Tenant B:

- name: `Beta Ltd`
- API key: `key_beta_def456`
- source slug: `stripe-beta`
- rules:
  - payment failure alert
  - guaranteed failure dispatch

## Data Model

### Tenant

- `apiKeyHash` stores a SHA-256 hash of the demo API key.
- The tradeoff is intentional for this build: it is fast and simple, but not production auth.

### WebhookSource

- `slug` is the public webhook URL identifier.
- Using a stable slug keeps the webhook route readable and avoids exposing ObjectIds.
- `signingSecret` enables signature verification when the source needs it.

### AutomationRule

- Conditions and actions stay embedded because they are always read together during evaluation and dispatch.
- The rule index is scoped by tenant, source, event type, and enabled state so the evaluate query stays hot-path friendly.

### WebhookEvent

- The raw payload is stored in MongoDB and replayed from there.
- Deduplication uses the compound unique index `{ tenantId, idempotencyKey }` so tenants cannot block each other.
- `receivedAt` has a TTL index so the event log self-cleans after 30 days.

### JobRecord

- `ruleName` is denormalized for dashboard reads.
- `actionResults` stays embedded because the dashboard always reads the whole result set together.
- Replay resets the same failed record instead of creating a second failure record for the same path.
- A unique `{ tenantId, webhookEventId, ruleId }` index prevents retry races from creating duplicate dispatch records.

## Queue Design

The system uses one BullMQ queue named `webhook-engine` with two job names:

- `evaluate-rules`
- `dispatch-actions`

Why one queue first:

- it keeps the infrastructure simple
- BullMQ already gives atomic job pickup
- concurrency can be tuned per worker before splitting queues

Job shapes:

```ts
evaluate-rules: {
  tenantId: string;
  webhookEventId: string;
  sourceId: string;
  eventType: string;
}

dispatch-actions: {
  tenantId: string;
  jobRecordId: string;
  webhookEventId: string;
  ruleId: string;
}
```

Retry and recovery behavior:

- both jobs retry up to 3 times with exponential backoff
- `dispatch-actions` reloads the event payload and live rule from MongoDB
- the worker is configured with a lowered stalled interval so crash recovery is demoable
- the crash demo restarts the API service that is running the worker

## Demo Scenarios

Set these first:

```powershell
$API_URL = 'http://localhost:3000'
$DASHBOARD_URL = 'http://localhost:3001'

function Get-ShopifySignature([string]$Body) {
  $key = [System.Text.Encoding]::UTF8.GetBytes('shopify_acme_secret')
  $hash = [System.Security.Cryptography.HMACSHA256]::new($key).ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Body))
  [System.Convert]::ToBase64String($hash)
}

function Get-StripeSignature([string]$Body) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body + 'stripe_beta_secret')
  ([System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes))).Replace('-', '').ToLower()
}

function Invoke-DemoWebhook([string]$Path, [string]$Body, [hashtable]$Headers) {
  Invoke-RestMethod -Method Post -Uri "$API_URL$Path" -Headers $Headers -Body $Body -ContentType 'application/json'
}

$AcmeBody = '{"order":{"id":"1001","total_price":750,"customer_email":"buyer@test.com"}}'
$CrashBody = '{"order":{"id":"1002","total_price":750,"customer_email":"buyer@test.com"}}'
$BetaBody = '{"amount":1500,"payment_id":"pay_002","customer_email":"buyer@test.com"}'

$AcmeHeaders = @{
  'X-Tenant-Api-Key' = 'key_acme_abc123'
  'X-Idempotency-Key' = 'demo-evt-001'
  'X-Event-Type' = 'order.created'
  'X-Shopify-Hmac-Sha256' = Get-ShopifySignature $AcmeBody
}

$CrashHeaders = @{
  'X-Tenant-Api-Key' = 'key_acme_abc123'
  'X-Idempotency-Key' = 'demo-crash-001'
  'X-Event-Type' = 'order.created'
  'X-Shopify-Hmac-Sha256' = Get-ShopifySignature $CrashBody
}

$BetaHeaders = @{
  'X-Tenant-Api-Key' = 'key_beta_def456'
  'X-Idempotency-Key' = 'demo-fail-001'
  'X-Event-Type' = 'payment.failed'
  'X-Webhook-Signature' = Get-StripeSignature $BetaBody
}
```

### 1. Send a webhook - it should succeed

```powershell
Invoke-DemoWebhook '/webhooks/shopify-acme' $AcmeBody $AcmeHeaders
```

Expected response:

```json
{ "acknowledged": true, "duplicate": false }
```

### 2. Send the same webhook again - show it does not double-process

```powershell
Invoke-DemoWebhook '/webhooks/shopify-acme' $AcmeBody $AcmeHeaders
```

Expected response:

```json
{ "acknowledged": true, "duplicate": true }
```

That second request should not create a new event or a new job record.

### 3. Crash the worker mid-job, restart it, show the job recovers

Arm the slow-job hook:

```powershell
Invoke-RestMethod -Method Post -Uri "$API_URL/admin/debug/slow-next-job"
```

Send a fresh webhook while the hook is armed:

```powershell
Invoke-DemoWebhook '/webhooks/shopify-acme' $CrashBody $CrashHeaders
```

While that job is active:

- restart the deployed API service that hosts the worker
- wait for the stall check to reclaim the job
- refresh the dashboard until the job returns and completes

### 4. Trigger a failure, show it in the UI, replay it

Send the guaranteed failure webhook:

```powershell
Invoke-DemoWebhook '/webhooks/stripe-beta' $BetaBody $BetaHeaders
```

Open the dashboard with the Beta tenant:

- Select `Beta Ltd`
- You should see one failed job for `Guaranteed failure dispatch`

Replay the failed job without copying the id by hand:

```powershell
$FailedJob = Invoke-RestMethod -Method Get -Uri "$API_URL/dashboard/jobs?status=failed&limit=1&page=1" -Headers @{ 'X-Tenant-Api-Key' = 'key_beta_def456' }
Invoke-RestMethod -Method Post -Uri "$API_URL/dashboard/replay/$($FailedJob.data[0]._id)" -Headers @{ 'X-Tenant-Api-Key' = 'key_beta_def456' }
```

The replay should reset the failed job to pending, enqueue a new dispatch job, and then update again in the dashboard.

## Scaling Answer

The real load number is `500,000 * 3 = 1,500,000` events/day, not 1,500/day.

Here is how the current design behaves, where it breaks, and what I would change first:

1. Ingestion holds up longer than people expect.
   - The hot path is MongoDB dedup lookup, MongoDB insert, then Redis enqueue.
   - Those are indexed operations and are fine for the demo scale.
   - The compound dedup index stays tenant-scoped so one tenant cannot block another.

2. The first bottleneck is dispatch throughput.
   - Dispatch jobs make outbound HTTP calls, so they are I/O bound.
   - If each action takes a few hundred milliseconds, queue depth grows faster than the worker can drain it.
   - That is the first place the system breaks, not Redis enqueue.

3. The immediate fix is to raise dispatch concurrency and keep timeouts strict.
   - `evaluate-rules` can run at higher concurrency because it is cheap.
   - `dispatch-actions` should use a bounded timeout so slow third parties do not pin workers forever.

4. The next fix is more worker replicas.
   - BullMQ is safe across multiple workers because each job is picked up atomically.
   - This is the main advantage over a naive in-process queue.

5. The medium-term fix is moving dedup ahead of MongoDB.
   - Redis `SETNX` with TTL can reject most re-deliveries before they hit MongoDB.
   - The Mongo unique index remains as a safety net.

6. The longer-term fix is fairness.
   - A single large tenant can dominate a shared FIFO queue.
   - Per-tenant or per-tier queues are the next step once the shared design proves the workflow.

The order I would change things in is:

1. raise dispatch concurrency and keep the HTTP timeout tight
2. add worker replicas
3. move dedup to Redis
4. split queue capacity by tenant tier
5. tune Mongo write concern and read scaling



