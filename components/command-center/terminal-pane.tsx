"use client";

import "@xterm/xterm/css/xterm.css";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2, Pin, Plus, Power, Terminal as TerminalIcon, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";

// AgenticOS dark theme for xterm.js
const XTERM_THEME = {
  background:        "#1b1b1b",
  foreground:        "#a8a29a",
  cursor:            "#e86f3a",
  cursorAccent:      "#080a08",
  selectionBackground: "rgba(232,111,58,0.25)",
  black:             "#1b1b1b",
  brightBlack:       "#3d4239",
  red:               "#c4605a",
  brightRed:         "#e86f3a",
  green:             "#79a875",
  brightGreen:       "#9fc39b",
  yellow:            "#c99a45",
  brightYellow:      "#e0b96b",
  blue:              "#5cb8e0",
  brightBlue:        "#7acce0",
  magenta:           "#c97aff",
  brightMagenta:     "#d9a3ff",
  cyan:              "#5ed3ff",
  brightCyan:        "#84e0ff",
  white:             "#a8a29a",
  brightWhite:       "#f4f1e8",
};

interface SessionState { id: string; cliId: string; cliLabel: string; alive: boolean }

interface TerminalAdapter {
  id: string;
  label: string;
  available: boolean;
  command: string;
  installHint?: string;
}

