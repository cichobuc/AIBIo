import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getExploreData } from '@/modules/ainderstanding/explore/lib/explore-data';
import { ExploreSidebar } from '@/modules/ainderstanding/explore/components/ExploreSidebar';
import { db } from '@/core/db/client';
import { workspaces } from '@/core/db/schema';
import { eq } from 'drizzle-orm';

export default async function ExploreSidebarPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  const ws = db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) notFound();

  const data = getExploreData(workspaceId);

  return (
    <Suspense>
      <ExploreSidebar
        sources={data.sources}
        snapshots={data.snapshots.map((s) => ({
          dataSourceId: s.dataSourceId,
          snapshotJson: s.snapshotJson,
        }))}
        tables={data.tables.map((t) => ({
          dataSourceId: t.dataSourceId,
          tableName: t.tableName,
          rowCount: t.rowCount,
          isReferenceTable: t.isReferenceTable,
        }))}
      />
    </Suspense>
  );
}
