'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Textarea } from '@/core/ui/textarea';
import type { Workspace } from '@/core/types/workspace';

export default function NewWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Workspace name is required.');
      return;
    }
    setError('');
    setLoading(true);
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
    });
    if (!res.ok) {
      setError('Failed to create workspace. Please try again.');
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { workspace: Workspace };
    router.push(`/workspace/${data.workspace.id}/connect`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">New workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a workspace to start building your datamart.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="space-y-1.5">
            <label htmlFor="ws-name" className="text-sm font-medium text-foreground">
              Workspace name <span className="text-destructive">*</span>
            </label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "sales_datamart"'
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ws-desc" className="text-sm font-medium text-foreground">
              Description <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              id="ws-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this datamart for?"
              rows={3}
            />
          </div>

          <div className="flex justify-between pt-2">
            <Link href="/workspaces">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create workspace'}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
