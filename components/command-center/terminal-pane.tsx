"use client";

import "@xterm/xterm/css/xterm.css";
import { ChevronDown, ChevronUp, Loader2, Plus, Power, Terminal as TerminalIcon, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";

const XTERM_THEME = {
  background: "#0c0c0c",
  foreground: "#cccccc",
  cursor: "#ffffff",
  cursorAccent: "#000000",
  selectionBackground: "rgba(255,255,255,0.25)",
  black: "#0c0c0c",
  brightBlack: "#767676",
  red: "#c50f1f",
  brightRed: "#e74856",
  green: "#13a10e",
  brightGreen: "#16c60c",
  yellow: "#c19c00",
  brightYellow: "#f9f1a5",
  blue: "#0037da",
  brightBlue: "#3b78ff",
  magenta: "#881798",
  brightMagenta: "#b4009e",
  cyan: "#3a96dd",
  brightCyan: "#61d6d6",
  white: "#cccccc",
  brightWhite: "#f2f2f2",
};

interface SessionState {
  id: string;
  cliId: string;
  cliLabel: string;
  alive: boolean;
  startedAt?: string;
  historySize?: number;
}

interface TerminalAdapter {
  id: string;
  label: string;
  available: boolean;
  command: string;
  installHint?: string;
}

function b64ToBytes(b64: string): Uint8Array {
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function truncate(label: string, max = 18) {
  return label.length > max ? `${label.slice(0, max - 1)}...` : label;
}

export function TerminalPane() {
  const [open, setOpen] = useState(true);
  const [selectedCli, setSelectedCli] = useState("claude-code");
  const [adapters, setAdapters] = useState<TerminalAdapter[]>([]);
  const [loadingAdapters, setLoadingAdapters] = useState(true);
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const closingStreamRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;

    void (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        theme: XTERM_THEME,
        fontFamily: '"Cascadia Mono", "Cascadia Code", Consolas, "Courier New", monospace',
        fontSize: 14,
        lineHeight: 1,
        letterSpacing: 0,
        cursorBlink: true,
        cursorStyle: "bar",
        scrollback: 10000,
        convertEol: false,
        allowTransparency: false,
        cols: 120,
        rows: 32,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      fit.fit();

      termRef.current = term;
      fitRef.current = fit;

      term.onData((data) => {
        const sid = activeSessionIdRef.current;
        if (!sid) return;
        void fetch(`/api/terminal/${sid}/input`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        }).catch(() => {});
      });

      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      const pushResize = () => {
        const sid = activeSessionIdRef.current;
        if (!sid) return;
        void fetch(`/api/terminal/${sid}/resize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cols: term.cols, rows: term.rows }),
        }).catch(() => {});
      };

      term.onResize(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(pushResize, 80);
      });

      resizeObserver = new ResizeObserver(() => {
        try {
          fit.fit();
        } catch {}
      });
      resizeObserver.observe(containerRef.current);
    })();

    return () => {
      disposed = true;
      closingStreamRef.current = true;
      esRef.current?.close();
      resizeObserver?.disconnect();
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/terminal/sessions", { cache: "no-store" });
        const data = (await res.json()) as { sessions?: SessionState[]; adapters?: TerminalAdapter[] };
        if (cancelled) return;

        const nextAdapters = data.adapters ?? [];
        const nextSessions = data.sessions ?? [];
        setAdapters(nextAdapters);
        setSessions(nextSessions);

        const lastTerminalCli = window.localStorage.getItem("agenticos.terminalCli");
        const preferred = nextAdapters.find((a) => a.id === lastTerminalCli)
          ?? nextAdapters.find((a) => a.available)
          ?? nextAdapters.find((a) => a.id === "shell")
          ?? nextAdapters[0];
        if (preferred) setSelectedCli(preferred.id);
        if (nextSessions[0]) setActiveSessionId(nextSessions[0].id);
      } catch {
        if (!cancelled) setErrorMsg("Could not load terminal adapters");
      } finally {
        if (!cancelled) setLoadingAdapters(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const syncActiveSize = useCallback((sessionId: string) => {
    const term = termRef.current;
    if (!term) return;
    try {
      fitRef.current?.fit();
    } catch {}
    void fetch(`/api/terminal/${sessionId}/resize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cols: term.cols, rows: term.rows }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    closingStreamRef.current = true;
    esRef.current?.close();
    esRef.current = null;
    closingStreamRef.current = false;

    activeSessionIdRef.current = activeSessionId;
    const term = termRef.current;
    if (!term) return;

    term.reset();
    if (!activeSessionId) {
      term.writeln("\x1b[2mSelect a CLI and click + to start a terminal.\x1b[0m");
      return;
    }

    syncActiveSize(activeSessionId);

    const streamSessionId = activeSessionId;
    const es = new EventSource(`/api/terminal/${streamSessionId}/stream`);
    esRef.current = es;

    es.addEventListener("history", (evt) => {
      if (activeSessionIdRef.current !== streamSessionId) return;
      const payload = JSON.parse((evt as MessageEvent<string>).data) as { chunks: string[] };
      term.reset();
      for (const chunk of payload.chunks) {
        term.write(b64ToBytes(chunk));
      }
      setTimeout(() => {
        try {
          term.focus();
        } catch {}
      }, 20);
    });

    es.addEventListener("output", (evt) => {
      if (activeSessionIdRef.current !== streamSessionId) return;
      const raw = (JSON.parse((evt as MessageEvent<string>).data) as { chunk: string }).chunk;
      term.write(b64ToBytes(raw));
    });

    es.addEventListener("exit", () => {
      setSessions((current) => current.map((s) => (s.id === streamSessionId ? { ...s, alive: false } : s)));
      es.close();
    });

    es.onerror = () => {
      if (!closingStreamRef.current && activeSessionIdRef.current === streamSessionId) {
        setSessions((current) => current.map((s) => (s.id === streamSessionId ? { ...s, alive: false } : s)));
      }
      es.close();
    };

    return () => {
      closingStreamRef.current = true;
      es.close();
    };
  }, [activeSessionId, syncActiveSize]);

  const pickCli = useCallback((id: string) => {
    setSelectedCli(id);
    try {
      window.localStorage.setItem("agenticos.terminalCli", id);
    } catch {}
  }, []);

  const startSession = useCallback(() => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const term = termRef.current;
        try {
          fitRef.current?.fit();
        } catch {}

        const res = await fetch("/api/terminal/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cliId: selectedCli,
            cols: term?.cols,
            rows: term?.rows,
          }),
        });
        const data = (await res.json()) as { session?: SessionState; error?: string };
        if (!data.session) throw new Error(data.error ?? "Failed to start terminal");

        setSessions((current) => [...current, data.session!]);
        setActiveSessionId(data.session.id);
        setOpen(true);
        setTimeout(() => {
          try {
            termRef.current?.focus();
          } catch {}
        }, 100);
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : "Failed to start terminal");
      }
    });
  }, [selectedCli, startTransition]);

  const killSession = useCallback((sessionId: string) => {
    void fetch(`/api/terminal/${sessionId}`, { method: "DELETE" }).catch(() => {});
    setSessions((current) => {
      const remaining = current.filter((session) => session.id !== sessionId);
      if (activeSessionIdRef.current === sessionId) {
        setActiveSessionId(remaining.at(-1)?.id ?? null);
      }
      return remaining;
    });
  }, []);

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;
  const activeLabel = activeSession?.cliLabel ?? adapters.find((a) => a.id === selectedCli)?.label ?? "Terminal";
  const activeAdapterMissing = adapters.find((a) => a.id === selectedCli && !a.available);

  return (
    <div className="rounded-none border border-[#353535] bg-[#0c0c0c] shadow-[0_-1px_0_#2b2b2b]">
      <div className="flex items-center justify-between border-b border-[#323232] bg-[#202020] px-2 py-[5px]">
        <div className="flex min-w-0 flex-1 items-center gap-[6px]">
          <div className="flex max-w-[58vw] items-center gap-[4px] overflow-x-auto">
            {sessions.length ? sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  className={`group flex h-8 shrink-0 items-center gap-[7px] rounded-[1px] border px-3 text-[0.72rem] uppercase tracking-[0.08em] ${
                    isActive
                      ? "border-[#e86f3a]/60 bg-[#0c0c0c] text-[#f4f1e8]"
                      : "border-[#3f3f3f] bg-[#1a1a1a] text-[#a8a29a] hover:border-[#666]"
                  }`}
                  title={session.cliLabel}
                >
                  <button
                    type="button"
                    onClick={() => setActiveSessionId(session.id)}
                    className="flex min-w-0 items-center gap-[7px]"
                  >
                    <TerminalIcon size={10} className="shrink-0 text-[#a8a29a]" />
                    <span className={`inline-block h-[6px] w-[6px] shrink-0 rounded-full ${session.alive ? "bg-[#16c60c]" : "bg-[#767676]"}`} />
                    <span className="truncate">{truncate(session.cliLabel)}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Close ${session.cliLabel}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      killSession(session.id);
                    }}
                    className="text-[#767676] transition hover:text-[#e74856]"
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            }) : (
              <div className="flex h-8 items-center gap-[7px] rounded-[1px] border border-[#3f3f3f] bg-[#1a1a1a] px-3 text-[0.72rem] uppercase tracking-[0.08em] text-[#a8a29a]">
                <TerminalIcon size={10} />
                Terminal
              </div>
            )}
          </div>

          <select
            value={selectedCli}
            onChange={(event) => pickCli(event.target.value)}
            disabled={loadingAdapters}
            title="Choose provider for the next terminal tab"
            className="h-8 shrink-0 rounded-[1px] border border-[#3f3f3f] bg-[#1a1a1a] px-2 text-[0.72rem] uppercase tracking-[0.08em] text-[#cccccc] outline-none focus:border-[#e86f3a]"
          >
            {adapters.map((adapter) => (
              <option key={adapter.id} value={adapter.id}>
                {adapter.available ? adapter.label : `${adapter.label} (missing)`}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={startSession}
            disabled={isPending}
            aria-label="New terminal"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[1px] border border-[#3f3f3f] bg-[#1a1a1a] text-[#cccccc] transition hover:border-[#e86f3a] hover:text-[#e86f3a] disabled:cursor-wait disabled:opacity-50"
            title="Start a new terminal with the selected provider"
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={13} />}
          </button>

          {!sessions.length ? (
            <button
              type="button"
              onClick={startSession}
              disabled={isPending}
              className="flex h-8 shrink-0 items-center gap-2 rounded-[1px] border border-[#16c60c]/50 bg-[#1a1a1a] px-3 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#16c60c] transition hover:border-[#16c60c] disabled:cursor-wait disabled:opacity-50"
            >
              <Power size={10} />
              Start
            </button>
          ) : null}

          {errorMsg ? <span className="truncate text-[0.72rem] text-[#e74856]">{errorMsg}</span> : null}
          {activeAdapterMissing ? (
            <span className="truncate text-[0.72rem] text-[#f9f1a5]">
              missing: {activeAdapterMissing.installHint ?? activeAdapterMissing.command}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-[1px] border border-[#3f3f3f] bg-[#1a1a1a] text-[#cccccc] transition hover:border-[#e86f3a] hover:text-[#e86f3a]"
          aria-label={open ? "Collapse terminal" : "Expand terminal"}
        >
          {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>

      {open ? (
        <div className="border-b border-[#323232] bg-[#141414] px-2 py-[4px] text-center text-[0.72rem] uppercase tracking-[0.08em] text-[#a8a29a]">
          Terminal:
          <span className={`ml-2 inline-block h-[6px] w-[6px] rounded-full align-middle ${activeSession?.alive ? "bg-[#16c60c]" : "bg-[#767676]"}`} />
          <span className="ml-2 text-[#f4f1e8]">{activeLabel}</span>
        </div>
      ) : null}

      <div
        className="transition-[height] duration-200"
        style={{ height: open ? "min(58vh, 620px)" : "0px", minHeight: open ? "460px" : "0px", overflow: "hidden" }}
      >
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
