import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  FileText,
  Wallet,
  Settings,
  Menu,
  X,
  TrendingUp,
  AlertTriangle,
  Plus,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ListChecks
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import { fetchProntoQueue } from "@/components/immediate-action/prontoQueue";

const IMMEDIATE_ACTION_HREF = "/immediate-action";
const QUEUE_COUNT_REFRESH_MS = 5 * 60 * 1000;

/** Count for the Immediate Action badge; refreshed every few minutes and when the page is opened. */
function useImmediateActionCount(pathname: string): { total: number; rejected: number } {
  const [counts, setCounts] = useState({ total: 0, rejected: 0 });
  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      fetchProntoQueue(authService.getAuthHeaders(), controller.signal)
        .then((data) => setCounts({ total: data.counts.total, rejected: data.counts.rejected }))
        .catch(() => { /* the badge is optional; the page shows errors */ });
    };
    load();
    const timer = window.setInterval(load, QUEUE_COUNT_REFRESH_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [pathname === IMMEDIATE_ACTION_HREF]); // eslint-disable-line react-hooks/exhaustive-deps
  return counts;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "PRF Monitoring", href: "/prf", icon: FileText },
  { name: "Immediate Action", href: IMMEDIATE_ACTION_HREF, icon: ListChecks },
  { name: "Create PRF", href: "/prf/create", icon: Plus },
  { name: "Budget Overview", href: "/budget", icon: Wallet },
  { name: "COA Management", href: "/coa-management", icon: BookOpen },
  { name: "Alerts", href: "/alerts", icon: AlertTriangle },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  className?: string;
  mobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ className, mobile = false, onNavigate }: SidebarProps) {
  const [collapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem("merdeka.sidebar.collapsed") === "true"; } catch { return false; }
  });
  const isCollapsed = !mobile && collapsed;
  useEffect(() => {
    if (!mobile) { try { localStorage.setItem("merdeka.sidebar.collapsed", String(collapsed)); } catch { /* Storage can be unavailable. */ } }
  }, [collapsed, mobile]);
  const [reportsOpen, setReportsOpen] = useState(true);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queueCounts = useImmediateActionCount(location.pathname);
  
  // Filter navigation items based on user role
  const filteredNavigation = navigation.filter(item => {
    // Hide Settings from non-admin users
    if (item.href === '/settings' && user?.role !== 'admin') {
      return false;
    }
    return true;
  });

  const isReportsActive = location.pathname.startsWith("/reports");
  const alertsIndex = filteredNavigation.findIndex((item) => item.href === "/alerts");
  const navBeforeAlerts = alertsIndex >= 0 ? filteredNavigation.slice(0, alertsIndex) : filteredNavigation;
  const navFromAlerts = alertsIndex >= 0 ? filteredNavigation.slice(alertsIndex) : [];

  return (
    <aside aria-label="Main navigation" data-collapsed={isCollapsed} onClick={(event) => { if ((event.target as HTMLElement).closest("a")) onNavigate?.(); }} className={cn(
      "merdeka-sidebar relative flex flex-col overflow-hidden bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
      isCollapsed ? "w-[80px]" : "w-[240px]",
      className
    )}>
      <div
        aria-hidden="true"
        className={cn(
          "merdeka-sidebar-watermark pointer-events-none absolute inset-x-0 z-0 flex justify-center",
          isCollapsed ? "px-1" : "px-3"
        )}
      >
        <img
          src="/merdeka/branding/mbm-symbol.svg"
          alt=""
          className={cn(
            "select-none object-contain object-bottom opacity-[0.06]",
            isCollapsed ? "w-10" : "w-36"
          )}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
        <div className="merdeka-sidebar-brands"><img className="merdeka-sidebar-logo" src={isCollapsed ? "/merdeka/branding/mbm-symbol.svg" : "/merdeka/branding/mbm-logo.svg"} alt="Merdeka Battery Materials" />{!isCollapsed && <img className="merdeka-sidebar-mti-logo" src="/merdeka/branding/mti-corporate.svg" alt="Merdeka Tsingshan Indonesia" width="66" height="30" />}</div>
        <Button
          variant="ghost"
          size="sm"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
          hidden={mobile}
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 p-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </Button>
      </div>

      {!isCollapsed && <div className="merdeka-sidebar-caption">MTI ICT PO Monitoring</div>}
      {/* Navigation */}
      <nav className={cn("merdeka-navigation relative z-10 flex-1 p-4 space-y-2", isCollapsed ? "pb-16" : "pb-28")}>
        {navBeforeAlerts.map((item) => {
          const badge = item.href === IMMEDIATE_ACTION_HREF && queueCounts.total > 0 ? queueCounts.total : 0;
          const badgeTone = queueCounts.rejected > 0 ? "bg-red-600 text-white" : "bg-amber-500 text-white";
          return (
          <NavLink
            key={item.name}
            to={item.href}
            title={badge ? `${item.name} (${badge})` : item.name}
            aria-label={badge ? `${item.name}, ${badge} need action` : item.name}
            end
            className={({ isActive }) =>
              cn(
                "relative flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                isCollapsed && "justify-center space-x-0"
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span className="flex-1">{item.name}</span>}
            {badge > 0 && (
              isCollapsed
                ? <span aria-hidden="true" className={cn("absolute right-2 top-1.5 h-2.5 w-2.5 rounded-full", badgeTone)} />
                : <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-semibold leading-none", badgeTone)}>{badge}</span>
            )}
          </NavLink>
          );
        })}

        <button
          type="button"
          title="Reports"
          aria-label="Reports"
          aria-expanded={!isCollapsed && reportsOpen}
          onClick={() => {
            if (isCollapsed) {
              navigate("/reports/audit-log");
              return;
            }
            setReportsOpen((prev) => !prev);
          }}
          className={cn(
            "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            isReportsActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            isCollapsed && "justify-center space-x-0"
          )}
        >
          <TrendingUp className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left">Reports</span>
              {reportsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </>
          )}
        </button>

        {!isCollapsed && reportsOpen && (
          <NavLink
            to="/reports/audit-log"
            end
            className={({ isActive }) =>
              cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors pl-10",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )
            }
          >
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span>Audit Log</span>
          </NavLink>
        )}

        {navFromAlerts.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            title={item.name}
            aria-label={item.name}
            end
            className={({ isActive }) =>
              cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                isCollapsed && "justify-center space-x-0"
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span>{item.name}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
