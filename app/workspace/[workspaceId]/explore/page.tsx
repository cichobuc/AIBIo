import { notFound } from 'next/navigation';
import { ExplorePageClient } from './ExplorePageClient';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function fetchExploreData(workspaceId: string) {
  const res = await fetch(`${BASE}/api/explore/${workspaceId}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json() as Promise<{
    sources: { id: string; name: string }[];
    snapshots: unknown[];
    tables: unknown[];
    columns: unknown[];
    recentChanges: unknown[];
  }>;
}

export default async function ExplorePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const data = await fetchExploreData(workspaceId);

  if (!data) notFound();

  return (
    <ExplorePageClient
      workspaceId={workspaceId}
      sources={data.sources}
      snapshots={data.snapshots as never}
      tables={data.tables as never}
      columns={data.columns as never}
      recentChanges={data.recentChanges as never}
    />
  );
}
