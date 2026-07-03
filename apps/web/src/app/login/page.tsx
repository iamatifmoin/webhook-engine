'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const TENANTS = [
  {
    apiKey: 'key_acme_abc123',
    name: 'Acme Corp',
  },
  {
    apiKey: 'key_beta_def456',
    name: 'Beta Ltd',
  },
];

const TENANT_API_KEY_STORAGE = 'debales.tenantApiKey';
const TENANT_NAME_STORAGE = 'debales.tenantName';

export default function LoginPage() {
  const router = useRouter();
  const [selectedApiKey, setSelectedApiKey] = useState(TENANTS[0].apiKey);

  function handleEnterDashboard() {
    const tenant = TENANTS.find((entry) => entry.apiKey === selectedApiKey);
    if (!tenant) {
      return;
    }

    sessionStorage.setItem(TENANT_API_KEY_STORAGE, tenant.apiKey);
    sessionStorage.setItem(TENANT_NAME_STORAGE, tenant.name);
    router.push('/dashboard');
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Session 5 Dashboard UI</p>
        <h1>Webhook Engine</h1>
        <p className="lead">
          Select a seeded tenant to inspect recent webhook events, job records, and replay failed
          dispatches.
        </p>

        <label className="field">
          <span>Tenant</span>
          <select
            aria-label="Tenant"
            className="select-input"
            value={selectedApiKey}
            onChange={(event) => setSelectedApiKey(event.target.value)}
          >
            {TENANTS.map((tenant) => (
              <option key={tenant.apiKey} value={tenant.apiKey}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>

        <button className="primary-button" type="button" onClick={handleEnterDashboard}>
          Enter Dashboard
        </button>

        <dl className="login-details">
          <div>
            <dt>API target</dt>
            <dd>{process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}</dd>
          </div>
          <div>
            <dt>Available tenants</dt>
            <dd>{TENANTS.length}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
