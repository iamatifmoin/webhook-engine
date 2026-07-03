import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type WebhookEventDocument = HydratedDocument<WebhookEvent>;

export enum WebhookEventStatus {
  Duplicate = 'duplicate',
  FailedIngestion = 'failed_ingestion',
  Processed = 'processed',
  Queued = 'queued',
}

@Schema({
  collection: 'webhookevents',
  versionKey: false,
})
export class WebhookEvent {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  sourceId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  eventType!: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payload!: Record<string, unknown>;

  @Prop({ required: true, trim: true })
  idempotencyKey!: string;

  @Prop({ required: true, enum: Object.values(WebhookEventStatus) })
  status!: WebhookEventStatus;

  @Prop({ required: true, default: () => new Date() })
  receivedAt!: Date;
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);

// Tenant-scoped dedup keeps idempotency isolated even when two tenants reuse the same platform webhook key.
WebhookEventSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
WebhookEventSchema.index({ tenantId: 1, receivedAt: -1 });
WebhookEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 2_592_000 });
