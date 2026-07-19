"use client";

import { useState, useRef, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  AgentStep,
  initialSteps,
  STAGE_META,
  applyAgentUpdate,
  describeStep,
  settleSteps,
} from "./pipeline";
import {
  Turn,
  useChatStore,
  createChat,
  newTurn,
  addTurn,
  updateTurn,
} from "./store";
import { Sidebar } from "./Sidebar";
import {
  STAGE_ICONS,
  IconBeaker,
  IconMenu,
  IconDocument,
  IconDownload,
  IconPaperclip,
  IconCheck,
  IconX,
  IconOrchestrator,
} from "./icons";

const API_URL = "http://localhost:8000/api/chat";

const SUGGESTIONS = [
  "Latest advances in quantum computing",
  "Impact of AI on healthcare",
  "Sustainable energy solutions for 2025",
];

/** The forward-only chain of agents for a single research run. */
function Pipeline({ steps }: { steps: AgentStep[] }) {
  return (
    <ol className="mb-6">
      {steps.map((step, i) => {
        const Icon = STAGE_ICONS[step.agent] ?? IconOrchestrator;
        const meta = STAGE_META[step.agent];
        const isLast = i === steps.length - 1;

        return (
          <li key={i} className="relative flex gap-4 pb-5 last:pb-0 animate-fade-in">
            {/* Connector down to the next agent */}
            {!isLast && (
              <div
                className={`absolute left-5 top-11 bottom-1 w-0.5 rounded-full transition-colors duration-500 ${
                  step.status === "done"
                    ? "bg-success/40"
                    : step.status === "failed"
                    ? "bg-red-500/40"
                    : "bg-accent/30 pipeline-pulse"
                }`}
              />
            )}

            {/* Agent node */}
            <div className="relative shrink-0">
              {step.status === "running" && (
                <div className="absolute -inset-1.5 rounded-full border-2 border-transparent border-t-accent animate-spin" />
              )}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  step.status === "done"
                    ? "bg-success/15 text-success ring-2 ring-success/30"
                    : step.status === "failed"
                    ? "bg-red-500/15 text-red-400 ring-2 ring-red-500/30"
                    : "bg-accent/15 text-accent ring-2 ring-accent/30"
                }`}
              >
                <Icon />
              </div>
              {step.status !== "running" && (
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-background ${
                    step.status === "done" ? "bg-success text-background" : "bg-red-500 text-white"
                  }`}
                >
                  {step.status === "done" ? (
                    <IconCheck className="w-2.5 h-2.5" />
                  ) : (
                    <IconX className="w-2.5 h-2.5" />
                  )}
                </div>
              )}
            </div>

            {/* Detail */}
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center gap-2">
                <span
                  className={`font-medium text-sm ${
                    step.status === "done"
                      ? "text-success"
                      : step.status === "failed"
                      ? "text-red-400"
                      : "text-accent-light"
                  }`}
                >
                  {meta?.label ?? step.agent}
                </span>
                {step.status === "running" && <span className="text-xs text-muted">running…</span>}
              </div>
              <p className="text-sm text-muted mt-0.5">{describeStep(step)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A rendered report with its own print handler. It's a component so each report
 * in the history owns a stable `useReactToPrint` hook — the hook count must not
 * change as turns are added.
 */
function ReportCard({
  report,
  createdAt,
  revised = false,
}: {
  report: string;
  createdAt: number;
  revised?: boolean;
}) {
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `research-report-${new Date(createdAt).toISOString().slice(0, 10)}`,
    pageStyle: `
      @page { size: A4; margin: 15mm 20mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        * { color: #000000 !important; background: #ffffff !important; }
        a { color: #2563eb !important; }
        blockquote { border-left: 3px solid #4f46e5 !important; padding-left: 12px !important; color: #333333 !important; }
        hr { border-color: #d4d4d8 !important; }
        p, li, h1, h2, h3, h4, blockquote { break-inside: avoid; }
      }
    `,
  });

  return (
    <div className="animate-fade-in">
      <div className="rounded-xl border border-card-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-card-border bg-accent/5 flex items-center gap-2">
          <IconDocument className="text-accent" />
          <h2 className="text-lg font-semibold text-foreground">
            {revised ? "Updated Report" : "Research Report"}
          </h2>
          <button
            onClick={() => handlePrint()}
            className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded-lg border border-card-border bg-background text-sm text-muted hover:text-foreground hover:border-accent/50 transition-all cursor-pointer"
          >
            <IconDownload />
            Download PDF
          </button>
        </div>
        <div ref={reportRef} className="px-6 py-6 report-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

/** Empty state shown when the active chat has no turns yet. */
function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 text-accent">
        <IconBeaker className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-semibold text-foreground mb-2">What would you like to research?</h2>
      <p className="text-muted text-center max-w-md">
        Ask any research question. Multiple AI agents will collaborate to search the web, analyze
        documents, and synthesize a comprehensive report — then answer follow-ups and refine it.
      </p>
      <div className="flex gap-2 mt-8 flex-wrap justify-center">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="px-4 py-2 rounded-full border border-card-border bg-card text-sm text-muted hover:text-foreground hover:border-accent/50 transition-all cursor-pointer"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One rendered chat turn: the user's message plus the assistant's output. */
function TurnView({ turn }: { turn: Turn }) {
  const waiting =
    turn.status === "running" && turn.steps.length === 0 && !turn.answer && !turn.report;

  const waitingLabel =
    turn.kind === "revise" ? "Updating the report…" : turn.kind === "answer" ? "Thinking…" : "Working…";

  return (
    <div className="mb-10 animate-fade-in">
      {/* The user's message */}
      <div className="flex justify-end mb-6">
        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-accent text-white text-sm whitespace-pre-wrap break-words">
          {turn.query}
        </div>
      </div>

      {/* Placeholder shown until the router decides what this turn is */}
      {waiting && (
        <div className="flex items-center gap-2 text-sm text-muted mb-6">
          <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          {waitingLabel}
        </div>
      )}

      {turn.steps.length > 0 && <Pipeline steps={turn.steps} />}

      {turn.answer && (
        <div className="mb-2 max-w-[90%] rounded-2xl rounded-bl-md border border-card-border bg-card px-4 py-3 report-content text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.answer}</ReactMarkdown>
        </div>
      )}

      {turn.error && (
        <div className="mb-6 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {turn.error}
        </div>
      )}

      {turn.report && (
        <ReportCard report={turn.report} createdAt={turn.createdAt} revised={turn.kind === "revise"} />
      )}
    </div>
  );
}

export default function ResearchApp() {
  const { chats, activeChatId } = useChatStore();
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;
  const turns = activeChat?.turns ?? [];
  const isBusy = turns.some((t) => t.status === "running");

  // Keep the newest turn in view as the active chat's history grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeChatId, turns.length]);

  // Fold one SSE event into the turn it belongs to.
  const applyEvent = (chatId: string, turnId: string, type: string, data: Record<string, unknown>) => {
    if (type === "intent") {
      const action = data.action as Turn["kind"];
      updateTurn(chatId, turnId, (t) => ({
        ...t,
        kind: action,
        // Seed the pipeline so the orchestrator node shows immediately, before
        // the first agent_update arrives. Non-research turns stay pipeline-free.
        steps: action === "research" ? initialSteps() : t.steps,
      }));
    } else if (type === "agent_update") {
      updateTurn(chatId, turnId, (t) => ({
        ...t,
        steps: applyAgentUpdate(t.steps, data),
        report: data.agent === "synthesizer" && data.report ? (data.report as string) : t.report,
      }));
    } else if (type === "message") {
      updateTurn(chatId, turnId, (t) => ({ ...t, answer: data.content as string }));
    } else if (type === "report") {
      updateTurn(chatId, turnId, (t) => ({ ...t, report: data.report as string }));
    } else if (type === "error") {
      updateTurn(chatId, turnId, (t) => ({
        ...t,
        error: data.message as string,
        status: "failed",
        steps: settleSteps(t.steps, "failed"),
      }));
    } else if (type === "complete") {
      updateTurn(chatId, turnId, (t) => ({ ...t, status: "done", steps: settleSteps(t.steps, "done") }));
    }
  };

  const sendMessage = async () => {
    if (!query.trim() || isBusy) return;

    // Snapshot the prior turns as chat context *before* adding the new one, so
    // the backend router can tell a follow-up from a fresh research request.
    const priorTurns = activeChat?.turns ?? [];
    const history = priorTurns.flatMap((t) => {
      const assistant = t.report || t.answer;
      const entries = [{ role: "user", content: t.query }];
      if (assistant) entries.push({ role: "assistant", content: assistant });
      return entries;
    });
    const currentReport = [...priorTurns].reverse().find((t) => t.report)?.report ?? "";

    // Route the turn into the current chat, opening a fresh one if none is active.
    const chatId = activeChatId ?? createChat();
    const turn = newTurn(query.trim());
    const submittedFiles = files;

    addTurn(chatId, turn);
    setQuery("");
    setFiles(null);

    const form = new FormData();
    form.append("message", turn.query);
    form.append("history", JSON.stringify(history));
    form.append("current_report", currentReport);
    if (submittedFiles) {
      Array.from(submittedFiles).forEach((f) => form.append("files", f));
    }

    try {
      const response = await fetch(API_URL, { method: "POST", body: form });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      // Minimal SSE reader: accumulate the byte stream and dispatch each
      // "event:/data:" frame once a full line is available.
      const decoder = new TextDecoder();
      let buffer = "";
      let eventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ") && eventType) {
            applyEvent(chatId, turn.id, eventType, JSON.parse(line.slice(6)));
            eventType = "";
          }
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "An error occurred";
      updateTurn(chatId, turn.id, (t) => ({
        ...t,
        error: message,
        status: "failed",
        steps: settleSteps(t.steps, "failed"),
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="border-b border-card-border bg-card/50 backdrop-blur-sm px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden -ml-1 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card transition-colors cursor-pointer"
              aria-label="Open chat history"
            >
              <IconMenu />
            </button>
            <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
              <IconBeaker />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Research Assistant</h1>
              <p className="text-xs text-muted">Multi-agent AI research powered by LangGraph</p>
            </div>
          </div>
        </header>

        {/* Conversation */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {turns.length === 0 && !isBusy ? (
              <EmptyState onPick={setQuery} />
            ) : (
              turns.map((turn) => <TurnView key={turn.id} turn={turn} />)
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-card-border bg-card/80 backdrop-blur-sm px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question, request a report, or refine it…"
                  rows={1}
                  disabled={isBusy}
                  className="w-full px-4 py-3 rounded-xl border border-card-border bg-background text-foreground placeholder-muted resize-none focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all disabled:opacity-50"
                />
              </div>
              <label className="flex items-center gap-2 px-4 py-3 rounded-xl border border-card-border bg-background text-muted hover:text-foreground hover:border-accent/50 transition-all cursor-pointer text-sm shrink-0">
                <IconPaperclip />
                <span className="hidden sm:inline">{files ? `${files.length} file(s)` : "Files"}</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md,.csv"
                  onChange={(e) => setFiles(e.target.files)}
                  className="hidden"
                  disabled={isBusy}
                />
              </label>
              <button
                onClick={sendMessage}
                disabled={!query.trim() || isBusy}
                className="px-6 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent-light transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
              >
                {isBusy ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Working
                  </span>
                ) : (
                  "Send"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
