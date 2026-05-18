"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownOutputProps {
  content: string;
}

export function MarkdownOutput({ content }: MarkdownOutputProps) {
  return (
    <div className="markdown-output min-w-0 max-w-full overflow-hidden text-wrap">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        h1: ({ children }) => (
          <h1 className="mb-4 mt-2 max-w-full text-wrap text-lg font-black tracking-[0.06em] text-[#f4f1e8]">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-3 mt-5 max-w-full text-wrap text-sm font-bold uppercase tracking-[0.1em] text-[#7ecf8e]">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-4 max-w-full text-wrap text-sm font-semibold text-[#f4f1e8]">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="mb-3 max-w-full text-wrap leading-6 text-[#a8a29a]">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 min-w-0 max-w-full space-y-1 pl-4">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 min-w-0 max-w-full list-decimal space-y-1 pl-4">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="min-w-0 max-w-full text-wrap leading-6 text-[#a8a29a] marker:text-[#7ecf8e]">{children}</li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-[#f4f1e8]">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="text-[#c8c3b8]">{children}</em>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className="block min-w-0 max-w-full whitespace-pre-wrap rounded border border-[#2a302c] bg-[#040605] p-3 font-mono text-xs leading-5 text-[#7ecf8e] [overflow-wrap:anywhere]">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-[#0d110e] px-1 py-0.5 font-mono text-xs text-[#7ecf8e] [overflow-wrap:anywhere]">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-3 max-w-full overflow-x-auto whitespace-pre-wrap rounded border border-[#2a302c] bg-[#040605] p-3 [overflow-wrap:anywhere]">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-3 border-l-2 border-[#7ecf8e] pl-3 text-[#6f6a61] italic">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="mb-3 max-w-full overflow-x-auto thin-scrollbar">
            <table className="w-full table-auto border-collapse text-xs">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-[#2a302c]">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-semibold text-[#f4f1e8] [overflow-wrap:anywhere]">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border-b border-[#1a201c] px-3 py-2 text-[#a8a29a] [overflow-wrap:anywhere]">{children}</td>
        ),
        hr: () => <hr className="my-4 border-[#2a302c]" />,
        a: ({ children, href }) => (
          <a href={href} className="text-[#7ecf8e] underline underline-offset-2 hover:text-[#a8d8b0]" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
        {content}
      </ReactMarkdown>
    </div>
  );
}
