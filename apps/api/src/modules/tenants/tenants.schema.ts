import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TenantDocument = HydratedDocument<Tenant>;

@Schema({
  collection: 'tenants',
  versionKey: false,
})
export class Tenant {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true })
  apiKeyHash!: string;

  @Prop({ required: true, default: () => new Date() })
  createdAt!: Date;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);

