import { useQuery } from "@tanstack/react-query";
import { Activity, Columns3, Film, LayoutDashboard, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../lib/api";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/videos", label: "Videos", icon: Film, end: false },
  { to: "/jobs", label: "Tracking runs", icon: Activity, end: false },
  { to: "/compare", label: "Compare trackers", icon: Columns3, end: false },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-9 w-9 rounded-lg bg-gradient-to-br from-accent/25 to-accent/5 border border-accent/30 grid place-items-center">
        <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden>
          <path d="M2 19h28" stroke="rgb(var(--signal))" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 19l2.5-6h11l2.5 6" fill="none" stroke="rgb(var(--accent))" strokeWidth="2" strokeLinejoin="round" />
          <path d="M14 13V8h4l1 5" fill="none" stroke="rgb(var(--accent))" strokeWidth="2" strokeLinejoin="round" />
          <path d="M5 24c2.5 1.5 4.5 1.5 7 0s4.5-1.5 7 0 4.5 1.5 7 0" fill="none" stroke="rgb(var(--slate))" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <div className="leading-tight">
        <div className="font-semibold tracking-wide text-[15px]">Seawatch</div>
        <div className="text-2xs text-slate">Maritime vessel tracking</div>
      </div>
    </div>
  );
}

function SystemStatus() {
  const { data, isError } = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 15000, retry: false });
  const items = isError
    ? [{ k: "API", v: "Offline", bad: true }]
    : data
      ? [
          { k: "Database", v: data.database === "connected" ? "Online" : "Offline", bad: data.database !== "connected" },
          { k: "Device", v: data.device.toUpperCase(), bad: false },
          { k: "Model", v: data.model_found ? "best.pt" : "Missing", bad: !data.model_found },
        ]
      : [];
  return (
    <div className="rounded-lg border border-line bg-deep/50 p-3 flex flex-col gap-2">
      <div className="eyebrow">System</div>
      {items.length === 0 && <div className="skeleton h-4 w-24" />}
      {items.map((i) => (
        <div key={i.k} className="flex items-center justify-between text-xs">
          <span className="text-slate">{i.k}</span>
          <span className={`flex items-center gap-1.5 mono ${i.bad ? "text-port" : "text-fog"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${i.bad ? "bg-port" : "bg-starboard"}`} />
            {i.v}
          </span>
        </div>
      ))}
    </div>
  );
}

function ActiveBadge() {
  const { data } = useQuery({ queryKey: ["summary"], queryFn: api.summary, refetchInterval: 5000 });
  const n = data ? data.jobs.running + data.jobs.queued : 0;
  if (!n) return null;
  return <span className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-accent/15 text-accent text-2xs mono grid place-items-center">{n}</span>;
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-16 px-4 flex items-center border-b border-line"><Logo /></div>
      <nav className="flex flex-col gap-1 p-3">
        <div className="eyebrow px-2.5 pb-1.5">Workspace</div>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                isActive ? "bg-accent/10 text-accent" : "text-slate hover:text-fog hover:bg-deck/60"
              }`}>
            <Icon size={17} strokeWidth={2} />
            {label}
            {to === "/jobs" && <ActiveBadge />}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto p-3 flex flex-col gap-3">
        <SystemStatus />
        <div className="px-1 text-2xs text-slate leading-relaxed">
          YOLOv8s · ByteTrack · BoT-SORT <span className="text-signal">+ horizon H-CMC</span>
        </div>
      </div>
    </div>
  );
}

export default function Shell() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex h-full">
      <aside className="hidden lg:block w-64 shrink-0 border-r border-line bg-hull/60 backdrop-blur">
        <Sidebar />
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-30 bg-deep/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <aside className="w-72 max-w-[85vw] h-full bg-hull border-r border-line animate-in" onClick={(e) => e.stopPropagation()}>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden h-14 shrink-0 border-b border-line flex items-center justify-between px-4 bg-hull/60 backdrop-blur">
          <Logo />
          <button className="btn btn-ghost btn-icon" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="text-slate mt-1 max-w-2xl">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Horizontal padding shared by every page body. */
export const PAGE = "px-4 sm:px-6 lg:px-8 pb-10 flex flex-col gap-5";
