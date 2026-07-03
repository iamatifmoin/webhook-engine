import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type JobRecordDocument = HydratedDocument<JobRecord>;

export enum JobRecordStatus {
  Completed = 'completed',
  Failed = 'failed',
  Pending = 'pending',
  Running = 'running',
}

export interface JobRecordActionResult {
  actionType: 'email_notify' | 'http_dispatch';
  status: 'failed' | 'success';
  response: unknown;
  error: string | null;
  executedAt: Date;
}

@Schema({
  collection: 'jobrecords',
  versionKey: false,
})
export class JobRecord {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  webhookEventId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  ruleId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  ruleName!: string;

  @Prop({ type: String, default: null })
  bullJobId!: string | null;

  @Prop({ required: true, enum: Object.values(JobRecordStatus) })
  status!: JobRecordStatus;

  @Prop({ required: true, default: 0 })
  attempts!: number;

  @Prop({ type: String, default: null })
  lastError!: string | null;

  @Prop({
    type: [
      {
        actionType: { type: String, required: true },
        status: { type: String, required: true },
        response: { type: MongooseSchema.Types.Mixed, default: null },
        error: { type: String, default: null },
        executedAt: { type: Date, required: true },
      },
    ],
    default: [],
  })
  actionResults!: JobRecordActionResult[];

  @Prop({ required: true, default: () => new Date() })
  createdAt!: Date;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;
}

export const JobRecordSchema = SchemaFactory.createForClass(JobRecord);

JobRecordSchema.index({ tenantId: 1, createdAt: -1 });
JobRecordSchema.index({ tenantId: 1, webhookEventId: 1 });
JobRecordSchema.index({ tenantId: 1, status: 1 });
JobRecordSchema.index({ tenantId: 1, webhookEventId: 1, ruleId: 1 }, { unique: true });
