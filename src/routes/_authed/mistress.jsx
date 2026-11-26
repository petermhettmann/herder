import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import MessageBubble from "@/components/agent/MessageBubble";

const AGENT = "mistress";

export const Route = createFileRoute("/_authed/mistress")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mistress · Herder" },
      { name: "description", content: "Herder's protocol voice, in the app and on WhatsApp." },
    ],
  }),
  component: MistressPage,
});

function MistressPage() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const listed = await base44.agents.listConversations({ agent_name: AGENT });
      const existing = Array.isArray(listed) ? listed[0] : listed?.items?.[0];
      const created =
        existing ??
        (await base44.agents.createConversation({
          agent_name: AGENT,
          metadata: { name: "Mistress", description: "Protocol voice" },
        }));
      const full = await base44.agents.getConversation(created.id);
      if (cancelled) return;
      setConversation(full);
      setMessages(full?.messages ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      setWhatsappUrl(base44.agents.getWhatsAppConnectURL(AGENT));
    } catch {
      setWhatsappUrl(null);
    }
  }, []);

  useEffect(() => {
    if (!conversation?.id) return undefined;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data?.messages ?? []);
    });
    return () => unsubscribe();
  }, [conversation?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !conversation || sending) return;

    setSending(true);
    setDraft("");
    try {
      await base44.agents.addMessage(conversation, { role: "user", content });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-fade-up flex min-h-[calc(100vh-9rem)] flex-col">
      <header>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Agent</p>
        <h1 className="mt-1.5 font-heading text-[24px] font-medium leading-[1.15] tracking-[-0.02em]">
          Mistress
        </h1>
        <p className="mt-1 text-[11px] text-muted-foreground">Protocol voice. Verdicts, not opinions.</p>
      </header>

      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center justify-between rounded-xl border border-border px-4 py-3 text-[13px] transition-colors hover:bg-secondary"
        >
          <span>Connect WhatsApp</span>
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
        </a>
      )}

      <div className="mt-6 flex-1 space-y-3">
        {messages.length === 0 && (
          <p className="text-[13px] leading-[1.5] text-muted-foreground">
            Nothing said yet. Report your elapsed time and condition.
          </p>
        )}
        {messages.map((message, index) => (
          <MessageBubble key={message?.id ?? index} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="sticky bottom-0 mt-6 flex items-end gap-2 border-t border-border bg-background pt-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) send(event);
          }}
          rows={1}
          placeholder="Report in"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-input bg-transparent px-3.5 py-3 text-[13px] leading-[1.4] outline-none placeholder:text-muted-foreground focus-visible:border-primary/60"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!draft.trim() || sending || !conversation}
          className="h-11 w-11 shrink-0 rounded-xl"
          aria-label="Send"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={1.75} />
        </Button>
      </form>
    </div>
  );
}