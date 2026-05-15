import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md w-full px-6">
        <div className="mb-8">
          <h1 className="text-workspace font-semibold text-foreground tracking-tight">AIBIo</h1>
          <p className="text-body text-muted-foreground mt-1">AInderstanding — AI-native datamart builder</p>
        </div>

        <div className="space-y-2">
          <p className="text-caption text-muted-foreground uppercase tracking-widest">Workspaces</p>
          <div className="rounded-lg border border-border bg-card p-4 text-center text-muted-foreground text-body">
            No workspaces yet.
          </div>
        </div>

        <div className="mt-4">
          <Link
            href="/workspace/demo/connect"
            className="block w-full text-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-body font-medium hover:opacity-90 transition-opacity"
          >
            Create workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
