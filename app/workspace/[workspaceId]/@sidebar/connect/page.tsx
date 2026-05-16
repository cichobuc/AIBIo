import { notFound } from 'next/navigation';
import { db } from '@/core/db/client';
import { schemaSnapshots } from '@/core/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { getWorkspace } from '@/modules/ainderstanding/connect/lib/workspace-service';
import { listSources } from '@/modules/ainderstanding/connect/lib/data-source-service';
import { SourcesSidebar } from '@/modules/ainderstanding/connect/components/SourcesSidebar';

export default async function ConnectSidebarPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  let workspace;
  try {
    workspace = getWorkspace(workspaceId);
  } catch {
    notFound();
  }

  const sources = listSources(workspaceId);
  const counts: Record<string, number> = {};

  if (sources.length > 0) {
    const sourceIds = sources.map((s) => s.id);
    const rows = db
      .select({
        dataSourceId: schemaSnapshots.dataSourceId,
        tableCount: schemaSnapshots.tableCount,
      })
      .from(schemaSnapshots)
      .where(inArray(schemaSnapshots.dataSourceId, sourceIds))
      .orderBy(desc(schemaSnapshots.takenAt))
      .all();

    for (const row of rows) {
      if (!(row.dataSourceId in counts)) {
        counts[row.dataSourceId] = row.tableCount;
      }
    }
  }

  return (
    <SourcesSidebar
      workspaceId={workspaceId}
      workspace={workspace}
      sources={sources}
      counts={counts}
    />
  );
}
