import { Injectable } from '@nestjs/common';
import {
  ActionType,
  AutomationRuleAction,
} from '../automation-rules/automation-rules.schema';
import { EmailNotifyHandler } from './handlers/email-notify.handler';
import { HttpDispatchHandler } from './handlers/http-dispatch.handler';

@Injectable()
export class ActionsService {
  constructor(
    private readonly httpDispatchHandler: HttpDispatchHandler,
    private readonly emailNotifyHandler: EmailNotifyHandler,
  ) {}

  async execute(
    action: AutomationRuleAction,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    switch (action.type) {
      case 'http_dispatch':
        return this.httpDispatchHandler.execute(action.config, payload);
      case 'email_notify':
        return this.emailNotifyHandler.execute(action.config, payload);
      default:
        return this.throwUnsupportedAction(action.type);
    }
  }

  private throwUnsupportedAction(actionType: ActionType): never {
    throw new Error(`Unsupported action type: ${actionType}`);
  }
}
