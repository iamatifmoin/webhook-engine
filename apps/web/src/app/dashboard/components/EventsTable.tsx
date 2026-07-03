'use client';

import { DashboardEvent } from '../dashboard.types';

interface EventsTableProps {
  events: DashboardEvent[];
  loading: boolean;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const EVENT_STATUS_LABELS: Record<DashboardEvent['status'], string> = {
  duplicate: 'Duplicate',
  failed_ingestion: 'Failed ingestion',
  processed: 'Processed',
  queued: 'Queued',
};

export function EventsTable({
  events,
  loading,
  page,
  total,
  pageSize,
  onPageChange,
}: EventsTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="section-kicker">Recent Events</p>
          <h2>Inbound webhook deliveries</h2>
        </div>
        <p className="panel-meta">{loading ? 'Refreshing...' : `${total} total events`}</p>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Event Type</th>
              <th>Source</th>
              <th>Idempotency Key</th>
              <th>Status</th>
              <th>Received At</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    {loading ? 'Loading events...' : 'No webhook events found for this tenant.'}
                  </div>
                </td>
              </tr>
            ) : (
              events.map((eventRecord) => (
                <tr key={eventRecord._id}>
                  <td>{eventRecord.eventType}</td>
                  <td>
                    <div className="stacked-copy">
                      <strong>{eventRecord.sourceName ?? 'Unknown source'}</strong>
                      <span>{eventRecord.sourceSlug ?? 'n/a'}</span>
                    </div>
                  </td>
                  <td className="mono-cell">{eventRecord.idempotencyKey}</td>
                  <td>
                    <span className={`status-badge status-${eventRecord.status}`}>
                      {EVENT_STATUS_LABELS[eventRecord.status]}
                    </span>
                  </td>
                  <td>{formatDateTime(eventRecord.receivedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </section>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <button
        className="secondary-button"
        disabled={currentPage <= 1}
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
      >
        Previous
      </button>
      <span className="pagination-copy">
        Page {currentPage} of {totalPages}
      </span>
      <button
        className="secondary-button"
        disabled={currentPage >= totalPages}
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next
      </button>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}
