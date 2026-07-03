'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EventsTable } from './components/EventsTable';
import { JobsTable } from './components/JobsTable';
import {
  DashboardEvent,
  DashboardEventsResponse,
  DashboardJob,
  DashboardJobsResponse,
  DashboardRule,
  DashboardRulesResponse,
} from './dashboard.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const PAGE_SIZE = 20;
const TENANT_API_KEY_STORAGE = 'debales.tenantApiKey';
const TENANT_NAME_STORAGE = 'debales.tenantName';

export default function DashboardPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>('');
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [rules, setRules] = useState<DashboardRule[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [jobsPage, setJobsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [replayingJobId, setReplayingJobId] = useState<string | null>(null);

  const enabledRulesCount = rules.filter((rule) => rule.enabled).length;

  useEffect(() => {
    const storedApiKey = sessionStorage.getItem(TENANT_API_KEY_STORAGE);
    const storedTenantName = sessionStorage.getItem(TENANT_NAME_STORAGE);

    if (!storedApiKey) {
      router.replace('/login');
      return;
    }

    setApiKey(storedApiKey);
    setTenantName(storedTenantName ?? 'Selected tenant');
  }, [router]);

  useEffect(() => {
    if (!apiKey) {
      return;
    }

    const activeApiKey = apiKey;
    let ignore = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    async function loadData(showLoadingState: boolean) {
      if (showLoadingState) {
        setLoading(true);
      }

      try {
        const [eventsResponse, jobsResponse, rulesResponse] = await Promise.all([
          fetchDashboard<DashboardEventsResponse>(
            `/dashboard/events?page=${eventsPage}&limit=${PAGE_SIZE}`,
            activeApiKey,
          ),
          fetchDashboard<DashboardJobsResponse>(
            `/dashboard/jobs?page=${jobsPage}&limit=${PAGE_SIZE}`,
            activeApiKey,
          ),
          fetchDashboard<DashboardRulesResponse>('/dashboard/rules', activeApiKey),
        ]);

        if (ignore) {
          return;
        }

        setEvents(eventsResponse.data);
        setEventsTotal(eventsResponse.total);
        setJobs(jobsResponse.data);
        setJobsTotal(jobsResponse.total);
        setRules(rulesResponse.data);
        setError(null);
      } catch (loadError) {
        if (ignore) {
          return;
        }

        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load dashboard data.',
        );
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData(true).catch(() => undefined);
    intervalId = setInterval(() => {
      loadData(false).catch(() => undefined);
    }, 5000);

    return () => {
      ignore = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [apiKey, eventsPage, jobsPage]);

  async function handleReplay(jobId: string) {
    if (!apiKey) {
      return;
    }

    setReplayingJobId(jobId);

    try {
      await fetchDashboard(`/dashboard/replay/${jobId}`, apiKey, {
        method: 'POST',
      });

      const [eventsResponse, jobsResponse, rulesResponse] = await Promise.all([
        fetchDashboard<DashboardEventsResponse>(
          `/dashboard/events?page=${eventsPage}&limit=${PAGE_SIZE}`,
          apiKey,
        ),
        fetchDashboard<DashboardJobsResponse>(
          `/dashboard/jobs?page=${jobsPage}&limit=${PAGE_SIZE}`,
          apiKey,
        ),
        fetchDashboard<DashboardRulesResponse>('/dashboard/rules', apiKey),
      ]);

      setEvents(eventsResponse.data);
      setEventsTotal(eventsResponse.total);
      setJobs(jobsResponse.data);
      setJobsTotal(jobsResponse.total);
      setRules(rulesResponse.data);
      setError(null);
    } catch (replayError) {
      setError(
        replayError instanceof Error ? replayError.message : 'Replay request failed.',
      );
    } finally {
      setReplayingJobId(null);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(TENANT_API_KEY_STORAGE);
    sessionStorage.removeItem(TENANT_NAME_STORAGE);
    router.push('/login');
  }

  if (!apiKey) {
    return (
      <main className="dashboard-shell">
        <section className="panel">
          <div className="empty-state">Loading tenant session...</div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Tenant Dashboard</p>
          <h1>Webhook Engine</h1>
          <p className="lead">
            Reviewing event ingestion, BullMQ job execution, and replay state for{' '}
            <strong>{tenantName}</strong>.
          </p>
        </div>

        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span className="summary-label">Rules loaded</span>
          <strong>{rules.length}</strong>
          <p>{enabledRulesCount} enabled for evaluation.</p>
        </article>
        <article className="summary-card">
          <span className="summary-label">Event refresh</span>
          <strong>5 seconds</strong>
          <p>Dashboard data auto-polls the API with the stored tenant key.</p>
        </article>
        <article className="summary-card">
          <span className="summary-label">API target</span>
          <strong>{API_BASE_URL.replace(/^https?:\/\//, '')}</strong>
          <p>All requests are scoped with `X-Tenant-Api-Key`.</p>
        </article>
      </section>

      {error ? (
        <section className="error-banner" role="alert">
          {error}
        </section>
      ) : null}

      <EventsTable
        events={events}
        loading={loading}
        page={eventsPage}
        pageSize={PAGE_SIZE}
        total={eventsTotal}
        onPageChange={setEventsPage}
      />

      <JobsTable
        expandedJobId={expandedJobId}
        jobs={jobs}
        loading={loading}
        page={jobsPage}
        pageSize={PAGE_SIZE}
        replayingJobId={replayingJobId}
        total={jobsTotal}
        onPageChange={setJobsPage}
        onReplay={handleReplay}
        onToggleExpand={(jobId) =>
          setExpandedJobId((currentValue) => (currentValue === jobId ? null : jobId))
        }
      />
    </main>
  );
}

async function fetchDashboard<T>(
  path: string,
  apiKey: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      ...(init?.headers ?? {}),
      'Content-Type': 'application/json',
      'X-Tenant-Api-Key': apiKey,
    },
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function extractErrorMessage(response: Response) {
  const responseText = await response.text();
  if (!responseText) {
    return `Request failed with status ${response.status}.`;
  }

  try {
    const parsed = JSON.parse(responseText) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(', ');
    }

    return parsed.message ?? responseText;
  } catch {
    return responseText;
  }
}
