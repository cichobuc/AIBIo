import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { db } from '@/core/db/client';
import { workspaces } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import { getExploreData } from '@/modules/ainderstanding/explore/lib/explore-data';
import { getOpenSessions } from '@/modules/ainderstanding/explore/lib/query-sessions';
import { ExplorePageClient } from './ExplorePageClient';

export default async function ExplorePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  const ws = db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) notFound();

  const data = getExploreData(workspaceId);
  const openSessions = getOpenSessions(workspaceId);

  return (
    <Suspense>
      <ExplorePageClient
        workspaceId={workspaceId}
        sources={data.sources}
        tables={data.tables}
        columns={data.columns}
        recentChanges={data.recentChanges}
        sourcePerms={data.sourcePerms}
        tablePerms={data.tablePerms}
        columnPerms={data.columnPerms}
        openSessions={openSessions}
      />
    </Suspense>
  );
}
