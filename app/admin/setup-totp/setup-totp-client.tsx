'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SetupTotpClient() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSetup = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/totp/setup', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to enable TOTP');
      setQrCode(payload.qrCode);
      setSecret(payload.secret);
      toast.success('Authenticator setup created');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Unable to enable TOTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleSetup} disabled={isLoading}>
        {isLoading ? 'Generating…' : 'Generate authenticator setup'}
      </Button>
      {qrCode ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Scan this QR code in Google Authenticator</p>
          <img src={qrCode} alt="Authenticator QR code" className="h-48 w-48 rounded-xl border border-slate-200 bg-white p-2" />
          <p className="text-xs text-slate-600 dark:text-slate-300">Secret: {secret}</p>
        </div>
      ) : null}
    </div>
  );
}
