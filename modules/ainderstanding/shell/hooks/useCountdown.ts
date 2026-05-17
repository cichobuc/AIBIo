'use client';

import { useState, useEffect } from 'react';

export function useCountdown(timeoutAt: string | undefined): { display: string; remaining: number } {
  const [remaining, setRemaining] = useState(300);

  useEffect(() => {
    if (!timeoutAt) return;
    const update = () => {
      const secs = Math.max(0, Math.round((new Date(timeoutAt).getTime() - Date.now()) / 1000));
      setRemaining(secs);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [timeoutAt]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return { display: `${mins}:${secs.toString().padStart(2, '0')}`, remaining };
}
