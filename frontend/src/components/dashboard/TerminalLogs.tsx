import React, { useState } from 'react';
import { LogEntry } from '../../types';
import { WrapText, AlignLeft, Copy, Check } from 'lucide-react';
import { clsx } from 'clsx';

interface TerminalLogsProps {
  logs: LogEntry[];
  maxHeight?: string;
  emptyMessage?: string;
  showWrapToggle?: boolean;
}

interface ParsedLogLine {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'neutral';
  levelLabel: string;
  caller?: string;
  stream?: string;
  message: string;
  raw: string;
}

export const TerminalLogs: React.FC<TerminalLogsProps> = ({
  logs,
  maxHeight = '240px',
  emptyMessage = 'No logs available for this pod',
  showWrapToggle = true,
}) => {
  const [wrapLines, setWrapLines] = useState<boolean>(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!logs || logs.length === 0) {
    return (
      <div className="bg-[#050608] border border-border/60 rounded p-6 text-center text-text-secondary text-xs font-mono">
        {emptyMessage}
      </div>
    );
  }

  // Parse a log string or entry into structured segments
  const parseLogLine = (entry: LogEntry): ParsedLogLine => {
    let rawLine = (entry.line || '').trim();
    let timestampStr = '';
    let streamStr = '';
    let level: 'info' | 'warn' | 'error' | 'debug' | 'neutral' = 'neutral';
    let levelLabel = 'LOG';
    let caller = '';
    let message = rawLine;

    // 1. Strip leading redundant timestamp if present (e.g. "19:42:12.985 ")
    const leadingTimeMatch = rawLine.match(/^(\d{2}:\d{2}:\d{2}(?:\.\d{3,6})?)\s+/);
    if (leadingTimeMatch) {
      timestampStr = leadingTimeMatch[1];
      rawLine = rawLine.substring(leadingTimeMatch[0].length).trim();
    } else {
      try {
        timestampStr = new Date(entry.timestamp).toISOString().substring(11, 23);
      } catch {
        timestampStr = '';
      }
    }

    // 2. Try parsing Docker/Containerd CRI JSON container log format
    if (rawLine.startsWith('{') && rawLine.endsWith('}')) {
      try {
        const json = JSON.parse(rawLine);

        // Case A: Containerd / Docker json-file format {"log":"...", "stream":"stdout", "time":"..."}
        if (json.log !== undefined) {
          streamStr = json.stream || '';
          if (json.time && !timestampStr) {
            timestampStr = json.time.substring(11, 23);
          }
          let innerMsg = typeof json.log === 'string' ? json.log.trim() : JSON.stringify(json.log);

          // Check if inner message is itself JSON (e.g., zap logger)
          if (innerMsg.startsWith('{') && innerMsg.endsWith('}')) {
            try {
              const innerJson = JSON.parse(innerMsg);
              if (innerJson.msg || innerJson.message) {
                message = innerJson.msg || innerJson.message;
                if (innerJson.level) levelLabel = String(innerJson.level).toUpperCase();
                if (innerJson.caller) caller = String(innerJson.caller);
              }
            } catch {
              message = innerMsg;
            }
          } else {
            message = innerMsg;
          }
        }
        // Case B: Direct JSON structured logger {"level":"info", "msg":"...", "caller":"..."}
        else if (json.msg || json.message) {
          message = json.msg || json.message;
          if (json.level) levelLabel = String(json.level).toUpperCase();
          if (json.caller) caller = String(json.caller);
          if (json.ts && !timestampStr) timestampStr = String(json.ts).substring(11, 23);
        } else {
          message = rawLine;
        }
      } catch {
        message = rawLine;
      }
    } else {
      message = rawLine;
    }

    // 3. Detect Golang klog format (e.g., "I0825 19:35:03.302080 1 server.go:379] Started...")
    const klogMatch = message.match(/^([IWEF])(\d{4}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+\d+\s+([^\]]+)\]\s+(.*)$/s);
    if (klogMatch) {
      const klogType = klogMatch[1];
      caller = klogMatch[3];
      message = klogMatch[4];
      if (klogType === 'I') { level = 'info'; levelLabel = 'INFO'; }
      else if (klogType === 'W') { level = 'warn'; levelLabel = 'WARN'; }
      else if (klogType === 'E') { level = 'error'; levelLabel = 'ERROR'; }
      else if (klogType === 'F') { level = 'error'; levelLabel = 'FATAL'; }
    }

    // 4. Infer log level from keywords if not yet resolved
    if (level === 'neutral') {
      const lower = message.toLowerCase();
      if (/\b(error|fatal|critical|panic|exception|failed|err:)\b/i.test(lower) || streamStr === 'stderr') {
        level = 'error';
        levelLabel = 'ERROR';
      } else if (/\b(warn|warning)\b/i.test(lower)) {
        level = 'warn';
        levelLabel = 'WARN';
      } else if (/\b(info|started|listening|healthy|success|ready|http\/1\.1" 200)\b/i.test(lower)) {
        level = 'info';
        levelLabel = 'INFO';
      } else if (/\b(debug|trace)\b/i.test(lower)) {
        level = 'debug';
        levelLabel = 'DEBUG';
      }
    }

    return {
      timestamp: timestampStr,
      level,
      levelLabel,
      caller,
      stream: streamStr,
      message,
      raw: entry.line,
    };
  };

  const handleCopyLine = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const getLevelBadge = (level: string, label: string) => {
    switch (level) {
      case 'error':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 uppercase flex-shrink-0">
            {label || 'ERROR'}
          </span>
        );
      case 'warn':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25 uppercase flex-shrink-0">
            {label || 'WARN'}
          </span>
        );
      case 'info':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase flex-shrink-0">
            {label || 'INFO'}
          </span>
        );
      case 'debug':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono text-zinc-400 bg-white/[0.05] border border-white/10 uppercase flex-shrink-0">
            {label || 'DEBUG'}
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono text-text-secondary/70 bg-white/[0.04] border border-white/[0.06] uppercase flex-shrink-0">
            {label || 'LOG'}
          </span>
        );
    }
  };

  return (
    <div className="bg-[#050608] border border-border/60 rounded overflow-hidden flex flex-col">
      {/* Terminal Toolbar */}
      {showWrapToggle && (
        <div className="px-3 py-1.5 bg-surface/80 border-b border-border/50 flex items-center justify-between text-xxs font-mono text-text-secondary select-none">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-accent/80 inline-block animate-pulse" />
            <span className="text-text-secondary/80">Loki Stream Terminal</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setWrapLines(!wrapLines)}
              className={clsx(
                'flex items-center space-x-1 px-2 py-0.5 rounded transition-colors',
                wrapLines ? 'bg-white/10 text-text-primary' : 'hover:bg-white/5 text-text-secondary'
              )}
              title="Toggle line wrapping"
            >
              {wrapLines ? <WrapText className="w-3 h-3 text-accent" /> : <AlignLeft className="w-3 h-3" />}
              <span>{wrapLines ? 'Wrap On' : 'Wrap Off'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Terminal Output Area */}
      <div
        className={clsx(
          'p-3 font-mono text-xs overflow-y-auto leading-relaxed select-text divide-y divide-white/[0.02]',
          !wrapLines && 'overflow-x-auto'
        )}
        style={{ maxHeight }}
      >
        {logs.map((entry, idx) => {
          const parsed = parseLogLine(entry);
          const isCopied = copiedIndex === idx;

          return (
            <div
              key={idx}
              className="py-1 px-1.5 hover:bg-white/[0.03] transition-colors rounded group flex items-start space-x-2.5 text-xs font-mono"
            >
              {/* Line Index & Timestamp (Deduped) */}
              <div className="flex items-center space-x-2 flex-shrink-0 select-none">
                <span className="text-[10px] text-text-secondary/40 font-mono w-6 text-right">
                  {idx + 1}
                </span>
                {parsed.timestamp && (
                  <span className="text-[11px] font-mono text-text-secondary/70">
                    {parsed.timestamp}
                  </span>
                )}
              </div>

              {/* Log Level Badge */}
              <div className="flex-shrink-0 select-none">
                {getLevelBadge(parsed.level, parsed.levelLabel)}
              </div>

              {/* Caller / Stream Identifier (if present) */}
              {parsed.caller && (
                <span className="text-[11px] font-mono text-text-secondary/60 flex-shrink-0 select-none hidden sm:inline">
                  [{parsed.caller}]
                </span>
              )}

              {/* Clean Message Body */}
              <div
                className={clsx(
                  'flex-1 text-xs font-mono min-w-0',
                  wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
                  parsed.level === 'error'
                    ? 'text-rose-200/90'
                    : parsed.level === 'warn'
                    ? 'text-amber-200/90'
                    : 'text-text-primary/90'
                )}
              >
                {parsed.message}
              </div>

              {/* Quick Copy Action on hover */}
              <button
                type="button"
                onClick={() => handleCopyLine(parsed.message, idx)}
                className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-text-primary transition-opacity flex-shrink-0 select-none"
                title="Copy log message"
              >
                {isCopied ? <Check className="w-3 h-3 text-status-healthy" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
