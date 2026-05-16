import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { db } from '@/core/db/client';
import { workspaces } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import { listModels } from '@/modules/ainderstanding/model/lib/model-service';
import { ModelExplorer } from '@/modules/ainderstanding/model/components/ModelExplorer';

export default async function ModelSidebarPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  const ws = db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) notFound();

  const staging = listModels(workspaceId, 'staging');
  const intermediate = listModels(workspaceId, 'intermediate');
  const marts = listModels(workspaceId, 'marts');

  return (
    <Suspense>
      <ModelExplorer
        workspaceId={workspaceId}
        initialModels={{ staging, intermediate, marts }}
      />
    </Suspense>
  );
}
