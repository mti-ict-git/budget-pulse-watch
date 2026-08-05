import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Bot, Download, ExternalLink, FileText, Loader2, Maximize2, MessageCircle, Minimize2, RotateCcw, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ChatMessage, ChatReference, openAuthenticatedFile, sendChatMessage } from '@/services/chatService';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'prf-chat-messages';
const starter: ChatMessage[] = [{
  id: 'welcome', role: 'assistant',
  content: 'Ask me about any PRF, its items, status, totals, or attachment metadata. I can only read data and will never modify a PRF.'
}];

function loadMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return starter;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as ChatMessage[] : starter;
  } catch { return starter; }
}

function isPrfInMarkdownTable(content: string, prfNo: string): boolean {
  return content.split('\n').some((line) => line.includes('|') && new RegExp(`(^|[^0-9A-Za-z])${prfNo}([^0-9A-Za-z]|$)`).test(line));
}

function isPrfMentioned(content: string, prfNo: string): boolean {
  return new RegExp(`(^|[^0-9A-Za-z])${prfNo}([^0-9A-Za-z]|$)`).test(content);
}

function MarkdownMessage({ content, references, onViewPrf }: {
  content: string;
  references: ChatReference[];
  onViewPrf: (prfNo: string) => void;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        h1: ({ children }) => <h1 className="mb-2 mt-3 text-lg font-semibold first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1.5 mt-3 font-semibold first:mt-0">{children}</h3>,
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="pl-0.5">{children}</li>,
        blockquote: ({ children }) => <blockquote className="my-2 border-l-4 border-primary/40 pl-3 text-muted-foreground">{children}</blockquote>,
        table: ({ children }) => (
          <div className="my-3 max-w-full overflow-x-auto rounded-lg border bg-background">
            <table className="w-full min-w-max border-collapse text-left text-xs sm:text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-muted/80">{children}</thead>,
        th: ({ children }) => <th className="border-b border-r px-3 py-2 font-semibold last:border-r-0">{children}</th>,
        td: ({ children }) => {
          const text = Array.isArray(children) ? children.filter((child) => typeof child === 'string' || typeof child === 'number').join('') : String(children ?? '');
          const reference = references.find((item) => item.type === 'prf' && text.trim() === item.prfNo);
          return (
            <td className="border-b border-r px-3 py-2 align-top last:border-r-0">
              {reference ? (
                <Button
                  type="button" variant="link" size="sm" className="h-auto p-0 font-semibold"
                  onClick={() => onViewPrf(reference.prfNo)} title={`View PRF ${reference.prfNo}`}
                >
                  {children}<ExternalLink className="ml-1 h-3.5 w-3.5" />
                </Button>
              ) : children}
            </td>
          );
        },
        tr: ({ children }) => <tr className="last:[&_td]:border-b-0">{children}</tr>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">
            {children}
          </a>
        ),
        code: ({ className, children }) => className ? (
          <code className={cn('block overflow-x-auto rounded-md bg-slate-950 p-3 text-xs text-slate-50', className)}>{children}</code>
        ) : (
          <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">{children}</code>
        ),
        pre: ({ children }) => <pre className="my-2 max-w-full overflow-x-auto">{children}</pre>,
        hr: () => <hr className="my-3 border-border" />
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function PRFChat() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [fullWindow, setFullWindow] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); }, [messages]);
  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open, loading]);

  const reset = () => {
    setMessages(starter);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || loading) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content };
    const next = [...messages, userMessage];
    setMessages(next);
    setDraft('');
    setLoading(true);
    try {
      const response = await sendChatMessage(next);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: 'assistant', content: response!.answer, references: response!.references
      }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PRF Assistant failed to answer';
      toast.error(message);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: `Sorry, I could not answer that request. ${message}` }]);
    } finally { setLoading(false); }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const openFile = async (reference: ChatReference, download: boolean) => {
    const url = download ? reference.downloadUrl : reference.previewUrl;
    if (!url) return;
    try { await openAuthenticatedFile(url, reference.fileName || reference.label, download); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to open attachment'); }
  };

  const viewPrf = (prfNo: string) => {
    navigate(`/prf?search=${encodeURIComponent(prfNo)}`);
    setOpen(false);
  };

  return (
    <>
      <Button
        size="icon" onClick={() => setOpen(true)} aria-label="Open PRF Assistant"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-xl"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          className={cn(
            'flex w-full flex-col p-0',
            fullWindow
              ? 'inset-0 h-dvh w-screen max-w-none border-0 sm:max-w-none'
              : 'sm:max-w-lg'
          )}
        >
          <SheetHeader className="border-b px-5 py-4 pr-12">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-left">
                <span className="rounded-full bg-primary/10 p-2"><Bot className="h-5 w-5 text-primary" /></span>
                <div>
                  <SheetTitle>PRF Assistant</SheetTitle>
                  <SheetDescription>Read-only · all PRFs · session only</SheetDescription>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost" size="icon" onClick={() => setFullWindow((value) => !value)}
                  title={fullWindow ? 'Exit full window' : 'Open full window'}
                  aria-label={fullWindow ? 'Exit full window' : 'Open full window'}
                >
                  {fullWindow ? <Minimize2 /> : <Maximize2 />}
                </Button>
                <Button variant="ghost" size="icon" onClick={reset} title="Clear conversation" aria-label="Clear conversation"><RotateCcw /></Button>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1 px-5 py-4">
            <div className="space-y-4">
              {messages.map((message) => {
                const references = (message.references || []).filter((reference) => reference.type === 'file' || isPrfMentioned(message.content, reference.prfNo));
                const cardReferences = references.filter((reference) => reference.type === 'file' || !isPrfInMarkdownTable(message.content, reference.prfNo));
                return (
                <div key={message.id} className={cn('w-full', message.role === 'user' ? 'ml-auto max-w-3xl pl-10' : 'max-w-5xl pr-6')}>
                  <div className={`rounded-2xl px-4 py-3 text-sm ${message.role === 'user' ? 'whitespace-pre-wrap bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                    {message.role === 'assistant' ? <MarkdownMessage content={message.content} references={references} onViewPrf={viewPrf} /> : message.content}
                  </div>
                  {cardReferences.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {cardReferences.map((reference) => (
                        <div key={`${reference.type}-${reference.id}`} className="rounded-lg border bg-background p-3 text-sm">
                          <div className="flex items-start gap-2">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{reference.label}</p>
                              <p className="text-xs text-muted-foreground">{reference.prfNo}</p>
                            </div>
                          </div>
                          <div className="mt-2 flex gap-2">
                            {reference.type === 'prf' ? (
                              <Button size="sm" variant="outline" onClick={() => viewPrf(reference.prfNo)}>
                                <ExternalLink /> View PRF
                              </Button>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" onClick={() => void openFile(reference, false)}><ExternalLink /> Preview</Button>
                                <Button size="sm" variant="outline" onClick={() => void openFile(reference, true)}><Download /> Download</Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )})}
              {loading && <div className="mr-6 flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> Checking PRF data…</div>}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <form onSubmit={(event) => void submit(event)} className="border-t bg-background p-4">
            <div className="flex items-end gap-2">
              <Textarea
                value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown}
                placeholder="Ask about PRFs or attachments…" maxLength={4000} disabled={loading}
                className="min-h-[44px] max-h-32 resize-none"
              />
              <Button type="submit" size="icon" disabled={!draft.trim() || loading} aria-label="Send message"><Send /></Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Attachment contents are not read. Chat clears when this browser tab closes.</p>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
