import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";

export type NotifType = "trade" | "price" | "staking" | "system" | "security" | "promo";

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  icon?: string;
  data?: Record<string, any>;
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  refresh: () => void;
}

const API_BASE = process.env.EXPO_PUBLIC_API_BASE
  ? process.env.EXPO_PUBLIC_API_BASE
  : `https://${process.env["EXPO_PUBLIC_DOMAIN"] ?? "localhost:8080"}`;
const LOCAL_DISMISSED_KEY = "cryptox_notif_dismissed_v1";
const LOCAL_READ_KEY = "cryptox_notif_read_v1";
const POLL_INTERVAL_MS = 60_000;

const NotificationsContext = createContext<NotificationsContextValue>({
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markRead: () => {},
  markAllRead: () => {},
  deleteNotification: () => {},
  clearAll: () => {},
  refresh: () => {},
});

function mapRow(row: any, localRead: Set<string>, localDismissed: Set<string>): AppNotification | null {
  const sid = String(row.id);
  if (localDismissed.has(sid)) return null;
  return {
    id: sid,
    type: row.type as NotifType,
    title: row.title,
    body: row.body,
    timestamp: new Date(row.created_at).getTime(),
    read: row.read === true || row.read === "true" || localRead.has(sid),
    icon: row.icon ?? undefined,
  };
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const localRead = useRef<Set<string>>(new Set());
  const localDismissed = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function authHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (user?.id) h["x-user-id"] = user.id;
    return h;
  }

  const loadLocal = useCallback(async () => {
    try {
      const rawRead = await AsyncStorage.getItem(LOCAL_READ_KEY);
      const rawDismissed = await AsyncStorage.getItem(LOCAL_DISMISSED_KEY);
      if (rawRead) localRead.current = new Set(JSON.parse(rawRead));
      if (rawDismissed) localDismissed.current = new Set(JSON.parse(rawDismissed));
    } catch {}
  }, []);

  const persistLocal = useCallback(() => {
    AsyncStorage.setItem(LOCAL_READ_KEY, JSON.stringify([...localRead.current])).catch(() => {});
    AsyncStorage.setItem(LOCAL_DISMISSED_KEY, JSON.stringify([...localDismissed.current])).catch(() => {});
  }, []);

  const fetchFromServer = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rows: any[] = data.notifications ?? [];
      const mapped = rows
        .map((r) => mapRow(r, localRead.current, localDismissed.current))
        .filter((n): n is AppNotification => n !== null);
      setNotifications(mapped);
    } catch {
    }
  }, [user?.id]);

  const refresh = useCallback(() => {
    fetchFromServer();
  }, [fetchFromServer]);

  useEffect(() => {
    loadLocal().then(() => fetchFromServer());
    pollRef.current = setInterval(fetchFromServer, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user?.id]);

  const addNotification = useCallback((n: Omit<AppNotification, "id" | "timestamp" | "read">) => {
    const fake: AppNotification = {
      ...n,
      id: `local_${Date.now()}`,
      timestamp: Date.now(),
      read: false,
    };
    setNotifications((prev) => [fake, ...prev]);
  }, []);

  const markRead = useCallback(async (id: string) => {
    localRead.current.add(id);
    persistLocal();
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    if (user?.id && !id.startsWith("local_")) {
      try {
        await fetch(`${API_BASE}/api/notifications/${id}/read`, { method: "POST", headers: authHeaders() });
      } catch {}
    }
  }, [user?.id]);

  const markAllRead = useCallback(async () => {
    notifications.forEach((n) => localRead.current.add(n.id));
    persistLocal();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (user?.id) {
      try {
        await fetch(`${API_BASE}/api/notifications/read-all`, { method: "POST", headers: authHeaders() });
      } catch {}
    }
  }, [notifications, user?.id]);

  const deleteNotification = useCallback(async (id: string) => {
    localDismissed.current.add(id);
    persistLocal();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (user?.id && !id.startsWith("local_")) {
      try {
        await fetch(`${API_BASE}/api/notifications/${id}`, { method: "DELETE", headers: authHeaders() });
      } catch {}
    }
  }, [user?.id]);

  const clearAll = useCallback(async () => {
    notifications.forEach((n) => localDismissed.current.add(n.id));
    persistLocal();
    setNotifications([]);
    if (user?.id) {
      try {
        await fetch(`${API_BASE}/api/notifications`, { method: "DELETE", headers: authHeaders() });
      } catch {}
    }
  }, [notifications, user?.id]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, addNotification, markRead, markAllRead, deleteNotification, clearAll, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
