import { WorkspaceLayout } from '@/modules/ainderstanding/shell/components/WorkspaceLayout';

export default async function WorkspaceRouteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <WorkspaceLayout workspaceId={workspaceId}>{children}</WorkspaceLayout>;
}
