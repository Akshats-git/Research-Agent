"use client";

import { useState, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AgentStep {
  id: number;
  agent: string;
  status: "running" | "done";
  plan?: string;
  next_agent?: string;
  reasoning?: string;
  findings_count?: number;
  findings?: string[];
  report?: string;
}

const AGENT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  orchestrator: { label: "Orchestrator", color: "text-cyan-400", icon: "🧠" },
  web_researcher: { label: "Web Researcher", color: "text-emerald-400", icon: "🔍" },
  document_analyst: { label: "Document Analyst", color: "text-amber-400", icon: "📄" },
  synthesizer: { label: "Synthesizer", color: "text-violet-400", icon: "✨" },
};

export default function ResearchApp() {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [report, setReport] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [error, setError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const stepsEndRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const stepCounter = useRef(0);

  const scrollToBottom = () => {
    stepsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const startResearch = async () => {
    if (!query.trim() || isResearching) return;

    setIsResearching(true);
    setSteps([]);
    setReport("");
    setError("");
    stepCounter.current = 0;

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
    } finally {
      setIsResearching(false);
    }
  };

  const handleEvent = (type: string, data: Record<string, unknown>) => {
    if (type === "agent_update") {
      const agent = data.agent as string;

      setSteps((prev) => {
        const updated = prev.map((s) =>
          s.status === "running" ? { ...s, status: "done" as const } : s
        );

        stepCounter.current += 1;
        const newStep: AgentStep = {
          id: stepCounter.current,
          agent,
          status: "running",
          plan: data.plan as string | undefined,
          next_agent: data.next_agent as string | undefined,
          reasoning: data.reasoning as string | undefined,
          findings_count: data.findings_count as number | undefined,
          findings: data.findings as string[] | undefined,
          report: data.report as string | undefined,
        };

        if (agent === "synthesizer" && data.report) {
          setReport(data.report as string);
          newStep.status = "done";
        }

        return [...updated, newStep];
      });

      setTimeout(scrollToBottom, 100);
    } else if (type === "error") {
      setError(data.message as string);
    } else if (type === "complete") {
      setSteps((prev) =>
        prev.map((s) => (s.status === "running" ? { ...s, status: "done" } : s))
      );
    }
  };

  const downloadPdf = useCallback(async () => {
    if (!reportRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `research-report-${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          onclone: (clonedDoc: Document) => {
            const el = clonedDoc.querySelector(".report-content");
            if (el) el.classList.add("pdf-export");
          },
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      };
      await html2pdf().set(opt).from(reportRef.current).save();
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading]);

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
          <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center">
            <span className="text-lg">🔬</span>
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
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
                <span className="text-3xl">🔬</span>
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

          {/* Agent steps */}
          {steps.length > 0 && (
            <div className="space-y-3 mb-8">
              {steps.map((step) => (
                <StepCard key={step.id} step={step} />
              ))}
              <div ref={stepsEndRef} />
            </div>
          )}

          {/* Report */}
          {report && (
            <div className="animate-fade-in mb-8">
              <div className="rounded-xl border border-card-border bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-card-border bg-accent/5 flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  <h2 className="text-lg font-semibold text-foreground">Research Report</h2>
                  <button
                    onClick={downloadPdf}
                    disabled={isDownloading}
                    className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded-lg border border-card-border bg-background text-sm text-muted hover:text-foreground hover:border-accent/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-muted/30 border-t-muted rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8 1v9m0 0L5 7m3 3l3-3M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Download PDF
                      </>
                    )}
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
              <span>📎</span>
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

function StepCard({ step }: { step: AgentStep }) {
  const config = AGENT_CONFIG[step.agent] || {
    label: step.agent,
    color: "text-gray-400",
    icon: "⚙️",
  };

  return (
    <div
      className={`rounded-xl border bg-card overflow-hidden animate-fade-in ${
        step.status === "running"
          ? "border-accent/30 shimmer"
          : "border-card-border"
      }`}
    >
      <div className="px-5 py-3 flex items-center gap-3">
        <span className="text-lg">{config.icon}</span>
        <span className={`font-medium ${config.color}`}>{config.label}</span>

        {step.status === "running" && (
          <span className="flex items-center gap-1 ml-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot [animation-delay:0.4s]" />
          </span>
        )}

        {step.status === "done" && (
          <span className="ml-auto text-success text-sm">✓</span>
        )}
      </div>

      {/* Step details */}
      <div className="px-5 pb-3 text-sm text-muted">
        {step.agent === "orchestrator" && step.plan && (
          <div>
            <p className="mb-1">{step.plan}</p>
            {step.next_agent && (
              <p className="text-xs text-accent-light">
                → Routing to {AGENT_CONFIG[step.next_agent]?.label || step.next_agent}
              </p>
            )}
          </div>
        )}

        {step.agent === "web_researcher" && step.status === "done" && (
          <p>Gathered {step.findings_count || 0} finding(s) from web search</p>
        )}

        {step.agent === "document_analyst" && step.status === "done" && (
          <p>Analyzed documents — {step.findings_count || 0} finding(s)</p>
        )}

        {step.agent === "synthesizer" && step.status === "done" && (
          <p>Final report generated</p>
        )}
      </div>
    </div>
  );
}
