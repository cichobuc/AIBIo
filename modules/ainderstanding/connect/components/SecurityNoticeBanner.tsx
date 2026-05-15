'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { Button } from '@/core/ui/button';

const STORAGE_KEY = 'aibio_sec_notice_dismissed';

export function SecurityNoticeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="flex items-start gap-3 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
      <p className="flex-1">
        Credentials are encrypted with AES-256-GCM and never stored in plaintext.
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-200"
        onClick={dismiss}
        aria-label="Dismiss security notice"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
