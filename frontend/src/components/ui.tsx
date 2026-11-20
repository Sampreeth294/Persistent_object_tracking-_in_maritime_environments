import { AlertTriangle, CheckCircle2, Inbox, X, XCircle, type LucideIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { JobStatus } from "../lib/api";
import { idColour, vesselTag } from "../lib/format";

/* ------------------------------------------------------------------ badges */

const STATUS_STYLE: Record<JobStatus, string> = {
  queued: "text-slate bg-slate/10 border-slate/25",
  running: "text-accent bg-accent/10 border-accent/30",
  completed: "text-starboard bg-starboard/10 border-starboard/30",
  failed: "text-port bg-port/10 border-port/30",
  cancelled: "text-slate bg-transparent border-line",
};

export function StatusPill({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full border text-xs font-medium capitalize ${STATUS_STYLE[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${status === "running" ? "animate-pulse" : ""}`} />
      {status}
    </span>
  );
}

const TRACKER_STYLE: Record<string, string> = {
  horizon: "text-signal bg-signal/10 border-signal/30",
  botsort: "text-sky bg-sky/10 border-sky/25",
  bytetrack: "text-fog/80 bg-fog/5 border-line",
};

export function TrackerBadge({ name }: { name: string }) {
  return (
    <span className={`inline-flex items-center h-6 px-2 rounded-md border mono text-xs ${TRACKER_STYLE[name] ?? TRACKER_STYLE.bytetrack}`}>
      {name}
    </span>
  );
}

export function VesselTag({ id, active = false }: { id: number; active?: boolean }) {
  const c = idColour(id);
  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 pl-1.5 pr-2 rounded-md mono text-xs transition-colors"
      style={{ background: active ? `${c}33` : `${c}10`, boxShadow: `inset 0 0 0 1px ${c}${active ? "" : "55"}` }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
      {vesselTag(id)}
    </span>
  );
}

/* ------------------------------------------------------------------ layout */

export function Panel({ title, sub, right, children, className = "" }: {
  title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <header className="panel-head">
          <div className="min-w-0">
            <div className="truncate">{title}</div>
            {sub && <div className="panel-sub mt-0.5">{sub}</div>}
          </div>
          {right && <div className="shrink-0 flex items-center gap-2 text-xs font-normal text-slate">{right}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

const TONE = { signal: "text-signal", port: "text-port", starboard: "text-starboard", accent: "text-accent" } as const;
type Tone = keyof typeof TONE;

export function Readout({ label, value, unit, tone }: { label: string; value: ReactNode; unit?: string; tone?: Tone }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className="label truncate">{label}</span>
      <span className={`mono text-xl font-medium leading-none ${tone ? TONE[tone] : "text-fog"}`}>
        {value}
        {unit && <span className="text-slate text-xs font-normal ml-1">{unit}</span>}
      </span>
    </div>
  );
}

/** Big number card with an icon, used for top-of-page metrics. */
export function StatCard({ label, value, icon: Icon, tone = "accent", hint }: {
  label: string; value: ReactNode; icon: LucideIcon; tone?: Tone; hint?: ReactNode;
}) {
  const bg = { accent: "bg-accent/10", signal: "bg-signal/10", port: "bg-port/10", starboard: "bg-starboard/10" }[tone];
  return (
    <div className="panel p-4 flex items-start gap-3.5">
      <span className={`h-10 w-10 shrink-0 rounded-lg grid place-items-center ${bg} ${TONE[tone]}`}>
        <Icon size={19} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="label">{label}</div>
        <div className="mono text-2xl font-semibold mt-1 leading-none">{value}</div>
        {hint && <div className="text-2xs text-slate mt-1.5 truncate">{hint}</div>}
      </div>
    </div>
  );
}

export function ProgressLine({ value, status }: { value: number; status: JobStatus }) {
  const colour = status === "failed" ? "bg-port" : status === "completed" ? "bg-starboard" : status === "cancelled" ? "bg-slate/50" : "bg-accent";
  return (
    <div className="h-1.5 w-full min-w-16 bg-deck rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${colour} transition-[width] duration-500`} style={{ width: `${Math.min(100, value * 100)}%` }} />
    </div>
  );
}

export function Empty({ title, icon: Icon = Inbox, children, action }: {
  title: string; icon?: LucideIcon; children?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 px-6 py-12">
      <span className="h-12 w-12 rounded-full bg-deck grid place-items-center text-slate"><Icon size={22} /></span>
      <div className="text-fog font-medium">{title}</div>
      {children && <div className="text-slate max-w-md leading-relaxed">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorLine({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg text-sm text-port border border-port/30 bg-port/10">
      <XCircle size={16} className="mt-0.5 shrink-0" />
      <span className="break-words min-w-0">{msg}</span>
    </div>
  );
}

export function Notice({ children, tone = "signal" }: { children: ReactNode; tone?: "signal" | "accent" }) {
  const cls = tone === "signal" ? "border-signal/35 bg-signal/10 [&_svg]:text-signal" : "border-accent/30 bg-accent/10 [&_svg]:text-accent";
  return (
    <div className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg text-sm border ${cls}`}>
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 p-6 text-slate">
      <span className="h-4 w-4 rounded-full border-2 border-line border-t-accent animate-spin" />
      {label}
    </div>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({ title, onClose, children, footer, width = "max-w-lg" }: {
  title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-deep/75 backdrop-blur-sm p-0 sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal className={`panel w-full ${width} max-h-[92vh] flex flex-col animate-in rounded-b-none sm:rounded-b-xl`}
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <span className="text-base">{title}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-line flex justify-end gap-2 bg-deck/20">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** In-app replacement for window.confirm(). */
export function ConfirmDialog({ title, children, confirmLabel = "Delete", danger = true, busy, onConfirm, onClose }: {
  title: string; children: ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose} width="max-w-md"
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className={`btn ${danger ? "btn-danger-solid" : "btn-primary"}`} disabled={busy} onClick={onConfirm}>
          {busy && <span className="h-3.5 w-3.5 rounded-full border-2 border-deep/30 border-t-deep animate-spin" />}
          {confirmLabel}
        </button>
      </>}>
      <div className="p-4 text-slate leading-relaxed">{children}</div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ toasts */

type Toast = { id: number; text: string; kind: "ok" | "error" };
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, kind: Toast["kind"] = "ok") {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, text, kind }];
  emit();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit(); }, 4000);
}

export function Toaster() {
  const list = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => toasts);
  const [, force] = useState(0);
  return createPortal(
    <div className="fixed z-50 bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 items-end pointer-events-none">
      {list.map((t) => (
        <div key={t.id} className="pointer-events-auto panel animate-in flex items-center gap-2.5 pl-3.5 pr-2 py-2.5 text-sm max-w-sm">
          {t.kind === "ok" ? <CheckCircle2 size={16} className="text-starboard shrink-0" /> : <XCircle size={16} className="text-port shrink-0" />}
          <span className="flex-1">{t.text}</span>
          <button className="btn btn-ghost btn-sm btn-icon" aria-label="Dismiss"
            onClick={() => { toasts = toasts.filter((x) => x.id !== t.id); emit(); force((n) => n + 1); }}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
