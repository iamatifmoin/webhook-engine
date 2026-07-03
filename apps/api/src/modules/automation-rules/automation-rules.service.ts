import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AutomationRule, AutomationRuleDocument } from './automation-rules.schema';

@Injectable()
export class AutomationRulesService {
  constructor(
    @InjectModel(AutomationRule.name)
    private readonly automationRuleModel: Model<AutomationRuleDocument>,
  ) {}

  async findEnabledForEvent(
    tenantId: string,
    sourceId: string,
    eventType: string,
  ): Promise<AutomationRuleDocument[]> {
    return this.automationRuleModel
      .find({
        tenantId,
        sourceId,
        eventType,
        enabled: true,
      })
      .exec();
  }

  async findByIdForTenant(
    ruleId: string,
    tenantId: string,
  ): Promise<AutomationRuleDocument | null> {
    return this.automationRuleModel
      .findOne({
        _id: ruleId,
        tenantId,
      })
      .exec();
  }
}
