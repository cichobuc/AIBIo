import { notFound } from 'next/navigation';
import { ConnectPageClient } from './ConnectPageClient';
import type { Workspace, DataSource } from '@/core/types/workspace';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function fetchWorkspace(workspaceId: string): Promise<Workspace | null> {
  const res = await fetch(`${BASE}/api/workspaces/${workspaceId}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const data = (await res.json()) as { workspace: Workspace };
  return data.workspace;
}

async function fetchSources(workspaceId: string): Promise<DataSource[]> {
  const res = await fetch(`${BASE}/api/data-sources/${workspaceId}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const data = (await res.json()) as { sources: DataSource[] };
  return data.sources;
}

export default async function ConnectPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const [workspace, sources] = await Promise.all([
    fetchWorkspace(workspaceId),
    fetchSources(workspaceId),
  ]);

  if (!workspace) notFound();

  return <ConnectPageClient workspace={workspace} initialSources={sources} />;
}
