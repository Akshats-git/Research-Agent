"use client";

import { useState, useRef } from "react";
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

const STAGE_ICONS: Record<string, (props: { className?: string }) => React.ReactElement> = {
  orchestrator: IconOrchestrator,
  web_researcher: IconGlobe,
  document_analyst: IconFileText,
  synthesizer: IconSparkles,
};

export default function ResearchApp() {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [report, setReport] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [error, setError] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  const settle = (status: "done" | "failed") =>
    setSteps((prev) => settleSteps(prev, status));

  const startResearch = async () => {
    if (!query.trim() || isResearching) return;

    setIsResearching(true);
    setSteps(initialSteps());
    setReport("");
    setError("");

    const formData = new FormData();
    formData.append("query", query.trim());
    if (files) {
      Array.from(files).forEach((f) => formData.append("files", f));
    }

    try {
      const response = await fetch("http://localhost:8000/api/research", {
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
            handleEvent(eventType, data);
            eventType = "";
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
      settle("failed");
    } finally {
      setIsResearching(false);
    }
  };

  const handleEvent = (type: string, data: Record<string, unknown>) => {
    if (type === "agent_update") {
      setSteps((prev) => applyAgentUpdate(prev, data));

      if (data.agent === "synthesizer" && data.report) {
        setReport(data.report as string);
      }
    } else if (type === "error") {
      setError(data.message as string);
      settle("failed");
    } else if (type === "complete") {
      settle("done");
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `research-report-${new Date().toISOString().slice(0, 10)}`,
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      startResearch();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b border-card-border bg-card/50 backdrop-blur-sm px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
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
          {steps.length === 0 && !isResearching && !report && (
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

          {/* Pipeline — a forward-only chain of the agents the graph actually ran */}
          {steps.length > 0 && (
            <ol className="mb-8">
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
          )}

          {/* Report */}
          {report && (
            <div className="animate-fade-in mb-8">
              <div className="rounded-xl border border-card-border bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-card-border bg-accent/5 flex items-center gap-2">
                  <IconDocument className="text-accent" />
                  <h2 className="text-lg font-semibold text-foreground">Research Report</h2>
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
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-card-border bg-card/80 backdrop-blur-sm px-6 py-4">
        <div className="max-w-4xl mx-auto">
          {error && (
            <div className="mb-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a research question..."
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
              onClick={startResearch}
              disabled={!query.trim() || isResearching}
              className="px-6 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent-light transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            >
              {isResearching ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Researching
                </span>
              ) : (
                "Research"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
