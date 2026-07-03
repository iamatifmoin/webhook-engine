import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AutomationRuleDocument = HydratedDocument<AutomationRule>;

export type ConditionOperator = 'contains' | 'eq' | 'gt' | 'lt';
export type ActionType = 'email_notify' | 'http_dispatch';

export interface AutomationRuleCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export interface AutomationRuleAction {
  type: ActionType;
  config: Record<string, unknown>;
}

@Schema({
  collection: 'automationrules',
  versionKey: false,
})
export class AutomationRule {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  sourceId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  eventType!: string;

  @Prop({ required: true, default: true })
  enabled!: boolean;

  @Prop({
    type: [
      {
        field: { type: String, required: true },
        operator: { type: String, required: true },
        value: { type: MongooseSchema.Types.Mixed, required: true },
      },
    ],
    default: [],
  })
  conditions!: AutomationRuleCondition[];

  @Prop({
    type: [
      {
        type: { type: String, required: true },
        config: { type: MongooseSchema.Types.Mixed, required: true },
      },
    ],
    default: [],
  })
  actions!: AutomationRuleAction[];

  @Prop({ required: true, default: () => new Date() })
  createdAt!: Date;
}

export const AutomationRuleSchema = SchemaFactory.createForClass(AutomationRule);

AutomationRuleSchema.index({ tenantId: 1, sourceId: 1, eventType: 1, enabled: 1 });

