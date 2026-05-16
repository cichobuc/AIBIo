import { redirect } from 'next/navigation';

export default async function ConnectPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  redirect(`/workspace/${workspaceId}/explore`);
}
