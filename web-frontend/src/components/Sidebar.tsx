import { Link } from "@tanstack/react-router";
import { Activity, Container, Gauge, Settings, Terminal } from "lucide-react";
import { useWebSocket } from "../lib/ws";
import { cn } from "../lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: Gauge },
  { to: "/mcps", label: "MCPs", icon: Container },
  { to: "/logs", label: "Logs", icon: Terminal },
  { to: "/stats", label: "Stats", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const live = useWebSocket(() => {});

  return (
    <aside className="fixed left-0 top-0 z-30 h-full w-56 border-r border-morph-border bg-morph-panel flex flex-col">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-morph-border">
        <span className="text-lg font-bold tracking-tight">MORPH</span>
        <span className="text-xs text-morph-muted">Studio</span>
        <span
          className={cn(
            "ml-auto h-2 w-2 rounded-full",
            live ? "bg-green-400" : "bg-red-500",
          )}
        />
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-morph-muted transition-colors hover:bg-morph-bg hover:text-morph-text",
            )}
            activeProps={{
              className: "bg-morph-bg text-morph-text font-medium",
            }}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-morph-border text-[11px] text-morph-muted">
        v{/* version loaded dynamically */}
      </div>
    </aside>
  );
}
