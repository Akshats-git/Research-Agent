"use client";

import { useState, useRef, useEffect, useSyncExternalStore } from "react";
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

function IconBeaker({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M10 3v6.4a1 1 0 01-.2.6L4.5 17a2 2 0 001.7 3h11.6a2 2 0 001.7-3l-5.3-7a1 1 0 01-.2-.6V3" />
      <path d="M8.5 14h7" />
    </svg>
  );
}

function IconOrchestrator({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function IconGlobe({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

function IconFileText({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconSparkles({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
    </svg>
  );
}

function IconDocument({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12h6M9 16h6M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function IconPaperclip({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function IconDownload({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1v9m0 0L5 7m3 3l3-3M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" />
    </svg>
  );
}

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconX({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function IconTrash({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function IconPlus({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconChat({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}

function IconMenu({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h18M3 6h18M3 18h18" />
    </svg>
  );
}

function IconDots({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function IconPin({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6z" />
      <path d="M12 15v5" />
    </svg>
  );
}

function IconPencil({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function IconArchive({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function IconChevron({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

const STAGE_ICONS: Record<string, (props: { className?: string }) => React.ReactElement> = {
  orchestrator: IconOrchestrator,
  web_researcher: IconGlobe,
  document_analyst: IconFileText,
  synthesizer: IconSparkles,
};

/**
 * One chat turn: the user's message plus whatever the assistant produced for
 * it. A turn's `kind` is decided by the backend router — a `research` turn runs
 * the agent pipeline into a `report`, an `answer` turn is a conversational
 * `answer`, and a `revise` turn replaces the `report` with an edited version.
 */
interface Turn {
  id: string;
  query: string;
  kind?: "research" | "answer" | "revise";
  steps: AgentStep[];
  answer: string;
  report: string;
  error: string;
  status: "running" | "done" | "failed";
  createdAt: number;
}

/** A saved chat session — a titled thread of research turns, like a sidebar entry. */
interface Chat {
  id: string;
  title: string;
  turns: Turn[];
  pinned?: boolean;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

interface StoreState {
  chats: Chat[];
  activeChatId: string | null;
}

const STORAGE_KEY = "research-chats";
const TITLE_MAX = 60;

/**
 * Chat history lives in a tiny module-level store rather than component state so
 * it survives reloads (persisted to localStorage) and is read through
 * `useSyncExternalStore` — which renders an empty server snapshot and re-reads
 * the stored value on the client, sidestepping hydration mismatches for this
 * client-only data. Keeping the impure id/timestamp/storage calls out here also
 * keeps the component body pure.
 */
const EMPTY_STATE: StoreState = { chats: [], activeChatId: null };
const listeners = new Set<() => void>();

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStorage(): StoreState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as StoreState;
    const chats = (parsed.chats ?? []).map((chat) => ({
      ...chat,
      // A run that was mid-stream when the page unloaded can't resume — its live
      // connection is gone — so surface it as interrupted rather than "running".
      turns: (chat.turns ?? []).map((t) =>
        t.status === "running"
          ? {
              ...t,
              status: "failed" as const,
              steps: settleSteps(t.steps, "failed"),
              error: t.error || "Interrupted — the page was reloaded mid-research.",
            }
          : t
      ),
    }));
    const activeChatId =
      parsed.activeChatId && chats.some((c) => c.id === parsed.activeChatId)
        ? parsed.activeChatId
        : chats[0]?.id ?? null;
    return { chats, activeChatId };
  } catch {
    return EMPTY_STATE;
  }
}

let store: StoreState = readStorage();

function persist() {
  if (typeof window === "undefined") return;
  try {
    if (store.chats.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota/availability failures are non-fatal for the live session.
  }
}

function setStore(next: StoreState) {
  store = next;
  persist();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => store;
const getServerSnapshot = () => EMPTY_STATE;

/** Create an empty chat and make it active. Returns the new chat's id. */
function createChat(): string {
  const now = Date.now();
  const chat: Chat = { id: uid(), title: "New chat", turns: [], createdAt: now, updatedAt: now };
  setStore({ chats: [chat, ...store.chats], activeChatId: chat.id });
  return chat.id;
}

function selectChat(id: string) {
  if (id === store.activeChatId) return;
  setStore({ ...store, activeChatId: id });
}

function deleteChat(id: string) {
  const chats = store.chats.filter((c) => c.id !== id);
  const activeChatId =
    store.activeChatId === id ? firstOpenChatId(chats) : store.activeChatId;
  setStore({ chats, activeChatId });
}

function renameChat(id: string, title: string) {
  const next = title.trim();
  if (!next) return;
  setStore({
    ...store,
    chats: store.chats.map((c) => (c.id === id ? { ...c, title: next.slice(0, TITLE_MAX) } : c)),
  });
}

function togglePinned(id: string) {
  setStore({
    ...store,
    chats: store.chats.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
  });
}

/** Archive/unarchive; if the active chat is being archived, move focus off it. */
function toggleArchived(id: string) {
  const chats = store.chats.map((c) =>
    c.id === id ? { ...c, archived: !c.archived } : c
  );
  const target = chats.find((c) => c.id === id);
  const activeChatId =
    target?.archived && store.activeChatId === id
      ? firstOpenChatId(chats)
      : store.activeChatId;
  setStore({ chats, activeChatId });
}

/** The most recent non-archived chat, or null — used when focus needs a fallback. */
function firstOpenChatId(chats: Chat[]): string | null {
  const open = chats.filter((c) => !c.archived).sort((a, b) => b.updatedAt - a.updatedAt);
  return open[0]?.id ?? null;
}

function newTurn(query: string): Turn {
  // Steps stay empty until the router says this is a research turn — otherwise
  // an answer or a report edit would render a bogus pipeline.
  return { id: uid(), query, steps: [], answer: "", report: "", error: "", status: "running", createdAt: Date.now() };
}

/** Append a turn to a chat, titling the chat from its first question. */
function addTurn(chatId: string, turn: Turn) {
  setStore({
    ...store,
    chats: store.chats.map((c) =>
      c.id === chatId
        ? {
            ...c,
            title: c.turns.length === 0 ? turn.query.slice(0, TITLE_MAX) : c.title,
            turns: [...c.turns, turn],
            updatedAt: Date.now(),
          }
        : c
    ),
  });
}

function updateTurn(chatId: string, turnId: string, updater: (t: Turn) => Turn) {
  setStore({
    ...store,
    chats: store.chats.map((c) =>
      c.id === chatId
        ? { ...c, turns: c.turns.map((t) => (t.id === turnId ? updater(t) : t)), updatedAt: Date.now() }
        : c
    ),
  });
}

/** The graph's forward-only agent chain for a single run. */
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
                {step.status === "running" && (
                  <span className="text-xs text-muted">running…</span>
                )}
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
 * A rendered report with its own print handler. Kept as a component so each
 * report in the history owns a stable `useReactToPrint` hook — the hook count
 * must not vary as conversations are added.
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

/** A single item in the chat-options dropdown menu. */
function MenuItem({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors cursor-pointer ${
        danger ? "text-red-400 hover:bg-red-500/10" : "text-foreground hover:bg-accent/10"
      }`}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      {label}
    </button>
  );
}

/** The chat-history sidebar: new-chat button, pinned/recent groups, per-chat menu. */
function Sidebar({
  chats,
  activeChatId,
  open,
  onClose,
}: {
  chats: Chat[];
  activeChatId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const byRecent = (a: Chat, b: Chat) => b.updatedAt - a.updatedAt;
  const visible = chats.filter((c) => !c.archived);
  const pinned = visible.filter((c) => c.pinned).sort(byRecent);
  const recents = visible.filter((c) => !c.pinned).sort(byRecent);
  const archived = chats.filter((c) => c.archived).sort(byRecent);

  const openMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (menu?.id === id) {
      setMenu(null);
      return;
    }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const width = 176;
    const height = 210;
    const left = Math.min(r.right - 8, window.innerWidth - width - 8);
    const top = Math.min(r.bottom + 4, window.innerHeight - height - 8);
    setMenu({ id, top, left });
  };

  const startRename = (chat: Chat) => {
    setMenu(null);
    setRenameValue(chat.title);
    setRenamingId(chat.id);
  };

  const commitRename = () => {
    if (renamingId) renameChat(renamingId, renameValue);
    setRenamingId(null);
  };

  const renderChat = (chat: Chat) => {
    const isActive = chat.id === activeChatId;
    const running = chat.turns.some((t) => t.status === "running");
    const isRenaming = renamingId === chat.id;
    const menuOpen = menu?.id === chat.id;

    return (
      <div
        key={chat.id}
        onClick={() => {
          if (isRenaming) return;
          selectChat(chat.id);
          onClose();
        }}
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
          isActive ? "bg-accent/15 text-foreground" : "text-muted hover:bg-card hover:text-foreground"
        }`}
      >
        {running ? (
          <span className="w-3.5 h-3.5 shrink-0 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
        ) : chat.pinned ? (
          <IconPin className="shrink-0 opacity-70" />
        ) : (
          <IconChat className="shrink-0 opacity-70" />
        )}

        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              } else if (e.key === "Escape") {
                setRenamingId(null);
              }
            }}
            onBlur={commitRename}
            className="flex-1 min-w-0 bg-background border border-accent/50 rounded px-1.5 py-0.5 text-sm text-foreground focus:outline-none"
          />
        ) : (
          <span className="flex-1 truncate text-sm">{chat.title || "New chat"}</span>
        )}

        {!isRenaming && (
          <button
            onClick={(e) => openMenu(e, chat.id)}
            aria-label="Chat options"
            className={`shrink-0 p-0.5 rounded hover:bg-background/70 text-muted hover:text-foreground transition-opacity ${
              menuOpen || isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
            }`}
          >
            <IconDots />
          </button>
        )}
      </div>
    );
  };

  const menuChat = menu ? chats.find((c) => c.id === menu.id) : null;

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} aria-hidden />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-card-border bg-card/60 backdrop-blur-sm flex flex-col transform transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="p-3">
          <button
            onClick={() => {
              createChat();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-card-border bg-background text-sm font-medium text-foreground hover:border-accent/50 hover:text-accent-light transition-all cursor-pointer"
          >
            <IconPlus />
            New chat
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          {visible.length === 0 && archived.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted">No chats yet</p>
          )}

          {pinned.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted uppercase tracking-wide">
                Pinned
              </p>
              <div className="space-y-0.5">{pinned.map(renderChat)}</div>
            </>
          )}

          {recents.length > 0 && (
            <>
              <p className="px-3 pt-3 pb-1 text-xs font-medium text-muted uppercase tracking-wide">
                Recents
              </p>
              <div className="space-y-0.5">{recents.map(renderChat)}</div>
            </>
          )}

          {archived.length > 0 && (
            <div className="pt-2 mt-2 border-t border-card-border">
              <button
                onClick={() => setShowArchived((s) => !s)}
                className="w-full flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted uppercase tracking-wide hover:text-foreground transition-colors cursor-pointer"
              >
                <IconChevron className={`transition-transform ${showArchived ? "rotate-90" : ""}`} />
                Archived ({archived.length})
              </button>
              {showArchived && <div className="space-y-0.5 mt-1">{archived.map(renderChat)}</div>}
            </div>
          )}
        </nav>
      </aside>

      {/* Per-chat options menu (fixed so it escapes the sidebar's scroll clip) */}
      {menu && menuChat && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setMenu(null)} aria-hidden />
          <div
            className="fixed z-[60] w-44 rounded-lg border border-card-border bg-card shadow-xl py-1 text-sm animate-fade-in"
            style={{ top: menu.top, left: menu.left }}
          >
            <MenuItem icon={<IconPencil />} label="Rename" onClick={() => startRename(menuChat)} />
            <MenuItem
              icon={<IconPin />}
              label={menuChat.pinned ? "Unpin" : "Pin chat"}
              onClick={() => {
                togglePinned(menuChat.id);
                setMenu(null);
              }}
            />
            <MenuItem
              icon={<IconArchive />}
              label={menuChat.archived ? "Unarchive" : "Archive"}
              onClick={() => {
                toggleArchived(menuChat.id);
                setMenu(null);
              }}
            />
            <div className="my-1 border-t border-card-border" />
            <MenuItem
              icon={<IconTrash />}
              label="Delete"
              danger
              onClick={() => {
                deleteChat(menuChat.id);
                setMenu(null);
              }}
            />
          </div>
        </>
      )}
    </>
  );
}

export default function ResearchApp() {
  const { chats, activeChatId } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;
  const turns = activeChat?.turns ?? [];
  const isResearching = turns.some((t) => t.status === "running");

  // Keep the newest turn in view as the active chat's history grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeChatId, turns.length]);

  const sendMessage = async () => {
    if (!query.trim() || isResearching) return;

    // Snapshot the prior turns as chat context *before* adding the new one, so
    // the backend router can tell a follow-up from a fresh research request.
    const priorTurns = activeChat?.turns ?? [];
    const history = priorTurns.flatMap((t) => {
      const assistant = t.report || t.answer;
      const entries = [{ role: "user", content: t.query }];
      if (assistant) entries.push({ role: "assistant", content: assistant });
      return entries;
    });
    const currentReport =
      [...priorTurns].reverse().find((t) => t.report)?.report ?? "";

    // Route the turn into the current chat, opening a fresh one if none is active.
    const chatId = activeChatId ?? createChat();
    const turn = newTurn(query.trim());
    const turnId = turn.id;
    const q = turn.query;
    const submittedFiles = files;

    addTurn(chatId, turn);
    setQuery("");
    setFiles(null);

    const formData = new FormData();
    formData.append("message", q);
    formData.append("history", JSON.stringify(history));
    formData.append("current_report", currentReport);
    if (submittedFiles) {
      Array.from(submittedFiles).forEach((f) => formData.append("files", f));
    }

    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) throw new Error("No response stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ") && eventType) {
            const data = JSON.parse(line.slice(6));
            handleEvent(chatId, turnId, eventType, data);
            eventType = "";
          }
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "An error occurred";
      updateTurn(chatId, turnId, (t) => ({
        ...t,
        error: message,
        status: "failed",
        steps: settleSteps(t.steps, "failed"),
      }));
    }
  };

  const handleEvent = (
    chatId: string,
    turnId: string,
    type: string,
    data: Record<string, unknown>
  ) => {
    if (type === "intent") {
      const action = data.action as Turn["kind"];
      updateTurn(chatId, turnId, (t) => ({
        ...t,
        kind: action,
        // A research turn shows the live pipeline; seed it so the orchestrator
        // node appears immediately, before the first agent_update arrives.
        steps: action === "research" ? initialSteps() : t.steps,
      }));
    } else if (type === "agent_update") {
      updateTurn(chatId, turnId, (t) => ({
        ...t,
        steps: applyAgentUpdate(t.steps, data),
        report:
          data.agent === "synthesizer" && data.report
            ? (data.report as string)
            : t.report,
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
      updateTurn(chatId, turnId, (t) => ({
        ...t,
        status: "done",
        steps: settleSteps(t.steps, "done"),
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isEmpty = turns.length === 0;

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

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Empty state */}
            {isEmpty && !isResearching && (
            <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 text-accent">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3h6M10 3v6.4a1 1 0 01-.2.6L4.5 17a2 2 0 001.7 3h11.6a2 2 0 001.7-3l-5.3-7a1 1 0 01-.2-.6V3" />
                  <path d="M8.5 14h7" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">
                What would you like to research?
              </h2>
              <p className="text-muted text-center max-w-md">
                Ask any research question. Multiple AI agents will collaborate to search the web,
                analyze documents, and synthesize a comprehensive report.
              </p>

              <div className="flex gap-2 mt-8 flex-wrap justify-center">
                {[
                  "Latest advances in quantum computing",
                  "Impact of AI on healthcare",
                  "Sustainable energy solutions for 2025",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setQuery(suggestion)}
                    className="px-4 py-2 rounded-full border border-card-border bg-card text-sm text-muted hover:text-foreground hover:border-accent/50 transition-all cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active chat — each turn stacked like a chat exchange */}
          {turns.map((turn) => {
            const waiting =
              turn.status === "running" &&
              turn.steps.length === 0 &&
              !turn.answer &&
              !turn.report;

            return (
              <div key={turn.id} className="mb-10 animate-fade-in">
                {/* The user's message */}
                <div className="flex justify-end mb-6">
                  <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-accent text-white text-sm whitespace-pre-wrap break-words">
                    {turn.query}
                  </div>
                </div>

                {/* Thinking placeholder until the router decides what this turn is */}
                {waiting && (
                  <div className="flex items-center gap-2 text-sm text-muted mb-6">
                    <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    {turn.kind === "revise"
                      ? "Updating the report…"
                      : turn.kind === "answer"
                      ? "Thinking…"
                      : "Working…"}
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
                  <ReportCard
                    report={turn.report}
                    createdAt={turn.createdAt}
                    revised={turn.kind === "revise"}
                  />
                )}
              </div>
            );
          })}

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
                disabled={isResearching}
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
                disabled={isResearching}
              />
            </label>
            <button
              onClick={sendMessage}
              disabled={!query.trim() || isResearching}
              className="px-6 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent-light transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            >
              {isResearching ? (
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