// Decode base64 chunk to Uint8Array for xterm.js
function b64ToBytes(b64: string): Uint8Array {
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function TerminalPane() {
  const [open, setOpen]               = useState(true);
  const [selectedCli, setSelectedCli] = useState("claude-code");
  const [adapters, setAdapters]       = useState<TerminalAdapter[]>([]);
  const [loadingAdapters, setLoadingAdapters] = useState(true);
  const [session, setSession]         = useState<SessionState | null>(null);
  const [isPending, startTransition]  = useTransition();
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef      = useRef<Terminal | null>(null);
  const fitRef       = useRef<FitAddon | null>(null);
  const esRef        = useRef<EventSource | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const startingRef  = useRef(false);

  // Initialise xterm.js once container is mounted
  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;

    // Lazy import — prevents SSR crash
    void (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        theme: XTERM_THEME,
        fontFamily: '"JetBrains Mono", "Cascadia Code", ui-monospace, monospace',
        fontSize: 13,
        lineHeight: 1.45,
        cursorBlink: true,
        cursorStyle: "bar",
        scrollback: 5000,
        convertEol: true,
        allowTransparency: false,
        cols: 120,
        rows: 24,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      fit.fit();

      termRef.current = term;
      fitRef.current  = fit;

      // Relay keystrokes → backend raw input
      term.onData((data) => {
        const sid = sessionIdRef.current;
        if (!sid) return;
        void fetch(`/api/terminal/${sid}/input`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
      });

      // Push the actual xterm size to the PTY whenever fit changes it. Without this
      // the PTY keeps its initial 120×24 and TUI tools (Copilot CLI especially)
      // redraw with cursor math that doesn't match the visible viewport — output
      // stacks instead of overwriting, producing visible duplicates.
      let lastCols = -1;
      let lastRows = -1;
      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      const pushResize = () => {
        const sid = sessionIdRef.current;
        if (!sid) return;
        const cols = term.cols;
        const rows = term.rows;
        if (cols === lastCols && rows === lastRows) return;
        lastCols = cols; lastRows = rows;
        void fetch(`/api/terminal/${sid}/resize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cols, rows }),
        }).catch(() => {});
      };
      term.onResize(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(pushResize, 80);
      });

      // Auto-fit on container resize
      const ro = new ResizeObserver(() => {
        try { fit.fit(); } catch {}
      });
      ro.observe(containerRef.current);

      term.writeln("\x1b[2m— AgenticOS Terminal — select a CLI and click Start —\x1b[0m");
    })();

    return () => {
      disposed = true;
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current  = null;
    };
  }, []);

  // Load adapters once. The terminal's CLI choice is INDEPENDENT of Settings —
  // restore its own last selection (agenticos.terminalCli) and fall back to the
  // first available adapter, NOT the settings active provider.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/terminal/sessions", { cache: "no-store" });
        const data = (await res.json()) as { adapters?: TerminalAdapter[] };
        if (cancelled) return;

        const next = data.adapters ?? [];
        setAdapters(next);

        const lastTerminalCli = window.localStorage.getItem("agenticos.terminalCli");
        const preferred = next.find((a) => a.id === lastTerminalCli)
          ?? next.find((a) => a.available)
          ?? next.find((a) => a.id === "shell")
          ?? next[0];
        if (preferred) setSelectedCli(preferred.id);
      } catch {
        if (!cancelled) setErrorMsg("Could not load terminal adapters");
      } finally {
        if (!cancelled) setLoadingAdapters(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const pickCli = useCallback((id: string) => {
    setSelectedCli(id);
    try { window.localStorage.setItem("agenticos.terminalCli", id); } catch {}
  }, []);

  // Wire SSE when session changes
  useEffect(() => {
    esRef.current?.close();
    if (!session?.id) return;
    sessionIdRef.current = session.id;

    const es = new EventSource(`/api/terminal/${session.id}/stream`);
    esRef.current = es;

    // Immediately sync PTY dims to the current viewport so TUI redraws line up.
    const term = termRef.current;
    if (term) {
      try { fitRef.current?.fit(); } catch {}
      void fetch(`/api/terminal/${session.id}/resize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cols: term.cols, rows: term.rows }),
      }).catch(() => {});
    }

    es.addEventListener("history", (evt) => {
      const payload = JSON.parse((evt as MessageEvent<string>).data) as { chunks: string[] };
      termRef.current?.clear();
      for (const chunk of payload.chunks) {
        termRef.current?.write(b64ToBytes(chunk));
      }
    });
    es.addEventListener("output", (evt) => {
      const raw = (JSON.parse((evt as MessageEvent<string>).data) as { chunk: string }).chunk;
      termRef.current?.write(b64ToBytes(raw));
    });
    es.addEventListener("exit", () => {
      termRef.current?.writeln("\r\n\x1b[2m[session ended]\x1b[0m");
      setSession((s) => s ? { ...s, alive: false } : null);
      es.close();
    });
    es.onerror = () => {
      termRef.current?.writeln("\r\n\x1b[31m[stream disconnected]\x1b[0m");
      es.close();
    };

    return () => es.close();
  }, [session?.id]);

  const startSession = useCallback(() => {
    if (startingRef.current || session?.alive) return;
    startingRef.current = true;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/terminal/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cliId: selectedCli }),
        });
        const data = (await res.json()) as { session?: SessionState; error?: string };
        if (data.session) {
          termRef.current?.clear();
          setSession(data.session);
          setTimeout(() => { try { termRef.current?.focus(); } catch {} }, 100);
        } else {
          setErrorMsg(data.error ?? "Failed to start");
          termRef.current?.writeln(`\r\n\x1b[31m[Error: ${data.error ?? "Failed to start"}]\x1b[0m`);
        }
      } finally {
        startingRef.current = false;
      }
    });
  }, [selectedCli, session?.alive, startTransition]);

  function killSession() {
    if (!session) return;
    void fetch(`/api/terminal/${session.id}`, { method: "DELETE" });
    termRef.current?.writeln("\r\n\x1b[33m[session killed]\x1b[0m");
    setSession((s) => s ? { ...s, alive: false } : null);
    sessionIdRef.current = null;
  }

  const activeLabel = session ? session.cliLabel : adapters.find((a) => a.id === selectedCli)?.label ?? "Claude Code";
  const truncatedLabel = activeLabel.length > 10 ? `${activeLabel.slice(0, 10)}…` : activeLabel;
  const dotColor = session?.alive ? "bg-[#79a875] shadow-[0_0_6px_#79a875]" : "bg-[#6f6a61]";

  return (
    <div className="rounded-none border border-[#353535] bg-[#1b1b1b] shadow-[0_-1px_0_#2b2b2b]">
      {/* ── Tab strip ── */}
      <div className="flex items-center justify-between border-b border-[#323232] bg-[#242424] px-2 py-[5px]">
        <div className="flex items-center gap-[6px]">
          <div className={`flex h-[22px] items-center gap-[6px] rounded-[1px] border px-2 text-[0.58rem] uppercase tracking-[0.14em] ${session?.alive ? "border-[#e86f3a]/40 bg-[#1f1f1f] text-[#f4f1e8]" : "border-[#3f3f3f] bg-[#1f1f1f] text-[#a8a29a]"}`}>
            <TerminalIcon size={10} className="text-[#a8a29a]" />
            <span className="text-[#a8a29a]">Terminal:</span>
            <span className={`cc-live-dot inline-block h-[6px] w-[6px] rounded-full ${dotColor}`} />
            <span className="text-[#f4f1e8]">{truncatedLabel}</span>
            <Pin size={9} className="text-[#6f6a61]" />
            {session?.alive ? (
              <button type="button" onClick={killSession} aria-label="Close session" className="text-[#6f6a61] transition hover:text-[#c4605a]">
                <X size={10} />
              </button>
            ) : null}
          </div>

          {!session?.alive ? (
            <>
              <select
                value={selectedCli}
                onChange={(e) => pickCli(e.target.value)}
                disabled={loadingAdapters}
                title="Terminal CLI is independent of the Settings active provider — pick any installed CLI here"
                className="h-[22px] rounded-[1px] border border-[#3f3f3f] bg-[#1f1f1f] px-2 text-[0.58rem] uppercase tracking-[0.14em] text-[#a8a29a] outline-none focus:border-[#e86f3a]"
              >
                {adapters.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.available ? a.label : `${a.label} (missing)`}
                  </option>
                ))}
              </select>
              <button type="button" onClick={startSession} disabled={isPending}
                className="flex h-[22px] items-center gap-1 rounded-[1px] border border-[#79a875]/50 bg-[#1f1f1f] px-2 text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[#79a875] transition hover:border-[#79a875] hover:bg-[#0d1a0d] disabled:cursor-wait disabled:opacity-50"
                title="Start session">
                {isPending ? <Loader2 size={9} className="animate-spin" /> : <Power size={9} />}
                {isPending ? "Starting..." : "Start"}
              </button>
            </>
          ) : null}

          <button type="button" aria-label="New tab" tabIndex={-1}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-[1px] border border-[#3f3f3f] bg-[#1f1f1f] text-[#6f6a61] transition hover:border-[#e86f3a] hover:text-[#e86f3a]">
            <Plus size={11} />
          </button>

          {errorMsg ? <span className="ml-1 text-[0.58rem] text-[#c4605a]">{errorMsg}</span> : null}
          {!session?.alive && adapters.find((a) => a.id === selectedCli && !a.available) ? (
            <span className="max-w-[280px] truncate text-[0.58rem] text-[#c99a45]">
              missing: {adapters.find((a) => a.id === selectedCli)?.installHint ?? adapters.find((a) => a.id === selectedCli)?.command}
            </span>
          ) : null}
        </div>

        <button type="button" onClick={() => setOpen((v) => !v)}
          className="flex h-[22px] w-[22px] items-center justify-center rounded-[1px] border border-[#3f3f3f] bg-[#1f1f1f] text-[#6f6a61] transition hover:border-[#e86f3a] hover:text-[#e86f3a]"
          aria-label={open ? "Collapse terminal" : "Expand terminal"}>
          {open ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
        </button>
      </div>

      {/* ── Tab content strip (nav + centered title) ── */}
      {open ? (
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-[#323232] bg-[#1b1b1b] px-2 py-[4px]">
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Back" tabIndex={-1}
              className="flex h-[18px] w-[18px] items-center justify-center rounded-[2px] text-[#6f6a61] transition hover:text-[#e86f3a]">
              <ChevronLeft size={11} />
            </button>
            <button type="button" aria-label="Forward" tabIndex={-1}
              className="flex h-[18px] w-[18px] items-center justify-center rounded-[2px] text-[#6f6a61] transition hover:text-[#e86f3a]">
              <ChevronRight size={11} />
            </button>
          </div>
          <div className="text-center text-[0.58rem] uppercase tracking-[0.16em] text-[#a8a29a]">
            Terminal:
            <span className={`cc-live-dot ml-2 inline-block h-[6px] w-[6px] rounded-full align-middle ${dotColor}`} />
            <span className="ml-2 text-[#f4f1e8]">{activeLabel}</span>
          </div>
          <div className="w-[36px]" />
        </div>
      ) : null}

      {/* ── xterm.js viewport ── */}
      <div
        className="transition-[height] duration-200"
        style={{ height: open ? "246px" : "0px", overflow: "hidden" }}
      >
        <div
          ref={containerRef}
          className="h-full w-full"
          style={{ padding: "4px 6px" }}
        />
      </div>
    </div>
  );
}
