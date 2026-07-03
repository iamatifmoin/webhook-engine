import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type WebhookSourceDocument = HydratedDocument<WebhookSource>;

export enum WebhookSourcePlatform {
  Generic = 'generic',
  Shopify = 'shopify',
}

@Schema({
  collection: 'webhooksources',
  versionKey: false,
})
export class WebhookSource {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  slug!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, enum: Object.values(WebhookSourcePlatform) })
  platform!: WebhookSourcePlatform;

  @Prop({ type: String, default: null })
  signingSecret!: string | null;

  @Prop({ required: true, default: () => new Date() })
  createdAt!: Date;
}

export const WebhookSourceSchema = SchemaFactory.createForClass(WebhookSource);

WebhookSourceSchema.index({ slug: 1 }, { unique: true });
WebhookSourceSchema.index({ tenantId: 1 });

