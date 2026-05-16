import { WorkspaceLayout } from '@/modules/ainderstanding/shell/components/WorkspaceLayout';

export default async function WorkspaceRouteLayout({
  children,
  sidebar,
  params,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <WorkspaceLayout workspaceId={workspaceId} sidebar={sidebar}>
      {children}
    </WorkspaceLayout>
  );
}
