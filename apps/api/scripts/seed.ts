import { MongoClient } from 'mongodb';
import { sha256Hex } from '../src/common/utils/crypto';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/debales-webhook';

async function seed() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log('Connected to MongoDB');

  const db = client.db();

  await db.dropDatabase();
  console.log('Cleared database');

  const tenantsCollection = db.collection('tenants');
  const sourcesCollection = db.collection('webhooksources');
  const rulesCollection = db.collection('automationrules');
  const eventsCollection = db.collection('webhookevents');
  const jobRecordsCollection = db.collection('jobrecords');

  const tenantA = await tenantsCollection.insertOne({
    name: 'Acme Corp',
    apiKeyHash: sha256Hex('key_acme_abc123'),
    createdAt: new Date(),
  });

  const sourceA = await sourcesCollection.insertOne({
    tenantId: tenantA.insertedId,
    slug: 'shopify-acme',
    name: 'Acme Shopify Store',
    platform: 'shopify',
    signingSecret: 'shopify_acme_secret',
    createdAt: new Date(),
  });

  await rulesCollection.insertOne({
    tenantId: tenantA.insertedId,
    sourceId: sourceA.insertedId,
    name: 'High-value order alert',
    eventType: 'order.created',
    enabled: true,
    conditions: [
      { field: 'order.total_price', operator: 'gt', value: 500 },
    ],
    actions: [
      {
        type: 'http_dispatch',
        config: {
          url: 'http://localhost:8888/echo',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      {
        type: 'email_notify',
        config: {
          to: 'sales@acme.com',
          subject: 'High-value order received',
          bodyTemplate: 'Order {{order.id}} totalling ${{order.total_price}} received.',
        },
      },
    ],
    createdAt: new Date(),
  });

  await rulesCollection.insertOne({
    tenantId: tenantA.insertedId,
    sourceId: sourceA.insertedId,
    name: 'Cancelled order notice',
    eventType: 'order.cancelled',
    enabled: true,
    conditions: [],
    actions: [
      {
        type: 'email_notify',
        config: {
          to: 'ops@acme.com',
          subject: 'Order cancelled',
          bodyTemplate: 'Order {{order.id}} was cancelled by {{order.customer_email}}.',
        },
      },
    ],
    createdAt: new Date(),
  });

  const tenantB = await tenantsCollection.insertOne({
    name: 'Beta Ltd',
    apiKeyHash: sha256Hex('key_beta_def456'),
    createdAt: new Date(),
  });

  const sourceB = await sourcesCollection.insertOne({
    tenantId: tenantB.insertedId,
    slug: 'stripe-beta',
    name: 'Beta Stripe Integration',
    platform: 'generic',
    signingSecret: 'stripe_beta_secret',
    createdAt: new Date(),
  });

  await rulesCollection.insertOne({
    tenantId: tenantB.insertedId,
    sourceId: sourceB.insertedId,
    name: 'Payment failure alert',
    eventType: 'payment.failed',
    enabled: true,
    conditions: [
      { field: 'amount', operator: 'gt', value: 100 },
    ],
    actions: [
      {
        type: 'http_dispatch',
        config: {
          url: 'http://localhost:8888/echo',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      },
    ],
    createdAt: new Date(),
  });

  await rulesCollection.insertOne({
    tenantId: tenantB.insertedId,
    sourceId: sourceB.insertedId,
    name: 'Guaranteed failure dispatch',
    eventType: 'payment.failed',
    enabled: true,
    conditions: [
      { field: 'amount', operator: 'gt', value: 1000 },
    ],
    actions: [
      {
        type: 'http_dispatch',
        config: {
          url: 'http://localhost:9999',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      },
    ],
    createdAt: new Date(),
  });

  await Promise.all([
    sourcesCollection.createIndex({ slug: 1 }, { unique: true }),
    sourcesCollection.createIndex({ tenantId: 1 }),
    rulesCollection.createIndex({ tenantId: 1, sourceId: 1, eventType: 1, enabled: 1 }),
    eventsCollection.createIndex({ tenantId: 1, idempotencyKey: 1 }, { unique: true }),
    eventsCollection.createIndex({ tenantId: 1, receivedAt: -1 }),
    eventsCollection.createIndex({ receivedAt: 1 }, { expireAfterSeconds: 2592000 }),
    jobRecordsCollection.createIndex({ tenantId: 1, createdAt: -1 }),
    jobRecordsCollection.createIndex({ tenantId: 1, webhookEventId: 1 }),
    jobRecordsCollection.createIndex({ tenantId: 1, status: 1 }),
    jobRecordsCollection.createIndex({ tenantId: 1, webhookEventId: 1, ruleId: 1 }, { unique: true }),
  ]);

  console.log('Seed completed successfully');
  console.log('Acme Corp API key: key_acme_abc123');
  console.log('Beta Ltd API key: key_beta_def456');

  await client.close();
  console.log('Disconnected from MongoDB');
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
