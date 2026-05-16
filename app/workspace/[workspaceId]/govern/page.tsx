import { notFound } from 'next/navigation';
import { GovernPageClient } from './GovernPageClient';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function fetchGovernData(workspaceId: string) {
  const res = await fetch(`${BASE}/api/govern/${workspaceId}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json() as Promise<{
    sources: { id: string; name: string }[];
    permissions: unknown[];
    settings: unknown;
    audits: unknown[];
    piiColumns: unknown[];
  }>;
}

export default async function GovernPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const data = await fetchGovernData(workspaceId);

  if (!data) notFound();

  return (
    <GovernPageClient
      workspaceId={workspaceId}
      sources={data.sources}
      permissions={data.permissions as never}
      settings={data.settings as never}
      audits={data.audits as never}
      piiColumns={data.piiColumns as never}
    />
  );
}
