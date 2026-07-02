import { useState } from "react";
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
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "PRF Monitoring", href: "/prf", icon: FileText },
  { name: "Create PRF", href: "/prf/create", icon: Plus },
  { name: "Budget Overview", href: "/budget", icon: Wallet },
  { name: "COA Management", href: "/coa-management", icon: BookOpen },
  { name: "Alerts", href: "/alerts", icon: AlertTriangle },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(true);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
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
    <div className={cn(
      "relative flex flex-col overflow-hidden bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
      isCollapsed ? "w-16" : "w-64",
      className
    )}>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 z-0 flex justify-center",
          isCollapsed ? "bottom-14 px-1" : "bottom-24 px-3"
        )}
      >
        <img
          src="/sidebar-background.png"
          alt=""
          className={cn(
            "select-none object-contain object-bottom opacity-90",
            isCollapsed ? "w-10" : "w-36"
          )}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
        {!isCollapsed && (
          <h1 className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
            MTI ICT PO Monitoring
          </h1>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 p-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className={cn("relative z-10 flex-1 p-4 space-y-2", isCollapsed ? "pb-16" : "pb-28")}>
        {navBeforeAlerts.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
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

        <button
          type="button"
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
    </div>
  );
}
