export interface DashboardEvent {
  _id: string;
  eventType: string;
  idempotencyKey: string;
  receivedAt: string;
  sourceName?: string;
  sourceSlug?: string;
  status: 'duplicate' | 'failed_ingestion' | 'processed' | 'queued';
}

export interface DashboardEventsResponse {
  data: DashboardEvent[];
  total: number;
}

export interface DashboardRule {
  _id: string;
  name: string;
  enabled: boolean;
  eventType: string;
}

export interface DashboardRulesResponse {
  data: DashboardRule[];
}

export interface JobActionResult {
  actionType: 'email_notify' | 'http_dispatch';
  error: string | null;
  executedAt: string;
  response: unknown;
  status: 'failed' | 'success';
}

export interface DashboardJob {
  _id: string;
  actionResults: JobActionResult[];
  attempts: number;
  bullJobId: string | null;
  completedAt: string | null;
  createdAt: string;
  eventType?: string;
  lastError: string | null;
  ruleName: string;
  status: 'completed' | 'failed' | 'pending' | 'running';
  webhookEventId: string;
}

export interface DashboardJobsResponse {
  data: DashboardJob[];
  total: number;
}
