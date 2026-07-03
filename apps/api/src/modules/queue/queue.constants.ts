export const WEBHOOK_ENGINE_QUEUE = 'webhook-engine';
export const EVALUATE_RULES_JOB = 'evaluate-rules';
export const DISPATCH_ACTIONS_JOB = 'dispatch-actions';
export const DEBUG_SLOW_JOB_KEY = 'debug:slow_job';

export interface EvaluateRulesJobData {
  eventType: string;
  sourceId: string;
  tenantId: string;
  webhookEventId: string;
}

export interface DispatchActionsJobData {
  jobRecordId: string;
  ruleId: string;
  tenantId: string;
  webhookEventId: string;
}
