import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { verifyTotp, normalizeBackupCode } from "../lib/totp";

export class TwoFactorRequiredError extends Error {
  constructor() {
    super("Two-factor authentication required");
    this.name = "TwoFactorRequiredError";
  }
}

export type AuthMethod = "email" | "google" | "apple" | "phone";

export interface LinkedAccount {
  method: AuthMethod;
  identifier: string;
  linkedAt: number;
}

export interface LoginEvent {
  at: number;
  method: AuthMethod;
  ip: string;
  userAgent?: string;
  status: "success" | "failed";
  reason?: string;
}

export interface User {
  id: string;
  displayName: string;
  email: string;
  phone?: string;
  avatar?: string;
  primaryMethod: AuthMethod;
  linkedAccounts: LinkedAccount[];
  createdAt: number;
  lastLogin: number;
  loginHistory?: LoginEvent[];
  notificationsEnabled: boolean;
  priceAlertsEnabled: boolean;
  twoFactorEnabled: boolean;
  totpSecret?: string;
  backupCodes?: string[];
  currency: string;
  language: string;
  isAdmin?: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isLoggedIn: boolean;
  register: (method: AuthMethod, data: RegisterData) => Promise<void>;
  login: (method: AuthMethod, data: LoginData) => Promise<void>;
  completeLoginWithTwoFactor: (method: AuthMethod, data: LoginData, code: string) => Promise<void>;
  verifyTwoFactorCode: (code: string) => boolean;
  consumeBackupCode: (code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  linkAccount: (method: AuthMethod, identifier: string) => Promise<void>;
  unlinkAccount: (method: AuthMethod) => Promise<void>;
  checkEmailExists: (email: string) => Promise<boolean>;
  setPassword: (password: string) => Promise<void>;
  linkGoogleToEmailAccount: (email: string, password: string, googleToken: string, displayName?: string) => Promise<void>;
}

export interface RegisterData {
  displayName?: string;
  email?: string;
  password?: string;
  phone?: string;
  googleToken?: string;
  appleToken?: string;
  otp?: string;
}

export interface LoginData {
  email?: string;
  password?: string;
  phone?: string;
  googleToken?: string;
  appleToken?: string;
  otp?: string;
}

const STORAGE_KEY = "cryptox_user_v1";
const USERS_DB_KEY = "cryptox_users_db_v1";
const API_BASE = process.env.EXPO_PUBLIC_API_BASE
  ? process.env.EXPO_PUBLIC_API_BASE
  : `https://${process.env["EXPO_PUBLIC_DOMAIN"] ?? "localhost:8080"}`;

const MAX_LOGIN_HISTORY = 50;

async function fetchClientInfo(): Promise<{ ip: string; userAgent: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/client-ip`);
    if (!res.ok) throw new Error("ip lookup failed");
    const data = await res.json();
    return { ip: String(data.ip ?? "unknown"), userAgent: String(data.userAgent ?? "") };
  } catch {
    return { ip: "unknown", userAgent: "" };
  }
}

async function fetchIsAdmin(userId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/check-admin`, {
      headers: { "x-user-id": userId },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.isAdmin;
  } catch {
    return false;
  }
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isLoggedIn: false,
  register: async () => {},
  login: async () => {},
  completeLoginWithTwoFactor: async () => {},
  verifyTwoFactorCode: () => false,
  consumeBackupCode: async () => false,
  logout: async () => {},
  updateUser: async () => {},
  linkAccount: async () => {},
  unlinkAccount: async () => {},
  linkGoogleToEmailAccount: async () => {},
  setPassword: async () => {},
  checkEmailExists: async () => false,
});

const METHOD_LABEL: Record<AuthMethod, string> = {
  email: "email",
  google: "Google account",
  apple: "Apple account",
  phone: "phone number",
};

