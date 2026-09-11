"use client";

import { useRef, useState } from "react";
import Markdown from "react-markdown";

/** Assistant replies are markdown (the models bold/list liberally) — render
 *  them properly instead of showing raw ** and #. User text stays plain. */
function AssistantMarkdown({ text }: { text: string }) {
  return (
    <Markdown
      components={{
        p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="my-1 list-disc space-y-0.5 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="my-1 list-decimal space-y-0.5 pl-5">{children}</ol>,
        li: ({ children }) => <li className="[&>p]:my-0">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        h1: ({ children }) => <p className="mb-1 mt-2 font-bold first:mt-0">{children}</p>,
        h2: ({ children }) => <p className="mb-1 mt-2 font-bold first:mt-0">{children}</p>,
        h3: ({ children }) => <p className="mb-1 mt-2 font-semibold first:mt-0">{children}</p>,
        h4: ({ children }) => <p className="mb-1 mt-2 font-semibold first:mt-0">{children}</p>,
        code: ({ children }) => (
          <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.9em]">{children}</code>
        ),
        pre: ({ children }) => (
          <pre className="my-1 overflow-x-auto rounded-md bg-black/10 p-2 text-[0.9em]">{children}</pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-1 border-l-2 border-current/30 pl-2 opacity-90">{children}</blockquote>
        ),
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="underline">
            {children}
          </a>
        ),
        hr: () => <hr className="my-2 border-current/20" />,
        table: ({ children }) => (
          <div className="my-1 overflow-x-auto">
            <table className="border-collapse text-[0.95em]">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border border-current/20 px-2 py-1 text-left">{children}</th>,
        td: ({ children }) => <td className="border border-current/20 px-2 py-1">{children}</td>,
      }}
    >
      {text}
    </Markdown>
  );
}

export interface TurnUsage {
  model: string;
  apiCalls?: number;
  toolsUsed?: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export interface DisplayMessage {
  role: "user" | "assistant" | "tool_note" | "usage";
  text: string;
  usage?: TurnUsage;
}

const fmt = new Intl.NumberFormat("en-US");

/** Per-turn usage bar: model · calls · tools · tokens · cost, expandable. */
function UsageBar({ usage }: { usage: TurnUsage }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-500 hover:border-slate-300"
        title="Turn usage — click for the breakdown"
      >
        <span className="font-medium text-slate-600">{usage.model}</span>
        {usage.apiCalls != null ? <span>· {usage.apiCalls} API call{usage.apiCalls === 1 ? "" : "s"}</span> : null}
        {usage.toolsUsed != null ? <span>· {usage.toolsUsed} tool{usage.toolsUsed === 1 ? "" : "s"} used</span> : null}
        <span>· ~{fmt.format(usage.totalTokens)} tokens</span>
        <span className="text-teal-700">· ~${usage.totalCost.toFixed(4)}</span>
        <span className="text-slate-400">{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <div className="mt-1 flex gap-4 border-l-2 border-slate-200 pl-3 text-slate-400">
          <span>Input: ~{fmt.format(usage.promptTokens)} tokens</span>
          <span>Output: ~{fmt.format(usage.completionTokens)} tokens</span>
          <span>Input cost: ${usage.inputCost.toFixed(4)}</span>
          <span>Output cost: ${usage.outputCost.toFixed(4)}</span>
        </div>
      ) : null}
    </div>
  );
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
  // No pre-wrap here — assistant text renders as markdown, which handles
  // its own paragraph breaks (pre-wrap would double every blank line).
  const botBubble = kid
    ? "max-w-[80%] rounded-2xl rounded-bl-md bg-teal-50 px-4 py-2.5 text-base text-teal-950"
    : "max-w-[80%] rounded-lg bg-slate-100 px-3 py-2 text-sm";
  const [messages, setMessages] = useState<DisplayMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Server ended the session mid-conversation (Home Mode time limit).
  const [ended, setEnded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function scroll() {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  async function send() {
    const text = input.trim();
    if (!text || busy || ended) return;
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
          let event: {
            type: string;
            text?: string;
            name?: string;
            isError?: boolean;
            message?: string;
          } & Partial<TurnUsage>;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (event.type === "delta" && event.text) appendAssistant(event.text);
          else if (event.type === "usage" && event.model) {
            const usage: TurnUsage = {
              model: event.model,
              apiCalls: event.apiCalls,
              toolsUsed: event.toolsUsed,
              promptTokens: event.promptTokens ?? 0,
              completionTokens: event.completionTokens ?? 0,
              totalTokens: event.totalTokens ?? 0,
              inputCost: event.inputCost ?? 0,
              outputCost: event.outputCost ?? 0,
              totalCost: event.totalCost ?? 0,
            };
            setMessages((m) => [...m, { role: "usage", text: "", usage }]);
            scroll();
          }
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
          } else if (event.type === "session_ended") {
            setEnded(true);
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
          msg.role === "usage" && msg.usage ? (
            <UsageBar key={i} usage={msg.usage} />
          ) : msg.role === "tool_note" ? (
            <div key={i} className="text-xs text-slate-400">
              {msg.text}
            </div>
          ) : (
            <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex"}>
              <div className={msg.role === "user" ? userBubble : botBubble}>
                {msg.role === "user" ? msg.text : <AssistantMarkdown text={msg.text} />}
              </div>
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
          placeholder={ended ? "This chat has ended 👋" : busy ? "Working…" : "Type a message (Enter to send)"}
          disabled={busy || ended}
          className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={() => void send()}
          disabled={busy || ended || !input.trim()}
          className="rounded-md bg-teal-700 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
