"use client";

import { useState, useRef, useMemo } from "react";
import { useReactToPrint } from "react-to-print";
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

const PIPELINE_STAGES = ["orchestrator", "web_researcher", "document_analyst", "synthesizer"] as const;

const STAGE_META: Record<string, { label: string; description: string }> = {
  orchestrator: { label: "Orchestrator", description: "Planning research strategy" },
  web_researcher: { label: "Web Researcher", description: "Searching the web for findings" },
  document_analyst: { label: "Document Analyst", description: "Analyzing uploaded documents" },
  synthesizer: { label: "Synthesizer", description: "Generating final report" },
};

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
  const stepCounter = useRef(0);

  const stageStates = useMemo(() => {
    const states: Record<string, "pending" | "running" | "done"> = {};
    for (const stage of PIPELINE_STAGES) {
      states[stage] = "pending";
    }
    if (steps.length === 0) return states;

    // Mark any stage that has ever completed as "done"
    for (const step of steps) {
      if (step.status === "done") {
        states[step.agent] = "done";
      }
    }

    // The latest running step overrides to "running"
    const latest = steps[steps.length - 1];
    if (latest.status === "running") {
      states[latest.agent] = "running";
    }

    return states;
  }, [steps]);


  const latestStep = steps.length > 0 ? steps[steps.length - 1] : null;

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
    } else if (type === "error") {
      setError(data.message as string);
    } else if (type === "complete") {
      setSteps((prev) =>
        prev.map((s) => (s.status === "running" ? { ...s, status: "done" } : s))
      );
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

          {/* Pipeline */}
          {(isResearching || steps.length > 0) && (
            <div className="mb-8 animate-fade-in">
              {/* Pipeline stepper */}
              <div className="relative">
                <div className="flex items-center justify-between">
                  {PIPELINE_STAGES.map((stage, i) => {
                    const state = stageStates[stage];
                    const Icon = STAGE_ICONS[stage];
                    const meta = STAGE_META[stage];

                    return (
                      <div key={stage} className="flex items-center flex-1 last:flex-none">
                        {/* Stage node */}
                        <div className="flex flex-col items-center gap-2">
                          <div className="relative">
                            {state === "running" && (
                              <div className="absolute -inset-1.5 rounded-full border-2 border-transparent border-t-accent animate-spin" />
                            )}
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                                state === "done"
                                  ? "bg-success/15 text-success ring-2 ring-success/30"
                                  : state === "running"
                                  ? "bg-accent/15 text-accent ring-2 ring-accent/30"
                                  : "bg-card text-muted ring-1 ring-card-border"
                              }`}
                            >
                              {state === "done" ? <IconCheck /> : <Icon />}
                            </div>
                          </div>
                          <span
                            className={`text-xs font-medium transition-colors duration-300 whitespace-nowrap ${
                              state === "done"
                                ? "text-success"
                                : state === "running"
                                ? "text-accent-light"
                                : "text-muted"
                            }`}
                          >
                            {meta.label}
                          </span>
                        </div>

                        {/* Connector line */}
                        {i < PIPELINE_STAGES.length - 1 && (
                          <div className="flex-1 mx-3 mt-[-20px]">
                            <div
                              className={`h-0.5 rounded-full transition-all duration-500 ${
                                state === "done"
                                  ? "bg-success/40"
                                  : state === "running"
                                  ? "bg-accent/30 pipeline-pulse"
                                  : "bg-card-border"
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>

              <div className="mt-6">

              {/* Detail panel */}
              {latestStep && (
                <div className="rounded-xl border border-card-border bg-card/50 px-5 py-4 animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    {(() => {
                      const Icon = STAGE_ICONS[latestStep.agent];
                      return Icon ? (
                        <Icon className={latestStep.status === "running" ? "text-accent" : "text-success"} />
                      ) : null;
                    })()}
                    <span className={`font-medium text-sm ${
                      latestStep.status === "running" ? "text-accent-light" : "text-success"
                    }`}>
                      {STAGE_META[latestStep.agent]?.label || latestStep.agent}
                    </span>
                    {latestStep.status === "running" && (
                      <span className="ml-auto w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    )}
                    {latestStep.status === "done" && (
                      <IconCheck className="ml-auto text-success" />
                    )}
                  </div>
                  <p className="text-sm text-muted">
                    {latestStep.agent === "orchestrator" && latestStep.plan && latestStep.plan}
                    {latestStep.agent === "orchestrator" && !latestStep.plan && STAGE_META.orchestrator.description}
                    {latestStep.agent === "web_researcher" && latestStep.status === "done" &&
                      `Gathered ${latestStep.findings_count || 0} finding(s) from web search`}
                    {latestStep.agent === "web_researcher" && latestStep.status === "running" &&
                      STAGE_META.web_researcher.description}
                    {latestStep.agent === "document_analyst" && latestStep.status === "done" &&
                      `Analyzed documents — ${latestStep.findings_count || 0} finding(s)`}
                    {latestStep.agent === "document_analyst" && latestStep.status === "running" &&
                      STAGE_META.document_analyst.description}
                    {latestStep.agent === "synthesizer" && latestStep.status === "done" &&
                      "Final report generated"}
                    {latestStep.agent === "synthesizer" && latestStep.status === "running" &&
                      STAGE_META.synthesizer.description}
                  </p>
                  {latestStep.agent === "orchestrator" && latestStep.next_agent && (
                    <p className="text-xs text-accent-light mt-1">
                      Next: {STAGE_META[latestStep.next_agent]?.label || latestStep.next_agent}
                    </p>
                  )}
                </div>
              )}
              </div>
            </div>
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
