"use client";

import { useRef, useState } from "react";

export interface DisplayMessage {
  role: "user" | "assistant" | "tool_note";
  text: string;
}

export function ChatWindow({
  chatId,
  endpoint,
  initialMessages,
  payloadKey = "chatId",
  variant = "staff",
}: {
  chatId: string;
  endpoint: string;
  initialMessages: DisplayMessage[];
  /** Name of the id field in the POST body ("chatId" for staff, "sessionId" for kiosk). */
  payloadKey?: "chatId" | "sessionId";
  /** "kid" = bigger type, rounder warmer bubbles for the kiosk. */
  variant?: "staff" | "kid";
}) {
  const kid = variant === "kid";
  const userBubble = kid
    ? "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-amber-400 px-4 py-2.5 text-base font-medium text-amber-950"
    : "max-w-[80%] whitespace-pre-wrap rounded-lg bg-teal-700 px-3 py-2 text-sm text-white";
  const botBubble = kid
    ? "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-teal-50 px-4 py-2.5 text-base text-teal-950"
    : "max-w-[80%] whitespace-pre-wrap rounded-lg bg-slate-100 px-3 py-2 text-sm";
  const [messages, setMessages] = useState<DisplayMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function scroll() {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text }]);
    scroll();

    let assistantStarted = false;
    const appendAssistant = (delta: string) => {
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (assistantStarted && last?.role === "assistant") {
          copy[copy.length - 1] = { role: "assistant", text: last.text + delta };
        } else {
          copy.push({ role: "assistant", text: delta });
        }
        return copy;
      });
      assistantStarted = true;
      scroll();
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [payloadKey]: chatId, message: text }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setMessages((m) => [...m, { role: "tool_note", text: `Error: ${err.error ?? res.status}` }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: { type: string; text?: string; name?: string; isError?: boolean; message?: string };
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (event.type === "delta" && event.text) appendAssistant(event.text);
          else if (event.type === "tool_start") {
            assistantStarted = false;
            setMessages((m) => [...m, { role: "tool_note", text: `⚙ ${event.name}…` }]);
            scroll();
          } else if (event.type === "tool_end") {
            setMessages((m) => {
              const copy = [...m];
              for (let i = copy.length - 1; i >= 0; i--) {
                if (copy[i]!.role === "tool_note" && copy[i]!.text.endsWith("…")) {
                  copy[i] = {
                    role: "tool_note",
                    text: `⚙ ${event.name} ${event.isError ? "✗" : "✓"}`,
                  };
                  break;
                }
              }
              return copy;
            });
          } else if (event.type === "error") {
            setMessages((m) => [...m, { role: "tool_note", text: `Error: ${event.message}` }]);
          }
        }
      }
    } catch (err) {
      setMessages((m) => [...m, { role: "tool_note", text: `Error: ${(err as Error).message}` }]);
    } finally {
      setBusy(false);
      scroll();
    }
  }

  return (
    <div
      className={`flex h-[calc(100vh-8rem)] flex-col overflow-hidden border bg-white ${
        kid ? "rounded-3xl border-amber-200 shadow-md" : "rounded-xl border-slate-200 shadow-sm"
      }`}
    >
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className={kid ? "text-base text-slate-400" : "text-sm text-slate-400"}>
            {kid
              ? "Say hello to start! 👋"
              : "Ask about a student, or ask me to analyse an uploaded piece of work."}
          </p>
        ) : null}
        {messages.map((msg, i) =>
          msg.role === "tool_note" ? (
            <div key={i} className="text-xs text-slate-400">
              {msg.text}
            </div>
          ) : (
            <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex"}>
              <div className={msg.role === "user" ? userBubble : botBubble}>{msg.text}</div>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 border-t border-slate-200 p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder={busy ? "Working…" : "Type a message (Enter to send)"}
          disabled={busy}
          className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={() => void send()}
          disabled={busy || !input.trim()}
          className="rounded-md bg-teal-700 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
