import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select as AppSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/authService';

export function PRFUploadMethodSettings({ value, onChange, disabled }: { value: 'llm'|'local'; onChange: (value: 'llm'|'local') => void; disabled?: boolean }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState('');
  const check = async () => {
    setChecking(true); setResult('');
    try {
      const response = await fetch('/api/settings/ocr/test', { method: 'POST', headers: authService.getAuthHeaders(), body: JSON.stringify({ uploadMethod: 'local' }) });
      const result = await response.json();
      const message = result.message || 'The local parser check failed.';
      setResult(message);
    } catch { setResult('Unable to reach the server. Check connectivity and retry.'); }
    finally { setChecking(false); }
  };
  return <div className="space-y-3">
    <div className="space-y-2"><Label htmlFor="upload-method">New PRF upload method</Label>
      <AppSelect value={value} onValueChange={v => { onChange(v === 'local' ? 'local' : 'llm'); setResult(''); }} disabled={disabled}>
        <SelectTrigger id="upload-method"><SelectValue /></SelectTrigger><SelectContent className="w-[var(--radix-select-trigger-width)]">
          <SelectItem value="llm">LLM — configured AI provider</SelectItem><SelectItem value="local">Local PDF parser v2 (optional)</SelectItem>
        </SelectContent>
      </AppSelect>
      <p className="text-sm text-muted-foreground">LLM sends the document to the selected provider, including OpenAI. Local processes PDFs on this server without a cloud fallback. This choice does not change rescan.</p>
    </div>
    {value === 'local' && <Alert><AlertDescription><p>Local processing requires Python, Poppler and Tesseract. PDF only; inferred fields and source notes stay highlighted for review.</p>
      <Button variant="outline" className="mt-3 min-w-44" disabled={checking || disabled} onClick={check}>{checking ? 'Checking…' : 'Check local parser'}</Button>
      <p className="mt-2 min-h-5 text-sm" role="status" aria-live="polite">{result}</p>
    </AlertDescription></Alert>}
  </div>;
}
