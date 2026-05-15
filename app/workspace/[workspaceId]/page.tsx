import { redirect } from 'next/navigation';

export default function WorkspacePage({ params }: { params: { workspaceId: string } }) {
  redirect(`/workspace/${params.workspaceId}/connect`);
}
