import { redirect } from 'next/navigation';

export default async function ConnectNewPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  redirect(`/workspace/${workspaceId}/connect`);
}