function generateId(): string {
  return `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function getUsersDb(): Promise<Record<string, any>> {
  try {
    const raw = await AsyncStorage.getItem(USERS_DB_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function saveUsersDb(db: Record<string, any>): Promise<void> {
  await AsyncStorage.setItem(USERS_DB_KEY, JSON.stringify(db));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const stored: User = JSON.parse(raw);
          setUser(stored);
          const isAdmin = await fetchIsAdmin(stored.id);
          if (isAdmin !== !!stored.isAdmin) {
            const updated = { ...stored, isAdmin };
            setUser(updated);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const saveUser = useCallback(async (u: User | null) => {
    setUser(u);
    if (u) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
    const db = await getUsersDb();
    return Object.values(db).some((u: any) => u.email?.toLowerCase() === email.toLowerCase());
  }, []);

  const register = useCallback(async (method: AuthMethod, data: RegisterData) => {
    const db = await getUsersDb();
    const allUsers = Object.values(db) as any[];

    const emailLower = data.email?.toLowerCase();
    const phoneNorm = data.phone?.trim();

    if (emailLower) {
      const owner = allUsers.find((u) =>
        u.email?.toLowerCase() === emailLower ||
        u.linkedAccounts?.some((a: any) => a.method === "email" && a.identifier?.toLowerCase() === emailLower)
      );
      if (owner) {
        if (owner.primaryMethod === "email") {
          throw new Error("An account with this email already exists. Please sign in.");
        }
        throw new Error("This email is already linked to another account. Please use a different email.");
      }
    }
    if (phoneNorm) {
      const owner = allUsers.find((u) =>
        u.phone === phoneNorm ||
        u.linkedAccounts?.some((a: any) => a.method === "phone" && a.identifier === phoneNorm)
      );
      if (owner) {
        if (owner.primaryMethod === "phone") {
          throw new Error("An account with this phone number already exists. Please sign in.");
        }
        throw new Error("This phone number is already linked to another account.");
      }
    }
    if (data.googleToken) {
      const owner = allUsers.find((u) =>
        u.linkedAccounts?.some((a: any) => a.method === "google" && a.identifier === data.googleToken)
      );
      if (owner) throw new Error("This Google account is already linked. Please sign in with Google instead.");
    }
    if (data.appleToken) {
      const owner = allUsers.find((u) =>
        u.linkedAccounts?.some((a: any) => a.method === "apple" && a.identifier === data.appleToken)
      );
      if (owner) throw new Error("This Apple account is already linked. Please sign in with Apple instead.");
    }

    if (method === "email") {
      if (!data.email || !data.password) throw new Error("Email and password required");
      if (data.password.length < 6) throw new Error("Password must be at least 6 characters");
    }

    const newUser: User = {
      id: generateId(),
      displayName: data.displayName || (data.email ? data.email.split("@")[0] : "Universe X User"),
      email: data.email ?? "",
      phone: data.phone,
      primaryMethod: method,
      linkedAccounts: [{
        method,
        identifier:
          method === "google" ? (data.googleToken ?? data.email ?? method) :
          method === "apple"  ? (data.appleToken  ?? data.email ?? method) :
          method === "phone"  ? (data.phone ?? method) :
                                (data.email ?? method),
        linkedAt: Date.now(),
      }],
      createdAt: Date.now(),
      lastLogin: Date.now(),
      notificationsEnabled: true,
      priceAlertsEnabled: true,
      twoFactorEnabled: false,
      currency: "USD",
      language: "en",
    };

    const info = await fetchClientInfo();
    const firstEvent: LoginEvent = { at: Date.now(), method, ip: info.ip, userAgent: info.userAgent, status: "success", reason: "Account created" };
    newUser.loginHistory = [firstEvent];

    db[newUser.id] = { ...newUser, passwordHash: data.password ?? "" };
    await saveUsersDb(db);
    const isAdmin = await fetchIsAdmin(newUser.id);
    await saveUser({ ...newUser, isAdmin });
  }, [saveUser]);

  const findUserForLogin = useCallback(async (method: AuthMethod, data: LoginData): Promise<any | null> => {
    const db = await getUsersDb();
    if (method === "email") {
      if (!data.email || !data.password) throw new Error("Email and password required");
      const entry = Object.values(db).find((u: any) =>
        u.email?.toLowerCase() === data.email!.toLowerCase() && u.passwordHash === data.password
      ) as any;
      if (!entry) throw new Error("Invalid email or password");
      return entry;
    }
    if (method === "google" || method === "apple") {
      const identifier = data.googleToken ?? data.appleToken ?? "";
      const existing = Object.values(db).find((u: any) =>
        u.linkedAccounts?.some((a: any) => a.method === method && a.identifier === identifier)
      ) as any;
      if (!existing) throw new Error("No account linked to this " + method + " account. Please register first.");
      return existing;
    }
    if (method === "phone") {
      if (!data.phone) throw new Error("Phone number required");
      const existing = Object.values(db).find((u: any) =>
        u.linkedAccounts?.some((a: any) => a.method === "phone" && a.identifier === data.phone)
      ) as any;
      if (!existing) throw new Error("No account found for this phone number.");
      return existing;
    }
    throw new Error("Invalid auth method");
  }, []);

  const finalizeLogin = useCallback(async (entry: any, method: AuthMethod, reason?: string) => {
    const db = await getUsersDb();
    const info = await fetchClientInfo();
    const event: LoginEvent = { at: Date.now(), method, ip: info.ip, userAgent: info.userAgent, status: "success", reason };
    const prevHistory: LoginEvent[] = Array.isArray(entry.loginHistory) ? entry.loginHistory : [];
    const nextHistory = [event, ...prevHistory].slice(0, MAX_LOGIN_HISTORY);
    const u: User = { ...entry, lastLogin: event.at, loginHistory: nextHistory };
    delete (u as any).passwordHash;
    db[u.id] = { ...db[u.id], lastLogin: event.at, loginHistory: nextHistory };
    await saveUsersDb(db);
    const isAdmin = await fetchIsAdmin(u.id);
    await saveUser({ ...u, isAdmin });
  }, [saveUser]);

  const recordFailedLogin = useCallback(async (method: AuthMethod, identifier: string | undefined, reason: string) => {
    if (!identifier) return;
    const db = await getUsersDb();
    const idLower = identifier.toLowerCase();
    const entry = Object.values(db).find((u: any) =>
      u.email?.toLowerCase() === idLower ||
      u.phone === identifier ||
      u.linkedAccounts?.some((a: any) => a.identifier === identifier || a.identifier?.toLowerCase() === idLower)
    ) as any;
    if (!entry) return;
    const info = await fetchClientInfo();
    const event: LoginEvent = { at: Date.now(), method, ip: info.ip, userAgent: info.userAgent, status: "failed", reason };
    const prevHistory: LoginEvent[] = Array.isArray(entry.loginHistory) ? entry.loginHistory : [];
    const nextHistory = [event, ...prevHistory].slice(0, MAX_LOGIN_HISTORY);
    db[entry.id] = { ...db[entry.id], loginHistory: nextHistory };
    await saveUsersDb(db);
  }, []);

  const login = useCallback(async (method: AuthMethod, data: LoginData) => {
    let entry: any;
    try {
      entry = await findUserForLogin(method, data);
    } catch (e: any) {
      const ident = data.email ?? data.phone ?? data.googleToken ?? data.appleToken;
      await recordFailedLogin(method, ident, e?.message ?? "Login failed");
      throw e;
    }
    if (entry?.twoFactorEnabled && entry?.totpSecret) {
      throw new TwoFactorRequiredError();
    }
    await finalizeLogin(entry, method);
  }, [findUserForLogin, finalizeLogin, recordFailedLogin]);

  const completeLoginWithTwoFactor = useCallback(async (method: AuthMethod, data: LoginData, code: string) => {
    let entry: any;
    try {
      entry = await findUserForLogin(method, data);
    } catch (e: any) {
      const ident = data.email ?? data.phone ?? data.googleToken ?? data.appleToken;
      await recordFailedLogin(method, ident, e?.message ?? "Login failed");
      throw e;
    }
    if (!entry?.twoFactorEnabled || !entry?.totpSecret) {
      await finalizeLogin(entry, method);
      return;
    }
    const cleaned = code.replace(/\s/g, "");
    const totpOk = /^\d{6}$/.test(cleaned) && verifyTotp(entry.totpSecret, cleaned);
    if (totpOk) {
      await finalizeLogin(entry, method, "2FA: TOTP");
      return;
    }
    const normBackup = normalizeBackupCode(code);
    const backupCodes: string[] = Array.isArray(entry.backupCodes) ? entry.backupCodes : [];
    const idx = backupCodes.findIndex((c) => normalizeBackupCode(c) === normBackup);
    if (idx >= 0 && normBackup.length > 0) {
      const remaining = [...backupCodes.slice(0, idx), ...backupCodes.slice(idx + 1)];
      const db = await getUsersDb();
      db[entry.id] = { ...db[entry.id], backupCodes: remaining };
      await saveUsersDb(db);
      await finalizeLogin({ ...entry, backupCodes: remaining }, method, "2FA: backup code");
      return;
    }
    const ident = data.email ?? data.phone ?? data.googleToken ?? data.appleToken;
    await recordFailedLogin(method, ident, "2FA: invalid code");
    throw new Error("Invalid authentication code. Try again or use a backup code.");
  }, [findUserForLogin, finalizeLogin, recordFailedLogin]);

  const verifyTwoFactorCode = useCallback((code: string): boolean => {
    if (!user?.totpSecret) return false;
    const cleaned = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(cleaned)) return false;
    return verifyTotp(user.totpSecret, cleaned);
  }, [user]);

  const consumeBackupCode = useCallback(async (code: string): Promise<boolean> => {
    if (!user?.backupCodes) return false;
    const norm = normalizeBackupCode(code);
    const idx = user.backupCodes.findIndex((c) => normalizeBackupCode(c) === norm);
    if (idx < 0) return false;
    const remaining = [...user.backupCodes.slice(0, idx), ...user.backupCodes.slice(idx + 1)];
    const updated: User = { ...user, backupCodes: remaining };
    const db = await getUsersDb();
    db[user.id] = { ...db[user.id], backupCodes: remaining };
    await saveUsersDb(db);
    await saveUser(updated);
    return true;
  }, [user, saveUser]);

  const logout = useCallback(async () => {
    await saveUser(null);
  }, [saveUser]);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    const db = await getUsersDb();
    db[user.id] = { ...db[user.id], ...updates };
    await saveUsersDb(db);
    await saveUser(updated);
  }, [user, saveUser]);

  const setPassword = useCallback(async (password: string) => {
    if (!user) throw new Error("Not logged in");
    if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");
    const db = await getUsersDb();
    db[user.id] = { ...db[user.id], passwordHash: password };
    await saveUsersDb(db);
  }, [user]);

  const linkAccount = useCallback(async (method: AuthMethod, identifier: string) => {
    if (!user) throw new Error("Not logged in");
    const alreadyLinked = user.linkedAccounts.some((a) => a.method === method);
    if (alreadyLinked) throw new Error(`${METHOD_LABEL[method]} is already linked`);

    // Make sure no OTHER user is using this identifier (or has it as primary email/phone)
    const db = await getUsersDb();
    const allUsers = Object.values(db) as any[];
    const idLower = identifier.toLowerCase();
    const conflict = allUsers.find((u) => u.id !== user.id && (
      (method === "email" && (u.email?.toLowerCase() === idLower || u.linkedAccounts?.some((a: any) => a.method === "email" && a.identifier?.toLowerCase() === idLower))) ||
      (method === "phone" && (u.phone === identifier || u.linkedAccounts?.some((a: any) => a.method === "phone" && a.identifier === identifier))) ||
      ((method === "google" || method === "apple") && u.linkedAccounts?.some((a: any) => a.method === method && a.identifier === identifier))
    ));
    if (conflict) {
      throw new Error(`This ${METHOD_LABEL[method]} is already linked to another account.`);
    }

    const updated: User = {
      ...user,
      linkedAccounts: [...user.linkedAccounts, { method, identifier, linkedAt: Date.now() }],
    };
    db[user.id] = { ...db[user.id], linkedAccounts: updated.linkedAccounts };
    await saveUsersDb(db);
    await saveUser(updated);
  }, [user, saveUser]);

  const linkGoogleToEmailAccount = useCallback(async (email: string, password: string, googleToken: string, displayName?: string) => {
    if (!email || !password || !googleToken) throw new Error("Missing required fields.");
    const db = await getUsersDb();
    const emailLower = email.toLowerCase();
    const entry = Object.values(db).find((u: any) =>
      (u.email?.toLowerCase() === emailLower ||
        u.linkedAccounts?.some((a: any) => a.method === "email" && a.identifier?.toLowerCase() === emailLower))
    ) as any;
    if (!entry) throw new Error("No account found with this email.");
    if (entry.passwordHash !== password) throw new Error("Incorrect password.");
    const googleOwner = Object.values(db).find((u: any) =>
      u.linkedAccounts?.some((a: any) => a.method === "google" && a.identifier === googleToken)
    ) as any;
    if (googleOwner && googleOwner.id !== entry.id) {
      throw new Error("This Google account is already linked to a different Universe X account.");
    }
    const alreadyLinked = entry.linkedAccounts?.some((a: any) => a.method === "google" && a.identifier === googleToken);
    const nextLinked = alreadyLinked
      ? entry.linkedAccounts
      : [...(entry.linkedAccounts ?? []), { method: "google" as const, identifier: googleToken, linkedAt: Date.now() }];
    const nextDisplayName = entry.displayName || displayName || entry.displayName;
    db[entry.id] = { ...entry, linkedAccounts: nextLinked, displayName: nextDisplayName };
    await saveUsersDb(db);
    await finalizeLogin({ ...entry, linkedAccounts: nextLinked, displayName: nextDisplayName }, "google", "Linked Google to email account");
  }, [finalizeLogin]);

  const unlinkAccount = useCallback(async (method: AuthMethod) => {
    if (!user) throw new Error("Not logged in");
    if (user.linkedAccounts.length <= 1) {
      throw new Error("You can't remove your only sign-in method. Link another method first.");
    }
    const remaining = user.linkedAccounts.filter((a) => a.method !== method);
    // If removing primary, promote another linked method to primary
    let nextPrimary = user.primaryMethod;
    if (user.primaryMethod === method) {
      nextPrimary = remaining[0].method;
    }
    // Clear primary email/phone fields if those identifiers are being removed
    let nextEmail = user.email;
    let nextPhone = user.phone;
    if (method === "email" && !remaining.some((a) => a.method === "email")) nextEmail = "";
    if (method === "phone" && !remaining.some((a) => a.method === "phone")) nextPhone = undefined;

    const updated: User = {
      ...user,
      linkedAccounts: remaining,
      primaryMethod: nextPrimary,
      email: nextEmail,
      phone: nextPhone,
    };
    const db = await getUsersDb();
    const dbPatch: any = { linkedAccounts: remaining, primaryMethod: nextPrimary, email: nextEmail, phone: nextPhone };
    if (method === "email") dbPatch.passwordHash = "";
    db[user.id] = { ...db[user.id], ...dbPatch };
    await saveUsersDb(db);
    await saveUser(updated);
  }, [user, saveUser]);

  return (
    <AuthContext.Provider value={{ user, loading, isLoggedIn: !!user, register, login, completeLoginWithTwoFactor, verifyTwoFactorCode, consumeBackupCode, logout, updateUser, linkAccount, unlinkAccount, checkEmailExists, setPassword, linkGoogleToEmailAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
