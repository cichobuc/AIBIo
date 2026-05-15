import Link from 'next/link';
import { PlusCircle, Database } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/core/ui/card';
import type { Workspace } from '@/core/types/workspace';

async function fetchWorkspaces(): Promise<Workspace[]> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const res = await fetch(`${base}/api/workspaces`, { cache: 'no-store' });
  if (!res.ok) return [];
  const data = (await res.json()) as { workspaces: Workspace[] };
  return data.workspaces;
}

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="overflow-hidden text-ellipsis whitespace-nowrap text-base">
              {workspace.name}
            </CardTitle>
            {workspace.description && (
              <CardDescription className="mt-1 line-clamp-2">
                {workspace.description}
              </CardDescription>
            )}
          </div>
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {new Date(workspace.updatedAt).toLocaleDateString()}
          </span>
          <Link
            href={`/workspace/${workspace.id}/connect`}
            className="text-xs text-primary hover:underline"
          >
            Open
          </Link>
        </div>
      </CardHeader>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Database className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Build your first datamart</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Connect your database, let AI understand it, export to dbt.
      </p>
      <Link href="/workspaces/new">
        <Button className="mt-6">Create workspace</Button>
      </Link>
    </div>
  );
}

export default async function WorkspacesPage() {
  const workspaces = await fetchWorkspaces();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              AInderstanding
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Your workspaces</p>
          </div>
          <Link href="/workspaces/new">
            <Button>
              <PlusCircle className="h-4 w-4" />
              New workspace
            </Button>
          </Link>
        </div>

        {workspaces.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <WorkspaceCard key={ws.id} workspace={ws} />
            ))}
            <Link href="/workspaces/new" className="group">
              <div className="flex h-full min-h-[120px] items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors group-hover:border-primary group-hover:text-primary">
                <div className="flex flex-col items-center gap-1 text-sm font-medium">
                  <PlusCircle className="h-5 w-5" />
                  New workspace
                </div>
              </div>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
