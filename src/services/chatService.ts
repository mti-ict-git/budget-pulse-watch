import { authService } from './authService';

export interface ChatReference {
  type: 'prf' | 'file';
  id: number;
  label: string;
  prfId: number;
  prfNo: string;
  mimeType?: string;
  fileName?: string;
  previewUrl?: string;
  downloadUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  references?: ChatReference[];
}

interface ChatResponse {
  success: boolean;
  message?: string;
  data?: {
    answer: string;
    references: ChatReference[];
    model: string;
  };
}

export async function sendChatMessage(messages: ChatMessage[]): Promise<ChatResponse['data']> {
  const token = authService.getToken();
  const response = await fetch('/api/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: messages.slice(-20).map(({ role, content }) => ({ role, content })) })
  });
  const payload = await response.json() as ChatResponse;
  if (!response.ok || !payload.success || !payload.data) throw new Error(payload.message || 'Failed to contact PRF Assistant');
  return payload.data;
}

export async function openAuthenticatedFile(url: string, fileName: string, download: boolean): Promise<void> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${authService.getToken()}` } });
  if (!response.ok) throw new Error('The attachment could not be opened');
  const objectUrl = URL.createObjectURL(await response.blob());
  if (download) {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } else {
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}
