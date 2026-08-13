"use client";

import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { IconDocument, IconDownload } from "@/components/icons";

// The app is dark; a printed page is not. Force readable colours for the PDF.
const PRINT_STYLE = `
  @page { size: A4; margin: 15mm 20mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    * { color: #000000 !important; background: #ffffff !important; }
    a { color: #2563eb !important; }
    blockquote { border-left: 3px solid #4f46e5 !important; padding-left: 12px !important; color: #333333 !important; }
    hr { border-color: #d4d4d8 !important; }
    p, li, h1, h2, h3, h4, blockquote { break-inside: avoid; }
  }
`;

/**
 * A rendered report with its own print handler. It is a component so that each
 * report in the history owns a stable `useReactToPrint` hook: the hook count
 * must not change as turns are appended.
 */
export function ReportCard({
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
    pageStyle: PRINT_STYLE,
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
