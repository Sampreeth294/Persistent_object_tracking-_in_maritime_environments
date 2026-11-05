import { useQuery } from "@tanstack/react-query";
import { Activity, Film, LayoutGrid } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../lib/api";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/videos", label: "Videos", icon: Film, end: false },
  { to: "/jobs", label: "Tracking runs", icon: Activity, end: false },
];

function SystemStrip() {
  const { data, isError } = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 15000, retry: false });
  const items = isError
    ? [{ k: "API", v: "offline", bad: true }]
    : data
      ? [
          { k: "DB", v: data.database === "connected" ? "online" : "offline", bad: data.database !== "connected" },
          { k: "DEVICE", v: data.device.toUpperCase(), bad: false },
          { k: "MODEL", v: data.model_found ? "best.pt" : "missing", bad: !data.model_found },
        ]
      : [];
  return (
    <div className="flex items-center gap-4 mono text-2xs">
      {items.map((i) => (
        <span key={i.k} className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${i.bad ? "bg-port" : "bg-starboard"}`} />
          <span className="text-slate">{i.k}</span>
          <span className={i.bad ? "text-port" : "text-fog"}>{i.v}</span>
        </span>
      ))}
    </div>
  );
}

export default function Shell() {
  return (
    <div className="flex h-full">
      <aside className="w-52 shrink-0 border-r border-line bg-hull/60 flex flex-col">
        <div className="h-12 px-4 flex items-center gap-2.5 border-b border-line">
          <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
            <path d="M3 17h26" stroke="rgb(var(--slate))" strokeWidth="1.5" />
            <rect x="10" y="10" width="12" height="9" fill="none" stroke="rgb(var(--signal))" strokeWidth="2" />
          </svg>
          <div className="leading-tight">
            <div className="font-semibold tracking-wide">SEAWATCH</div>
            <div className="text-2xs text-slate mono">vessel tracking</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 h-8 px-2.5 rounded border-l-2 transition-colors ${
                  isActive ? "border-signal bg-deck text-fog" : "border-transparent text-slate hover:text-fog hover:bg-deck/50"
                }`
              }
            >
              <Icon size={15} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto p-4 text-2xs text-slate leading-relaxed">
          YOLOv8s · ByteTrack · BoT-SORT
          <br />
          <span className="text-signal/80">+ horizon-guided H-CMC</span>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-12 shrink-0 border-b border-line flex items-center justify-end px-5">
          <SystemStrip />
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 px-6 pt-6 pb-4">
      <div>
        <h1 className="text-lg font-medium tracking-tight">{title}</h1>
        {sub && <p className="text-slate mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
