import { useState, useEffect } from "react";
import { Bell, Search, User, LogOut, Settings, Shield, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import notificationService, { Notification, NotificationDetailResponseData } from "../../services/notificationService";
import { authService } from "../../services/authService";

type AuditPayload = {
  source?: string;
  prfNo?: string;
  changes?: Record<string, unknown>;
};

const tryParseJson = (value: string | null): unknown | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

const getAuditPayload = (value: string | null): AuditPayload | null => {
  const parsed = tryParseJson(value);
  if (!parsed || typeof parsed !== "object") return null;
  const rec = parsed as Record<string, unknown>;
  const changes = rec.changes;
  const changesObj = changes && typeof changes === "object" ? (changes as Record<string, unknown>) : undefined;
  return {
    source: typeof rec.source === "string" ? rec.source : undefined,
    prfNo: typeof rec.prfNo === "string" ? rec.prfNo : undefined,
    changes: changesObj,
  };
};

const formatFieldLabel = (field: string): string =>
  field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim();

const formatValue = (value: unknown): string => {
  if (value == null) return "—";
  if (typeof value === "string") return value.trim().length > 0 ? value.trim() : "—";
  if (typeof value === "number") return Number.isFinite(value) ? value.toString() : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<NotificationDetailResponseData | null>(null);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 60 seconds
    const intervalId = setInterval(fetchNotifications, 60000);
    return () => clearInterval(intervalId);
  }, []);

  const fetchNotifications = async () => {
    try {
      // Fetch both read and unread for the dropdown, but we only really care about unread count
      const result = await notificationService.getNotifications(false, 10);
      if (result.success && result.data) {
        setNotifications(result.data);
        setUnreadCount(result.data.filter((n: Notification) => !n.IsRead).length);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.NotificationID === notificationId ? { ...n, IsRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, IsRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const resolvePrfNoForNavigation = async (notification: Notification, audit: NotificationDetailResponseData["audit"]): Promise<string | null> => {
    const auditPayload = getAuditPayload(audit?.NewValues ?? null);
    if (auditPayload?.prfNo) return auditPayload.prfNo;

    if (notification.ReferenceID) {
      try {
        const resp = await fetch(`/api/prfs/${notification.ReferenceID}`, {
          headers: authService.getAuthHeaders()
        });
        if (resp.ok) {
          const payload: unknown = await resp.json();
          const data = payload as { success?: boolean; data?: { PRFNo?: string } };
          if (data.success && data.data?.PRFNo) return data.data.PRFNo;
        }
      } catch (error) {
        console.error('Failed to resolve PRF from notification ReferenceID:', error);
      }
    }

    const match = notification.Message.match(/\bPRF\s+([A-Za-z0-9_-]+)\b/);
    return match && match[1] ? match[1] : null;
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.IsRead) {
      handleMarkAsRead(notification.NotificationID);
    }

    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailData(null);
    try {
      const result = await notificationService.getNotificationDetail(notification.NotificationID);
      const payload = result as { success?: boolean; data?: NotificationDetailResponseData; message?: string };
      if (!payload.success || !payload.data) {
        throw new Error(payload.message || "Failed to load notification detail");
      }
      setDetailData(payload.data);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Failed to load notification detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      {/* Search */}
      <div className="flex items-center space-x-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search PRFs, budgets..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-4">
        {/* User Info */}
        <div className="hidden md:flex flex-col items-end text-sm">
          <span className="font-medium">{user?.firstName} {user?.lastName}</span>
          <div className="flex items-center gap-1 text-muted-foreground">
            {user?.role === 'admin' && <Shield className="h-3 w-3" />}
            <span className="text-xs">{user?.role} • {user?.department}</span>
          </div>
        </div>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between p-4 border-b">
              <h4 className="font-semibold">Notifications</h4>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                  onClick={handleMarkAllAsRead}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No notifications
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.NotificationID}
                      className={`p-4 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors ${!notification.IsRead ? 'bg-blue-50/30' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex gap-3">
                        <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${!notification.IsRead ? 'bg-blue-500' : 'bg-transparent'}`} />
                        <div className="flex-1 space-y-1">
                          <p className={`text-sm ${!notification.IsRead ? 'font-medium' : 'text-muted-foreground'}`}>
                            {notification.Title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.Message}
                          </p>
                          <p className="text-[10px] text-muted-foreground pt-1">
                            {new Date(notification.CreatedAt).toLocaleString('id-ID', {
                              timeZone: 'Asia/Jakarta',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <span className="hidden sm:inline">{user?.username}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user?.role === 'admin' && (
              <>
                <DropdownMenuItem onClick={handleSettings} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Notification Detail</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : detailError ? (
            <div className="text-sm text-red-600">{detailError}</div>
          ) : detailData ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">{detailData.notification.Title}</div>
                <div className="text-xs text-muted-foreground">{detailData.notification.Message}</div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(detailData.notification.CreatedAt).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </div>
              </div>

              <Separator />

              {detailData.audit ? (
                (() => {
                  const oldPayload = getAuditPayload(detailData.audit.OldValues);
                  const newPayload = getAuditPayload(detailData.audit.NewValues);
                  const oldChanges = oldPayload?.changes || {};
                  const newChanges = newPayload?.changes || {};
                  const keys = Array.from(new Set([...Object.keys(oldChanges), ...Object.keys(newChanges)])).sort();
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium">
                          PRF {newPayload?.prfNo || oldPayload?.prfNo || detailData.notification.ReferenceID || "-"}
                        </div>
                      </div>
                      {keys.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No change detail available.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="min-w-[180px]">Field</TableHead>
                                <TableHead className="min-w-[220px]">Old</TableHead>
                                <TableHead className="min-w-[220px]">New</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {keys.map((k) => (
                                <TableRow key={k}>
                                  <TableCell className="font-medium">{formatFieldLabel(k)}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{formatValue(oldChanges[k])}</TableCell>
                                  <TableCell className="text-xs">{formatValue(newChanges[k])}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="text-sm text-muted-foreground">
                  Change details are not available for this notification.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                {detailData.notification.ReferenceType === "PRF" && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const prfNo = await resolvePrfNoForNavigation(detailData.notification, detailData.audit);
                      if (prfNo) navigate(`/prf?search=${encodeURIComponent(prfNo)}`);
                      else navigate("/prf");
                      setDetailOpen(false);
                    }}
                  >
                    View PRF
                  </Button>
                )}
                <Button onClick={() => setDetailOpen(false)}>Close</Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No data.</div>
          )}
        </DialogContent>
      </Dialog>
    </header>
  );
}
