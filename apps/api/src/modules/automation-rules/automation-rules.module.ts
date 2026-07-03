import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AutomationRule, AutomationRuleSchema } from './automation-rules.schema';
import { AutomationRulesService } from './automation-rules.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: AutomationRule.name,
        schema: AutomationRuleSchema,
      },
    ]),
  ],
  providers: [AutomationRulesService],
  exports: [MongooseModule, AutomationRulesService],
})
export class AutomationRulesModule {}
