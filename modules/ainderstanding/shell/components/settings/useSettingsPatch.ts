'use client';
import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

type PatchFn = (field: string, value: unknown, endpoint?: string) => void;

export function useSettingsPatch(workspaceId: string, onRevert?: (field: string, prev: unknown) => void): PatchFn {
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const prevValues = useRef<Record<string, unknown>>({});

  return useCallback(
    (field: string, value: unknown, endpoint?: string) => {
      const url = endpoint !== undefined
        ? `/api/workspaces/${workspaceId}${endpoint}`
        : `/api/workspaces/${workspaceId}/settings`;

      if (timers.current[field]) clearTimeout(timers.current[field]);
      timers.current[field] = setTimeout(async () => {
        const prev = prevValues.current[field];
        prevValues.current[field] = value;
        try {
          const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value }),
          });
          if (!res.ok) throw new Error('Server error');
        } catch {
          prevValues.current[field] = prev;
          onRevert?.(field, prev);
          toast.error('Failed to save setting. Try again.');
        }
      }, 400);
    },
    [workspaceId, onRevert],
  );
}
