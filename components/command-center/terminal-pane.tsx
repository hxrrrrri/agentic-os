"use client";

import "@xterm/xterm/css/xterm.css";
import { ChevronDown, ChevronUp, Loader2, Power, Square, Terminal as TerminalIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";

// AgenticOS dark theme for xterm.js
const XTERM_THEME = {
  background:        "#080a08",
  foreground:        "#a8a29a",
  cursor:            "#e86f3a",
  cursorAccent:      "#080a08",
  selectionBackground: "rgba(232,111,58,0.25)",
  black:             "#080a08",
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

      // Auto-fit on container resize
      const ro = new ResizeObserver(() => { try { fit.fit(); } catch {} });
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/terminal/sessions", { cache: "no-store" });
        const data = (await res.json()) as { adapters?: TerminalAdapter[] };
        if (cancelled) return;

        const next = data.adapters ?? [];
        setAdapters(next);

        const activeProvider = window.localStorage.getItem("agenticos.activeProvider");
        const preferred = next.find((a) => a.id === activeProvider && a.available)
          ?? next.find((a) => a.id === selectedCli && a.available)
          ?? next.find((a) => a.available)
          ?? next.find((a) => a.id === "shell");
        if (preferred) setSelectedCli(preferred.id);
      } catch {
        if (!cancelled) setErrorMsg("Could not load terminal adapters");
      } finally {
        if (!cancelled) setLoadingAdapters(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCli]);

  // Wire SSE when session changes
  useEffect(() => {
    esRef.current?.close();
    if (!session?.id) return;
    sessionIdRef.current = session.id;

    const es = new EventSource(`/api/terminal/${session.id}/stream`);
    esRef.current = es;

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
    setErrorMsg(null);
    startTransition(async () => {
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
    });
  }, [selectedCli, startTransition]);

  function killSession() {
    if (!session) return;
    void fetch(`/api/terminal/${session.id}`, { method: "DELETE" });
    termRef.current?.writeln("\r\n\x1b[33m[session killed]\x1b[0m");
    setSession((s) => s ? { ...s, alive: false } : null);
    sessionIdRef.current = null;
  }

  return (
    <div className="rounded-[3px] border border-[#2a302c] bg-[#080a08]">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between border-b border-[#1d211b] px-3 py-[6px]">
        <div className="flex items-center gap-2">
          {/* Status badge */}
          <div className="flex h-[22px] items-center gap-[6px] rounded-[2px] border border-[#2a302c] bg-[#10120f] px-2 text-[0.58rem] uppercase tracking-[0.14em] text-[#a8a29a]">
            <TerminalIcon size={10} className={session?.alive ? "text-[#79a875]" : "text-[#6f6a61]"} />
            Terminal:
            <span className={`ml-1 ${session?.alive ? "text-[#79a875] animate-pulse" : "text-[#6f6a61]"}`}>▣</span>
            <span className="text-[#f4f1e8]">{session ? session.cliLabel : "Idle"}</span>
          </div>

          {/* CLI picker */}
          {!session?.alive ? (
            <select
              value={selectedCli}
              onChange={(e) => setSelectedCli(e.target.value)}
              disabled={loadingAdapters}
              className="h-[22px] rounded-[2px] border border-[#2a302c] bg-[#10120f] px-2 text-[0.58rem] uppercase tracking-[0.14em] text-[#a8a29a] outline-none focus:border-[#e86f3a]"
            >
              {adapters.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.available ? a.label : `${a.label} (missing)`}
                </option>
              ))}
            </select>
          ) : null}

          {/* Start / Kill */}
          {session?.alive ? (
            <button type="button" onClick={killSession}
              className="flex h-[22px] w-[22px] items-center justify-center rounded-[2px] border border-[#c4605a]/50 bg-[#10120f] text-[#c4605a] transition hover:border-[#c4605a] hover:bg-[#1a0d0d]"
              title="Kill session">
              <Square size={9} />
            </button>
          ) : (
            <button type="button" onClick={startSession} disabled={isPending}
              className="flex h-[22px] items-center gap-1 rounded-[2px] border border-[#79a875]/50 bg-[#10120f] px-2 text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[#79a875] transition hover:border-[#79a875] hover:bg-[#0d1a0d] disabled:opacity-50 disabled:cursor-wait"
              title="Start session">
              {isPending ? <Loader2 size={9} className="animate-spin" /> : <Power size={9} />}
              {isPending ? "Starting..." : "Start"}
            </button>
          )}

          {errorMsg ? <span className="text-[0.58rem] text-[#c4605a]">{errorMsg}</span> : null}
          {!session?.alive && adapters.find((a) => a.id === selectedCli && !a.available) ? (
            <span className="max-w-[280px] truncate text-[0.58rem] text-[#c99a45]">
              missing: {adapters.find((a) => a.id === selectedCli)?.installHint ?? adapters.find((a) => a.id === selectedCli)?.command}
            </span>
          ) : null}
        </div>

        <button type="button" onClick={() => setOpen((v) => !v)}
          className="flex h-[22px] w-[22px] items-center justify-center rounded-[2px] border border-[#2a302c] bg-[#10120f] text-[#6f6a61] transition hover:border-[#e86f3a] hover:text-[#e86f3a]"
          aria-label={open ? "Collapse terminal" : "Expand terminal"}>
          {open ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
        </button>
      </div>

      {/* ── xterm.js viewport ── */}
      <div
        className="transition-[height] duration-200"
        style={{ height: open ? "260px" : "0px", overflow: "hidden" }}
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
