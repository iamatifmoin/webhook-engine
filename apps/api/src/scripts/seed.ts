import 'reflect-metadata';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { AutomationRule, AutomationRuleSchema } from '../modules/automation-rules/automation-rules.schema';
import { JobRecord, JobRecordSchema } from '../modules/job-records/job-records.schema';
import { Tenant, TenantSchema } from '../modules/tenants/tenants.schema';
import {
  WebhookSource,
  WebhookSourcePlatform,
  WebhookSourceSchema,
} from '../modules/webhook-sources/webhook-sources.schema';
import { WebhookEvent, WebhookEventSchema } from '../modules/webhook-events/webhook-events.schema';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function seed() {
  const mongoUri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/debales-webhook';
  await mongoose.connect(mongoUri);

  const connection = mongoose.connection;
  const TenantModel = connection.model(Tenant.name, TenantSchema);
  const WebhookSourceModel = connection.model(WebhookSource.name, WebhookSourceSchema);
  const AutomationRuleModel = connection.model(AutomationRule.name, AutomationRuleSchema);
  const WebhookEventModel = connection.model(WebhookEvent.name, WebhookEventSchema);
  const JobRecordModel = connection.model(JobRecord.name, JobRecordSchema);

  await JobRecordModel.deleteMany({});
  await WebhookEventModel.deleteMany({});
  await AutomationRuleModel.deleteMany({});
  await WebhookSourceModel.deleteMany({});
  await TenantModel.deleteMany({});

  const [acmeTenant, betaTenant] = await TenantModel.create([
    {
      name: 'Acme Corp',
      apiKeyHash: sha256('key_acme_abc123'),
    },
    {
      name: 'Beta Ltd',
      apiKeyHash: sha256('key_beta_def456'),
    },
  ]);

  const [acmeSource, betaSource] = await WebhookSourceModel.create([
    {
      tenantId: acmeTenant._id,
      slug: 'shopify-acme',
      name: 'Acme Shopify Store',
      platform: WebhookSourcePlatform.Shopify,
      signingSecret: 'shopify_acme_secret',
    },
    {
      tenantId: betaTenant._id,
      slug: 'stripe-beta',
      name: 'Beta Stripe Account',
      platform: WebhookSourcePlatform.Generic,
      signingSecret: 'stripe_beta_secret',
    },
  ]);

  const rules = await AutomationRuleModel.create([
    {
      tenantId: acmeTenant._id,
      sourceId: acmeSource._id,
      name: 'High-value order alert',
      eventType: 'order.created',
      enabled: true,
      conditions: [
        {
          field: 'order.total_price',
          operator: 'gt',
          value: 500,
        },
      ],
      actions: [
        {
          type: 'http_dispatch',
          config: {
            url: 'http://localhost:8888/echo',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
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
    },
    {
      tenantId: acmeTenant._id,
      sourceId: acmeSource._id,
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
    },
    {
      tenantId: betaTenant._id,
      sourceId: betaSource._id,
      name: 'Payment failure alert',
      eventType: 'payment.failed',
      enabled: true,
      conditions: [
        {
          field: 'amount',
          operator: 'gt',
          value: 100,
        },
      ],
      actions: [
        {
          type: 'http_dispatch',
          config: {
            url: 'http://localhost:8888/echo',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        },
      ],
    },
    {
      tenantId: betaTenant._id,
      sourceId: betaSource._id,
      name: 'Guaranteed failure dispatch',
      eventType: 'payment.failed',
      enabled: true,
      conditions: [
        {
          field: 'amount',
          operator: 'gt',
          value: 1000,
        },
      ],
      actions: [
        {
          type: 'http_dispatch',
          config: {
            url: 'http://localhost:9999',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        },
      ],
    },
  ]);

  await Promise.all([
    TenantModel.createIndexes(),
    WebhookSourceModel.createIndexes(),
    AutomationRuleModel.createIndexes(),
    WebhookEventModel.createIndexes(),
    JobRecordModel.createIndexes(),
  ]);

  console.log('Seeded tenants:');
  console.log(`- Acme Corp: ${String(acmeTenant._id)} apiKey=key_acme_abc123`);
  console.log(`- Beta Ltd: ${String(betaTenant._id)} apiKey=key_beta_def456`);
  console.log('Seeded sources:');
  console.log(`- shopify-acme: ${String(acmeSource._id)}`);
  console.log(`- stripe-beta: ${String(betaSource._id)}`);
  console.log('Seeded rules:');
  for (const rule of rules) {
    console.log(`- ${rule.name}: ${String(rule._id)}`);
  }

  await connection.close();
}

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
