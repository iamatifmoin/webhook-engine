'use client';

import { Fragment } from 'react';
import { DashboardJob, JobActionResult } from '../dashboard.types';

interface JobsTableProps {
  expandedJobId: string | null;
  jobs: DashboardJob[];
  loading: boolean;
  page: number;
  pageSize: number;
  replayingJobId: string | null;
  total: number;
  onPageChange: (page: number) => void;
  onReplay: (jobId: string) => void;
  onToggleExpand: (jobId: string) => void;
}

const JOB_STATUS_LABELS: Record<DashboardJob['status'], string> = {
  completed: 'Completed',
  failed: 'Failed',
  pending: 'Pending',
  running: 'Running',
};

export function JobsTable({
  expandedJobId,
  jobs,
  loading,
  page,
  pageSize,
  replayingJobId,
  total,
  onPageChange,
  onReplay,
  onToggleExpand,
}: JobsTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="section-kicker">Job Records</p>
          <h2>Rule evaluation outcomes</h2>
        </div>
        <p className="panel-meta">{loading ? 'Refreshing...' : `${total} total jobs`}</p>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Rule Name</th>
              <th>Event Type</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Last Error</th>
              <th>Actions</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    {loading ? 'Loading jobs...' : 'No job records found for this tenant.'}
                  </div>
                </td>
              </tr>
            ) : (
              jobs.map((job) => {
                const isExpanded = expandedJobId === job._id;
                const canReplay = job.status === 'failed';
                const isReplaying = replayingJobId === job._id;

                return (
                  <Fragment key={job._id}>
                    <tr
                      className={isExpanded ? 'row-expanded' : undefined}
                      onClick={() => onToggleExpand(job._id)}
                    >
                      <td>{job.ruleName}</td>
                      <td>{job.eventType ?? 'Unknown event'}</td>
                      <td>
                        <span className={`status-badge status-${job.status}`}>
                          {JOB_STATUS_LABELS[job.status]}
                        </span>
                      </td>
                      <td>{job.attempts}</td>
                      <td title={job.lastError ?? ''}>
                        {job.lastError ? truncateText(job.lastError, 72) : 'None'}
                      </td>
                      <td>
                        {canReplay ? (
                          <button
                            className="secondary-button"
                            disabled={isReplaying}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onReplay(job._id);
                            }}
                          >
                            {isReplaying ? 'Replaying...' : 'Replay'}
                          </button>
                        ) : (
                          <span className="muted-copy">No replay</span>
                        )}
                      </td>
                      <td>{formatDateTime(job.createdAt)}</td>
                    </tr>
                    {isExpanded ? (
                      <tr className="detail-row">
                        <td colSpan={7}>
                          <div className="job-detail-card">
                            <div className="job-detail-grid">
                              <div>
                                <span className="detail-label">BullMQ Job</span>
                                <p className="detail-value mono-cell">{job.bullJobId ?? 'Pending'}</p>
                              </div>
                              <div>
                                <span className="detail-label">Completed At</span>
                                <p className="detail-value">
                                  {job.completedAt ? formatDateTime(job.completedAt) : 'Not completed'}
                                </p>
                              </div>
                            </div>

                            <div className="action-result-list">
                              <span className="detail-label">Action Results</span>
                              {job.actionResults.length === 0 ? (
                                <p className="muted-copy">No action results recorded yet.</p>
                              ) : (
                                job.actionResults.map((actionResult, index) => (
                                  <ActionResultCard
                                    key={`${job._id}-${actionResult.actionType}-${index}`}
                                    actionResult={actionResult}
                                  />
                                ))
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
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

function ActionResultCard({ actionResult }: { actionResult: JobActionResult }) {
  return (
    <article className="action-result-card">
      <div className="action-result-header">
        <strong>{actionResult.actionType}</strong>
        <span className={`status-badge status-action-${actionResult.status}`}>
          {actionResult.status}
        </span>
      </div>
      <p className="action-result-copy">
        {actionResult.error ?? formatResponse(actionResult.response)}
      </p>
      <p className="muted-copy">{formatDateTime(actionResult.executedAt)}</p>
    </article>
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

function formatResponse(value: unknown) {
  if (value === null || value === undefined) {
    return 'No response body recorded.';
  }

  if (typeof value === 'string') {
    return truncateText(value, 220);
  }

  return truncateText(JSON.stringify(value), 220);
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}
