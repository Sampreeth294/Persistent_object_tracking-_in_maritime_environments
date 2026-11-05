import type { ReactNode } from "react";
import type { JobStatus } from "../lib/api";
import { idColour, vesselTag } from "../lib/format";

const STATUS_STYLE: Record<JobStatus, string> = {
  queued: "text-slate border-line",
  running: "text-signal border-signal/50",
  completed: "text-starboard border-starboard/40",
  failed: "text-port border-port/50",
  cancelled: "text-slate border-line",
};

export function StatusPill({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 h-5 px-1.5 rounded-sm border mono text-2xs uppercase ${STATUS_STYLE[status]}`}>
      {status === "running" && <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse" />}
      {status}
    </span>
  );
}

export function VesselTag({ id, active = false }: { id: number; active?: boolean }) {
  const c = idColour(id);
  return (
    <span
      className="inline-flex items-center gap-1.5 h-5 pl-1 pr-1.5 rounded-sm mono text-xs"
      style={{ background: active ? `${c}33` : "transparent", boxShadow: `inset 0 0 0 1px ${c}${active ? "" : "66"}` }}
    >
      <span className="h-2.5 w-[3px] rounded-sm" style={{ background: c }} />
      {vesselTag(id)}
    </span>
  );
}

export function Panel({ title, right, children, className = "" }: {
  title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <header className="panel-head">
          <span>{title}</span>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Readout({ label, value, unit, tone }: {
  label: string; value: ReactNode; unit?: string; tone?: "signal" | "port" | "starboard";
}) {
  const toneClass = tone ? { signal: "text-signal", port: "text-port", starboard: "text-starboard" }[tone] : "text-fog";
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="label">{label}</span>
      <span className={`mono text-lg leading-none ${toneClass}`}>
        {value}
        {unit && <span className="text-slate text-xs ml-1">{unit}</span>}
      </span>
    </div>
  );
}

export function ProgressLine({ value, status }: { value: number; status: JobStatus }) {
  const colour = status === "failed" ? "bg-port" : status === "completed" ? "bg-starboard" : "bg-signal";
  return (
    <div className="h-[3px] w-full bg-line rounded-full overflow-hidden">
      <div className={`h-full ${colour} transition-[width] duration-500`} style={{ width: `${Math.min(100, value * 100)}%` }} />
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 px-4 py-8">
      <span className="text-fog">{title}</span>
      {children && <div className="text-slate max-w-md leading-relaxed">{children}</div>}
    </div>
  );
}

export function ErrorLine({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : String(error);
  return <div className="px-3 py-2 text-port mono text-xs border-l-2 border-port bg-port/5">{msg}</div>;
}
