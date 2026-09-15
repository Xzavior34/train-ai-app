import React, { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";

/**
 * Parses inline formatting: `code`, **bold**, *italic*, _italic_
 */
export function renderFormattedInline(text) {
  if (!text) return null;
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={index}
          style={{
            background: "rgba(37, 99, 235, 0.08)",
            color: "var(--primary, #2563EB)",
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: "0.88em",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontWeight: 600,
            border: "1px solid rgba(37, 99, 235, 0.15)"
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return (
        <strong key={index} style={{ fontWeight: 750, color: "inherit" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return (
        <em key={index} style={{ fontStyle: "italic" }}>
          {part.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        margin: "12px 0",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        background: "#0F172A",
        color: "#F8FAFC",
        fontSize: 12.5,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 12px",
          background: "rgba(255, 255, 255, 0.05)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          fontSize: 11,
          color: "#94A3B8",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Terminal size={12} color="#38BDF8" />
          <span style={{ textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
            {language || "code"}
          </span>
        </div>
        <button
          onClick={handleCopy}
          style={{
            background: "transparent",
            border: "none",
            color: copied ? "#4ADE80" : "#94A3B8",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            padding: "2px 6px",
            borderRadius: 4,
            transition: "color 0.15s ease",
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre style={{ margin: 0, padding: 12, overflowX: "auto", lineHeight: 1.5 }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Formats full markdown content (headings, code blocks, lists, bold, blockquotes)
 */
export function FormattedAIResponse({ content, isUser = false }) {
  if (!content) return null;

  // Split into raw lines
  const rawLines = content.split("\n");
  const elements = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];

    // Check for fenced code block ```
    if (line.trim().startsWith("```")) {
      const language = line.trim().replace(/^```/, "").trim();
      const codeLines = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith("```")) {
        codeLines.push(rawLines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <CodeBlock key={`code-${elements.length}`} code={codeLines.join("\n")} language={language} />
      );
      continue;
    }

    // Check for Headings: #, ##, ###, ####
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match) {
      elements.push(
        <h2
          key={`h1-${elements.length}`}
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: isUser ? "#FFFFFF" : "var(--text)",
            margin: "14px 0 6px",
            lineHeight: 1.3,
          }}
        >
          {renderFormattedInline(h1Match[1])}
        </h2>
      );
      i++;
      continue;
    }

    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      elements.push(
        <h3
          key={`h2-${elements.length}`}
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: isUser ? "#FFFFFF" : "var(--text)",
            margin: "12px 0 6px",
            lineHeight: 1.35,
          }}
        >
          {renderFormattedInline(h2Match[1])}
        </h3>
      );
      i++;
      continue;
    }

    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      elements.push(
        <h4
          key={`h3-${elements.length}`}
          style={{
            fontSize: 14,
            fontWeight: 750,
            color: isUser ? "#E0F2FE" : "var(--primary, #2563EB)",
            margin: "12px 0 5px",
            lineHeight: 1.4,
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          {renderFormattedInline(h3Match[1])}
        </h4>
      );
      i++;
      continue;
    }

    const h4Match = line.match(/^####\s+(.+)$/);
    if (h4Match) {
      elements.push(
        <h5
          key={`h4-${elements.length}`}
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: isUser ? "#FFFFFF" : "var(--text)",
            margin: "10px 0 4px",
            lineHeight: 1.4,
          }}
        >
          {renderFormattedInline(h4Match[1])}
        </h5>
      );
      i++;
      continue;
    }

    // Check for Blockquote
    const quoteMatch = line.match(/^>\s*(.+)$/);
    if (quoteMatch) {
      elements.push(
        <div
          key={`quote-${elements.length}`}
          style={{
            borderLeft: "3px solid var(--primary, #2563EB)",
            paddingLeft: 10,
            margin: "8px 0",
            fontStyle: "italic",
            color: isUser ? "#F1F5F9" : "var(--text-2)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {renderFormattedInline(quoteMatch[1])}
        </div>
      );
      i++;
      continue;
    }

    // Check for Ordered list item: e.g. "1. " or "2. "
    const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      const num = olMatch[1];
      const text = olMatch[2];
      elements.push(
        <div
          key={`ol-${elements.length}`}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            margin: "5px 0",
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          <span
            style={{
              fontWeight: 800,
              color: isUser ? "#BAE6FD" : "var(--primary, #2563EB)",
              minWidth: 18,
              textAlign: "right",
              flexShrink: 0,
            }}
          >
            {num}.
          </span>
          <div style={{ flex: 1 }}>{renderFormattedInline(text)}</div>
        </div>
      );
      i++;
      continue;
    }

    // Check for Unordered list item: e.g. "- " or "* " or "+ "
    const ulMatch = line.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      const text = ulMatch[1];
      elements.push(
        <div
          key={`ul-${elements.length}`}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            margin: "4px 0",
            paddingLeft: 12,
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          <span
            style={{
              color: isUser ? "#BAE6FD" : "var(--primary, #2563EB)",
              fontWeight: 800,
              flexShrink: 0,
              fontSize: 14,
              lineHeight: 1.2,
            }}
          >
            •
          </span>
          <div style={{ flex: 1 }}>{renderFormattedInline(text)}</div>
        </div>
      );
      i++;
      continue;
    }

    // Empty line / paragraph break
    if (!line.trim()) {
      elements.push(<div key={`spacer-${elements.length}`} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // Regular paragraph / text line
    elements.push(
      <div
        key={`p-${elements.length}`}
        style={{
          margin: "4px 0",
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        {renderFormattedInline(line)}
      </div>
    );
    i++;
  }

  return (
    <div className="tai-formatted-ai-response" style={{ width: "100%", wordBreak: "break-word" }}>
      {elements}
    </div>
  );
}

export default FormattedAIResponse;
