import { notFound } from 'next/navigation';
import { db } from '@/core/db/client';
import { workspaces } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import { listModels } from '@/modules/ainderstanding/model/lib/model-service';
import { ModelPageClient } from './ModelPageClient';

export default async function ModelPage({
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
    <ModelPageClient
      workspaceId={workspaceId}
      initialModels={{ staging, intermediate, marts }}
    />
  );
}
