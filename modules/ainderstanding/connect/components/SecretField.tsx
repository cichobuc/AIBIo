'use client';

import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/core/ui/input';
import { Button } from '@/core/ui/button';

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export function SecretField({ value, onChange, placeholder }: Props) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleShow = () => {
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 3000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="relative flex items-center">
      <Input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Password'}
        className="pr-24"
        autoComplete="new-password"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-1 h-7 px-2 text-xs text-muted-foreground"
        onClick={handleShow}
        disabled={visible}
        aria-label={visible ? 'Password visible' : 'Show password for 3 seconds'}
      >
        {visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        <span className="ml-1">{visible ? 'Hide' : 'Show (3s)'}</span>
      </Button>
    </div>
  );
}
