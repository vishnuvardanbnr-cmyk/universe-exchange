import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useAuth, AuthMethod, LoginEvent } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useBinance } from "@/context/BinanceContext";
import { useKraken } from "@/context/KrakenContext";
import { useActiveExchange, EXCHANGE_META, ExchangeId } from "@/context/ActiveExchangeContext";
import { generateTotpSecret, formatSecretGroups, buildOtpAuthUri, verifyTotp, generateBackupCodes } from "@/lib/totp";
import * as Clipboard from "expo-clipboard";

const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`;
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "SGD", "INR"];
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "pt", label: "Português" },
];

const METHOD_META: Record<AuthMethod, { icon: string; label: string; iconColor: string }> = {
  email: { icon: "mail", label: "Email & Password", iconColor: "#628EEA" },
  google: { icon: "globe", label: "Google", iconColor: "#EA4335" },
  apple: { icon: "smartphone", label: "Apple", iconColor: "#848E9C" },
  phone: { icon: "phone", label: "Phone Number", iconColor: "#0ECB81" },
};

function KycStatusBadge({ userId }: { userId: string }) {
  const [level, setLevel] = useState<number>(0);
  useEffect(() => {
    fetch(`${API_BASE}/api/kyc/status`, { headers: { "x-user-id": userId } })
      .then((r) => r.json())
      .then((d) => setLevel(d.verifiedLevel ?? 0))
      .catch(() => {});
  }, [userId]);
  if (level === 0) return <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#848E9C" }}>Not Verified</Text>;
  if (level === 1) return <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#F0B90B" }}>Basic</Text>;
  return <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#0ECB81" }}>Verified</Text>;
}

function Row({ icon, iconColor, label, value, onPress, danger, right }: {
  icon: string; iconColor?: string; label: string; value?: string;
  onPress?: () => void; danger?: boolean; right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const ic = danger ? "#F6465D" : (iconColor ?? colors.primary);
  return (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
      <View style={[styles.rowIcon, { backgroundColor: ic + "18" }]}>
        <Feather name={icon as any} size={15} color={ic} />
      </View>
      <Text style={[styles.rowLabel, { color: danger ? "#F6465D" : colors.foreground }]}>{label}</Text>
      {right ?? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {value && <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>}
          {onPress && <Feather name="chevron-right" size={15} color={colors.mutedForeground} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

function SwitchRow({ icon, iconColor, label, value, onChange }: { icon: string; iconColor?: string; label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  const ic = iconColor ?? colors.primary;
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: ic + "18" }]}>
        <Feather name={icon as any} size={15} color={ic} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
      <Switch value={value} onValueChange={(v) => { Haptics.selectionAsync(); onChange(v); }} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={Platform.OS === "android" ? "#fff" : undefined} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

function TwoFASetupModal({ visible, email, onConfirm, onCancel }: {
  visible: boolean; email: string;
  onConfirm: (data: { secret: string; backupCodes: string[] }) => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<"setup" | "verify" | "backup">("setup");
  const [rawSecret, setRawSecret] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    if (visible && !rawSecret) {
      setRawSecret(generateTotpSecret(20));
      setBackupCodes(generateBackupCodes(8));
    }
  }, [visible, rawSecret]);

  const formattedSecret = rawSecret ? formatSecretGroups(rawSecret) : "";
  const otpUri = rawSecret
    ? buildOtpAuthUri({ issuer: "Universe X", account: email || "user", secretBase32: rawSecret })
    : "";

  const handleCopyKey = async () => {
    try {
      await Clipboard.setStringAsync(rawSecret);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      Haptics.selectionAsync();
    } catch {}
  };

  const handleVerify = () => {
    if (code.length !== 6 || !/^\d{6}$/.test(code)) { setError("Enter the 6-digit code from your authenticator app."); return; }
    if (!verifyTotp(rawSecret, code)) {
      setError("Code didn't match. Make sure your device clock is correct and try the latest code.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setError("");
    setStep("backup");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const reset = () => {
    setStep("setup");
    setCode("");
    setError("");
    setRawSecret("");
    setBackupCodes([]);
  };

  const handleDone = () => {
    onConfirm({ secret: rawSecret, backupCodes });
    reset();
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleCopyBackupCodes = async () => {
    try {
      await Clipboard.setStringAsync(backupCodes.join("\n"));
      Alert.alert("Copied", "Backup codes copied to clipboard.");
      Haptics.selectionAsync();
    } catch {}
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCancel}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <View style={[styles.pageHeader, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: 12 }]}>
          <TouchableOpacity onPress={handleCancel} style={styles.backBtn}>
            <Feather name="x" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>
            {step === "setup" ? "Set Up 2FA" : step === "verify" ? "Verify Code" : "Backup Codes"}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }} showsVerticalScrollIndicator={false}>
          {step === "setup" && (
            <>
              <View style={{ alignItems: "center", gap: 8 }}>
                <View style={[twoFAStyles.stepBadge, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name="shield" size={20} color={colors.primary} />
                </View>
                <Text style={[twoFAStyles.heading, { color: colors.foreground }]}>Authenticator App</Text>
                <Text style={[twoFAStyles.sub, { color: colors.mutedForeground }]}>
                  Scan the QR code below with Google Authenticator, Authy, or any TOTP app.
                </Text>
              </View>

              <View style={[twoFAStyles.qrWrapper, { backgroundColor: "#fff", borderColor: colors.border }]}>
                {otpUri ? <QRCode value={otpUri} size={180} backgroundColor="#fff" color="#000" /> : null}
              </View>

              <View style={[twoFAStyles.keyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[twoFAStyles.keyLabel, { color: colors.mutedForeground }]}>Can't scan? Enter this key manually:</Text>
                <TouchableOpacity onPress={handleCopyKey} activeOpacity={0.7}>
                  <Text style={[twoFAStyles.key, { color: colors.foreground }]}>{formattedSecret}</Text>
                  <Text style={[twoFAStyles.copyHint, { color: copiedKey ? "#0ECB81" : colors.primary }]}>
                    {copiedKey ? "✓ Copied" : "Tap to copy"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[twoFAStyles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="info" size={14} color={colors.primary} />
                <Text style={[twoFAStyles.infoText, { color: colors.mutedForeground }]}>
                  After scanning, the app will generate a 6-digit code every 30 seconds. Use that code on the next step.
                </Text>
              </View>

              <TouchableOpacity style={[twoFAStyles.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => setStep("verify")} activeOpacity={0.85}>
                <Text style={[twoFAStyles.primaryBtnText, { color: colors.primaryForeground }]}>Continue</Text>
              </TouchableOpacity>
            </>
          )}

          {step === "verify" && (
            <>
              <View style={{ alignItems: "center", gap: 8 }}>
                <View style={[twoFAStyles.stepBadge, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name="check-circle" size={20} color={colors.primary} />
                </View>
                <Text style={[twoFAStyles.heading, { color: colors.foreground }]}>Enter Verification Code</Text>
                <Text style={[twoFAStyles.sub, { color: colors.mutedForeground }]}>
                  Open your authenticator app and enter the 6-digit code for Universe X.
                </Text>
              </View>

              <View style={[twoFAStyles.codeBox, { borderColor: error ? "#F6465D" : colors.primary, backgroundColor: colors.card }]}>
                <TextInput
                  style={[twoFAStyles.codeInput, { color: colors.foreground, letterSpacing: 10 }]}
                  value={code}
                  onChangeText={(t) => { setCode(t.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                />
              </View>
              {error ? <Text style={{ color: "#F6465D", textAlign: "center", fontFamily: "Inter_400Regular", fontSize: 13 }}>{error}</Text> : null}

              <View style={[twoFAStyles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="info" size={14} color={colors.primary} />
                <Text style={[twoFAStyles.infoText, { color: colors.mutedForeground }]}>
                  The code rotates every 30 seconds. If verification fails, wait for a new code or check that your phone's clock is set to automatic.
                </Text>
              </View>

              <TouchableOpacity style={[twoFAStyles.primaryBtn, { backgroundColor: colors.primary, opacity: code.length === 6 ? 1 : 0.5 }]} onPress={handleVerify} activeOpacity={0.85} disabled={code.length < 6}>
                <Text style={[twoFAStyles.primaryBtnText, { color: colors.primaryForeground }]}>Verify & Enable</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setStep("setup")} activeOpacity={0.7} style={{ alignItems: "center" }}>
                <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 14 }}>← Back</Text>
              </TouchableOpacity>
            </>
          )}

          {step === "backup" && (
            <>
              <View style={{ alignItems: "center", gap: 8 }}>
                <View style={[twoFAStyles.stepBadge, { backgroundColor: "#0ECB8118" }]}>
                  <Feather name="key" size={20} color="#0ECB81" />
                </View>
                <Text style={[twoFAStyles.heading, { color: colors.foreground }]}>Save Backup Codes</Text>
                <Text style={[twoFAStyles.sub, { color: colors.mutedForeground }]}>
                  Store these codes somewhere safe. Each can be used once if you lose access to your authenticator.
                </Text>
              </View>

              <View style={[twoFAStyles.backupGrid, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {backupCodes.map((c, i) => (
                  <View key={i} style={twoFAStyles.backupCode}>
                    <Text style={[twoFAStyles.backupCodeText, { color: colors.foreground }]}>{c}</Text>
                  </View>
                ))}
              </View>

              <View style={[twoFAStyles.infoBox, { backgroundColor: "#F6465D12", borderColor: "#F6465D30" }]}>
                <Feather name="alert-circle" size={14} color="#F6465D" />
                <Text style={[twoFAStyles.infoText, { color: "#F6465D" }]}>
                  Never share these codes. Each code can only be used once and cannot be recovered.
                </Text>
              </View>

              <TouchableOpacity style={[twoFAStyles.primaryBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} onPress={handleCopyBackupCodes} activeOpacity={0.85}>
                <Text style={[twoFAStyles.primaryBtnText, { color: colors.foreground }]}>Copy All Codes</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[twoFAStyles.primaryBtn, { backgroundColor: "#0ECB81" }]} onPress={handleDone} activeOpacity={0.85}>
                <Text style={[twoFAStyles.primaryBtnText, { color: "#fff" }]}>I've Saved My Codes — Done</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const twoFAStyles = StyleSheet.create({
  stepBadge: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  heading: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  sub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  qrWrapper: { alignSelf: "center", padding: 16, borderRadius: 16, borderWidth: 1 },
  keyBox: { borderRadius: 12, padding: 16, borderWidth: 1, gap: 6 },
  keyLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  key: { fontSize: 15, fontFamily: "Inter_500Medium", letterSpacing: 2, textAlign: "center" },
  copyHint: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center", marginTop: 4 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  codeBox: { borderWidth: 2, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 8, alignItems: "center" },
  codeInput: { fontSize: 32, fontFamily: "Inter_700Bold", textAlign: "center", width: "100%", paddingVertical: 8 },
  primaryBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  backupGrid: { borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  backupCode: { width: "45%", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#00000010", alignItems: "center" },
  backupCodeText: { fontSize: 14, fontFamily: "Inter_500Medium", letterSpacing: 1 },
});

function PickerScreen({ title, options, selected, onSelect, onBack }: { title: string; options: { label: string; value: string }[]; selected: string; onSelect: (v: string) => void; onBack: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top + 8;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.pageHeader, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView>
        {options.map((o, i) => (
          <TouchableOpacity key={o.value} style={[styles.pickerRow, { borderBottomColor: colors.border, backgroundColor: selected === o.value ? colors.primary + "10" : "transparent" }]} onPress={() => { onSelect(o.value); Haptics.selectionAsync(); }}>
            <Text style={[styles.pickerLabel, { color: selected === o.value ? colors.primary : colors.foreground }]}>{o.label}</Text>
            {selected === o.value && <Feather name="check" size={17} color={colors.primary} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function SettingsScreen() {
  const { colors, toggleScheme, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateUser, logout, linkAccount, unlinkAccount, setPassword } = useAuth();
  const { t } = useI18n();
  const topPad = Platform.OS === "web" ? 20 : insets.top + 8;
  const [editName, setEditName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.displayName ?? "");
  const [picker, setPicker] = useState<null | "currency" | "language">(null);
  const { isConnected: binanceConnected, credentials: binanceCreds, saveCredentials: saveBinance, clearCredentials: clearBinance, testConnection: testBinance } = useBinance();
  const { isConnected: krakenConnected, credentials: krakenCreds, saveCredentials: saveKraken, clearCredentials: clearKraken, testConnection: testKraken } = useKraken();
  const { activeExchange, setActiveExchange } = useActiveExchange();

  const [show2FASetup, setShow2FASetup] = useState(false);
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [linkPrompt, setLinkPrompt] = useState<null | {
    method: AuthMethod;
    email?: string;
    password?: string;
    confirm?: string;
    phone?: string;
    error?: string;
  }>(null);
  const [expandedExchange, setExpandedExchange] = useState<ExchangeId | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [apiTesting, setApiTesting] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  const handleConnectExchange = async (id: ExchangeId) => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      Alert.alert("Required", "Enter both API Key and API Secret.");
      return;
    }
    setApiTesting(true);
    setApiTestResult(null);
    const creds = { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() };
    const result = id === "binance" ? await testBinance(creds) : await testKraken(creds);
    setApiTesting(false);
    if (result.success) {
      if (id === "binance") await saveBinance(creds);
      else await saveKraken(creds);
      await setActiveExchange(id);
      setApiTestResult({ success: true, msg: `Connected! ${result.balances?.length ?? 0} asset(s) with balance.` });
      setExpandedExchange(null);
      setApiKey("");
      setApiSecret("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setApiTestResult({ success: false, msg: result.error ?? "Connection failed" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleDisconnect = (id: ExchangeId) => Alert.alert(`Disconnect ${EXCHANGE_META[id].name}`, "Remove your API credentials from this device?", [
    { text: "Cancel", style: "cancel" },
    { text: "Disconnect", style: "destructive", onPress: async () => {
      if (id === "binance") await clearBinance();
      else await clearKraken();
      setApiTestResult(null);
      setExpandedExchange(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }},
  ]);

  const performLogout = async () => {
    try {
      await logout();
    } catch (e) {
      // proceed regardless — local session is the source of truth
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (router.canDismiss?.()) {
      try { router.dismissAll(); } catch {}
    }
    router.replace("/(tabs)");
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" && window.confirm("Are you sure you want to sign out?");
      if (ok) performLogout();
      return;
    }
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: performLogout },
    ]);
  };

  const handleLink = async (method: AuthMethod) => {
    if (method === "email" || method === "phone") {
      setLinkPrompt({ method, email: "", password: "", confirm: "", phone: "", error: "" });
      return;
    }
    // For google/apple — re-run the OAuth flow on the auth screen
    Alert.alert(
      `Link ${METHOD_META[method].label}`,
      `To link ${METHOD_META[method].label}, sign out and sign back in using ${METHOD_META[method].label}, then link from there. (Web OAuth requires a redirect.)`,
    );
  };

  const submitLinkPrompt = async () => {
    if (!linkPrompt) return;
    const { method } = linkPrompt;
    if (method === "email") {
      const email = (linkPrompt.email ?? "").trim().toLowerCase();
      const password = linkPrompt.password ?? "";
      const confirm = linkPrompt.confirm ?? "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setLinkPrompt({ ...linkPrompt, error: "Enter a valid email address" }); return; }
      if (password.length < 6) { setLinkPrompt({ ...linkPrompt, error: "Password must be at least 6 characters" }); return; }
      if (password !== confirm) { setLinkPrompt({ ...linkPrompt, error: "Passwords do not match" }); return; }
      try {
        await linkAccount("email", email);
        await setPassword(password);
        await updateUser({ email });
        setLinkPrompt(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Linked", "Email & Password linked to your account.");
      } catch (e: any) {
        setLinkPrompt({ ...linkPrompt, error: e.message ?? "Failed to link" });
      }
      return;
    }
    if (method === "phone") {
      const raw = (linkPrompt.phone ?? "").trim();
      // Accept +countrycode and 7-15 digits total
      const cleaned = raw.replace(/[\s\-()]/g, "");
      if (!/^\+?\d{7,15}$/.test(cleaned)) { setLinkPrompt({ ...linkPrompt, error: "Enter a valid phone number (e.g. +14155551234)" }); return; }
      const normalized = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
      try {
        await linkAccount("phone", normalized);
        await updateUser({ phone: normalized });
        setLinkPrompt(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Linked", "Phone number linked to your account.");
      } catch (e: any) {
        setLinkPrompt({ ...linkPrompt, error: e.message ?? "Failed to link" });
      }
    }
  };

  const handleUnlink = (method: AuthMethod) => Alert.alert("Unlink", `Remove ${METHOD_META[method].label}?`, [
    { text: "Cancel", style: "cancel" },
    { text: "Unlink", style: "destructive", onPress: async () => { try { await unlinkAccount(method); } catch (e: any) { Alert.alert("Error", e.message); } } },
  ]);

  if (picker === "currency") return <PickerScreen title={t("picker.currency")} options={CURRENCIES.map((c) => ({ label: c, value: c }))} selected={user?.currency ?? "USD"} onSelect={async (v) => { await updateUser({ currency: v }); setPicker(null); }} onBack={() => setPicker(null)} />;
  if (picker === "language") return <PickerScreen title={t("picker.language")} options={LANGUAGES.map((l) => ({ label: l.label, value: l.code }))} selected={user?.language ?? "en"} onSelect={async (v) => { await updateUser({ language: v }); setPicker(null); }} onBack={() => setPicker(null)} />;

  if (!user) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.pageHeader, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>{t("settings.title")}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.guestCenter}>
          <View style={[styles.guestIconCircle, { backgroundColor: colors.secondary }]}>
            <Feather name="user" size={36} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.guestTitle, { color: colors.foreground }]}>Not Signed In</Text>
          <Text style={[styles.guestSub, { color: colors.mutedForeground }]}>Sign in to access your profile, security settings, and linked accounts.</Text>
          <TouchableOpacity style={[styles.signInBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/auth")} activeOpacity={0.85}>
            <Text style={[styles.signInBtnText, { color: colors.primaryForeground }]}>Sign In</Text>
          </TouchableOpacity>
          <View style={{ marginTop: 32, width: "100%", gap: 10 }}>
            <Section title="GENERAL">
              <Row icon="message-circle" iconColor="#628EEA" label="Contact Support" onPress={() => router.push("/support")} />
              <Row icon="file-text" iconColor="#9945FF" label="Terms & Conditions" onPress={() => router.push("/terms")} />
              <Row icon="moon" iconColor="#848E9C" label={scheme === "dark" ? "Light Mode" : "Dark Mode"} onPress={toggleScheme} />
            </Section>
          </View>
        </View>
      </View>
    );
  }

  const linkedMethods = user.linkedAccounts.map((a) => a.method);
  const allMethods: AuthMethod[] = ["email", "google", "apple", "phone"];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.pageHeader, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>{t("settings.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={[styles.avatarBig, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarBigText}>{(user.displayName ?? "?")[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {editName ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput style={[styles.nameInput, { color: colors.foreground, borderColor: colors.primary, flex: 1 }]} value={nameInput} onChangeText={setNameInput} autoFocus returnKeyType="done" onSubmitEditing={async () => { await updateUser({ displayName: nameInput }); setEditName(false); }} />
                <TouchableOpacity onPress={async () => { await updateUser({ displayName: nameInput }); setEditName(false); }}>
                  <View style={[styles.saveBtn, { backgroundColor: colors.primary }]}><Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save</Text></View>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setEditName(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.profileName, { color: colors.foreground }]}>{user.displayName}</Text>
                <Feather name="edit-2" size={13} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
            <Text style={[styles.profileSub, { color: colors.mutedForeground }]}>{user.email || user.phone || user.primaryMethod}</Text>
            <View style={[styles.memberBadge, { backgroundColor: colors.primary + "15" }]}>
              <Feather name="star" size={10} color={colors.primary} />
              <Text style={[styles.memberBadgeText, { color: colors.primary }]}>Member since {new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</Text>
            </View>
          </View>
        </View>

        <View style={{ padding: 16, gap: 4 }}>
          <Section title={t("settings.section.notifications")}>
            <SwitchRow icon="bell" iconColor="#F0B90B" label={t("settings.row.notifications")} value={user.notificationsEnabled} onChange={(v) => updateUser({ notificationsEnabled: v })} />
            <SwitchRow icon="trending-up" iconColor="#0ECB81" label={t("settings.row.priceAlerts")} value={user.priceAlertsEnabled} onChange={(v) => updateUser({ priceAlertsEnabled: v })} />
          </Section>

          <Section title={t("settings.section.security")}>
            <Row icon="user-check" iconColor="#0ECB81" label="Identity Verification" onPress={() => router.push("/kyc")}
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <KycStatusBadge userId={user.id} />
                  <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
                </View>
              }
            />
            <SwitchRow icon="shield" iconColor="#628EEA" label={t("settings.row.twoFactor")} value={user.twoFactorEnabled} onChange={(v) => {
              if (v) {
                setShow2FASetup(true);
              } else {
                Alert.alert("Disable 2FA", "Are you sure you want to disable two-factor authentication? This will make your account less secure.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Disable", style: "destructive", onPress: () => { updateUser({ twoFactorEnabled: false, totpSecret: undefined, backupCodes: undefined }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
                ]);
              }
            }} />
            {user.twoFactorEnabled && user.backupCodes ? (
              <Row icon="key" iconColor="#0ECB81" label={t("settings.row.backupCodes")} value={t("settings.value.codesLeft", { n: user.backupCodes.length })} onPress={() => Alert.alert("Backup Codes", user.backupCodes!.join("\n"))} />
            ) : null}
            <Row icon="lock" iconColor="#9945FF" label={t("settings.row.changePassword")} onPress={() => Alert.alert("Reset Password", "A reset link will be sent to your email.\n\n(Demo mode)")} />
            <Row icon="clock" iconColor="#848E9C" label={t("settings.row.loginHistory")} value={t("settings.value.entries", { n: user.loginHistory?.length ?? 0 })} onPress={() => setShowLoginHistory(true)} />
          </Section>

          <Section title={t("settings.section.linkedAccounts")}>
            {allMethods.map((m) => {
              const linked = linkedMethods.includes(m);
              const meta = METHOD_META[m];
              return (
                <Row key={m} icon={meta.icon} iconColor={linked ? "#0ECB81" : colors.mutedForeground} label={meta.label}
                  right={
                    <TouchableOpacity style={[styles.linkBtn, { backgroundColor: linked ? "#F6465D15" : colors.primary + "15" }]} onPress={() => linked ? handleUnlink(m) : handleLink(m)}>
                      <Text style={[styles.linkBtnText, { color: linked ? "#F6465D" : colors.primary }]}>{linked ? "Unlink" : "Link"}</Text>
                    </TouchableOpacity>
                  }
                />
              );
            })}
          </Section>

          <Section title={t("settings.section.preferences")}>
            <Row icon="dollar-sign" iconColor="#F0B90B" label={t("settings.row.currency")} value={user.currency} onPress={() => setPicker("currency")} />
            <Row icon="globe" iconColor="#628EEA" label={t("settings.row.language")} value={LANGUAGES.find((l) => l.code === user.language)?.label ?? user.language} onPress={() => setPicker("language")} />
            <Row icon="moon" iconColor="#848E9C" label={t("settings.row.theme")} onPress={toggleScheme} />
          </Section>

          {user?.isAdmin && (
          <>
          <Section title="EXCHANGE ADMIN">
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, gap: 14 }}>
              {/* Active exchange selector */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.6 }}>ACTIVE EXCHANGE</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["binance", "kraken"] as ExchangeId[]).map((id) => {
                    const meta = EXCHANGE_META[id];
                    const isActive = activeExchange === id;
                    const connected = id === "binance" ? binanceConnected : krakenConnected;
                    return (
                      <TouchableOpacity
                        key={id}
                        onPress={async () => { await setActiveExchange(id); Haptics.selectionAsync(); }}
                        activeOpacity={0.8}
                        style={{
                          flex: 1, borderRadius: 12, borderWidth: 1.5,
                          borderColor: isActive ? meta.color : colors.border,
                          backgroundColor: isActive ? meta.color + "12" : colors.background,
                          padding: 12, gap: 6,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: meta.color + "20", alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: meta.color }}>{meta.logo}</Text>
                          </View>
                          {isActive && <Feather name="check-circle" size={14} color={meta.color} />}
                        </View>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: isActive ? meta.color : colors.foreground }}>{meta.name}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: connected ? "#0ECB81" : colors.border }} />
                          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: connected ? "#0ECB81" : colors.mutedForeground }}>
                            {connected ? "Connected" : "Not linked"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Per-exchange connection rows */}
              {(["binance", "kraken"] as ExchangeId[]).map((id) => {
                const meta = EXCHANGE_META[id];
                const connected = id === "binance" ? binanceConnected : krakenConnected;
                const creds = id === "binance" ? binanceCreds : krakenCreds;
                const isExpanded = expandedExchange === id;
                return (
                  <View key={id} style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={[styles.rowIcon, { backgroundColor: connected ? "#0ECB8120" : meta.color + "18" }]}>
                        <Feather name={connected ? "check-circle" : "link"} size={15} color={connected ? "#0ECB81" : meta.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{meta.name}</Text>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: connected ? "#0ECB81" : colors.mutedForeground }}>
                          {connected ? `Connected · ${creds?.apiKey.slice(0, 8)}…` : meta.regulated}
                        </Text>
                      </View>
                      {connected ? (
                        <TouchableOpacity style={[styles.linkBtn, { backgroundColor: "#F6465D15" }]} onPress={() => handleDisconnect(id)}>
                          <Text style={[styles.linkBtnText, { color: "#F6465D" }]}>Remove</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.linkBtn, { backgroundColor: meta.color + "15" }]}
                          onPress={() => {
                            setExpandedExchange(isExpanded ? null : id);
                            setApiKey(""); setApiSecret(""); setApiTestResult(null);
                          }}
                        >
                          <Text style={[styles.linkBtnText, { color: meta.color }]}>{isExpanded ? "Cancel" : "Connect"}</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {isExpanded && !connected && (
                      <View style={{ gap: 8, paddingLeft: 42 }}>
                        <View style={{ borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 8 }}>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 2 }}>API KEY</Text>
                          <TextInput
                            style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground }}
                            placeholder={`Your ${meta.name} API Key`}
                            placeholderTextColor={colors.mutedForeground}
                            value={apiKey}
                            onChangeText={setApiKey}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        </View>
                        <View style={{ borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 8 }}>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 2 }}>API SECRET</Text>
                          <TextInput
                            style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground }}
                            placeholder={`Your ${meta.name} API Secret`}
                            placeholderTextColor={colors.mutedForeground}
                            value={apiSecret}
                            onChangeText={setApiSecret}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        </View>
                        <TouchableOpacity
                          style={[{ borderRadius: 10, paddingVertical: 12, alignItems: "center", backgroundColor: meta.color }, apiTesting && { opacity: 0.65 }]}
                          onPress={() => handleConnectExchange(id)}
                          disabled={apiTesting}
                          activeOpacity={0.85}
                        >
                          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" }}>
                            {apiTesting ? "Connecting…" : `Connect ${meta.name}`}
                          </Text>
                        </TouchableOpacity>
                        {apiTestResult && expandedExchange === id && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Feather name={apiTestResult.success ? "check-circle" : "alert-circle"} size={13} color={apiTestResult.success ? "#0ECB81" : "#F6465D"} />
                            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: apiTestResult.success ? "#0ECB81" : "#F6465D", flex: 1 }}>{apiTestResult.msg}</Text>
                          </View>
                        )}
                        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: meta.color + "10", borderRadius: 8, padding: 8 }}>
                          <Feather name="shield" size={11} color={meta.color} style={{ marginTop: 1 }} />
                          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1, lineHeight: 15 }}>
                            Use a trade-only key. Never grant withdrawal permissions. Credentials stay on this device only.
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
              <View style={{ height: 6 }} />
            </View>
          </Section>
          <Section title="ADMIN">
            <Row icon="shield" iconColor="#F0B90B" label="Admin Panel" onPress={() => router.push("/admin")} />
          </Section>
          </>
          )}

          <Section title="SUPPORT & LEGAL">
            <Row icon="message-circle" iconColor="#628EEA" label="Contact Support" onPress={() => router.push("/support")} />
            <Row icon="file-text" iconColor="#9945FF" label="Terms & Conditions" onPress={() => router.push("/terms")} />
            <Row icon="info" iconColor="#848E9C" label="App Version" value="1.0.0" />
          </Section>

          <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: "#F6465D10", borderColor: "#F6465D25" }]} onPress={handleLogout} activeOpacity={0.85}>
            <Feather name="log-out" size={17} color="#F6465D" />
            <Text style={styles.logoutText}>{t("common.signOut")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TwoFASetupModal
        visible={show2FASetup}
        email={user.email || user.phone || user.id}
        onConfirm={({ secret, backupCodes }) => { setShow2FASetup(false); updateUser({ twoFactorEnabled: true, totpSecret: secret, backupCodes }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
        onCancel={() => { setShow2FASetup(false); }}
      />

      <Modal visible={showLoginHistory} animationType="slide" onRequestClose={() => setShowLoginHistory(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setShowLoginHistory(false)} style={{ padding: 6, marginRight: 8 }}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: colors.foreground }}>Login History</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            {(user.loginHistory ?? []).length === 0 ? (
              <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40, fontFamily: "Inter_400Regular" }}>
                No login activity recorded yet.
              </Text>
            ) : (
              (user.loginHistory ?? []).map((ev: LoginEvent, idx: number) => {
                const ok = ev.status === "success";
                return (
                  <View key={`${ev.at}-${idx}`} style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ok ? "#0ECB81" : "#F6465D" }} />
                        <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground, fontSize: 14 }}>
                          {METHOD_META[ev.method]?.label ?? ev.method} · {ok ? "Success" : "Failed"}
                        </Text>
                      </View>
                      <Text style={{ fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontSize: 12 }}>
                        {new Date(ev.at).toLocaleString()}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Feather name="globe" size={12} color={colors.mutedForeground} />
                      <Text style={{ fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontSize: 12 }}>
                        IP {ev.ip || "unknown"}
                      </Text>
                    </View>
                    {ev.userAgent ? (
                      <Text numberOfLines={1} style={{ fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontSize: 11 }}>
                        {ev.userAgent}
                      </Text>
                    ) : null}
                    {ev.reason ? (
                      <Text style={{ fontFamily: "Inter_400Regular", color: ok ? colors.mutedForeground : "#F6465D", fontSize: 11 }}>
                        {ev.reason}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!linkPrompt} transparent animationType="fade" onRequestClose={() => setLinkPrompt(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <View style={{ width: "100%", maxWidth: 380, backgroundColor: colors.card, borderRadius: 16, padding: 20, gap: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
            <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>
              {linkPrompt ? `Link ${METHOD_META[linkPrompt.method].label}` : ""}
            </Text>
            {linkPrompt?.method === "email" && (
              <>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                  Add an email and password so you can sign in without Google.
                </Text>
                <TextInput
                  placeholder="Email address" placeholderTextColor={colors.mutedForeground}
                  value={linkPrompt.email} onChangeText={(t) => setLinkPrompt({ ...linkPrompt, email: t, error: "" })}
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14 }}
                />
                <TextInput
                  placeholder="Password (min 6 chars)" placeholderTextColor={colors.mutedForeground}
                  value={linkPrompt.password} onChangeText={(t) => setLinkPrompt({ ...linkPrompt, password: t, error: "" })}
                  secureTextEntry autoCapitalize="none" autoCorrect={false}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14 }}
                />
                <TextInput
                  placeholder="Confirm password" placeholderTextColor={colors.mutedForeground}
                  value={linkPrompt.confirm} onChangeText={(t) => setLinkPrompt({ ...linkPrompt, confirm: t, error: "" })}
                  secureTextEntry autoCapitalize="none" autoCorrect={false}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14 }}
                />
              </>
            )}
            {linkPrompt?.method === "phone" && (
              <>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                  Enter your phone number with country code, e.g. +14155551234.
                </Text>
                <TextInput
                  placeholder="+14155551234" placeholderTextColor={colors.mutedForeground}
                  value={linkPrompt.phone} onChangeText={(t) => setLinkPrompt({ ...linkPrompt, phone: t, error: "" })}
                  keyboardType="phone-pad" autoCapitalize="none" autoCorrect={false}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14 }}
                />
              </>
            )}
            {linkPrompt?.error ? (
              <Text style={{ fontSize: 12, color: "#F6465D", fontFamily: "Inter_500Medium" }}>{linkPrompt.error}</Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <TouchableOpacity onPress={() => setLinkPrompt(null)} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", backgroundColor: colors.secondary }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitLinkPrompt} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", backgroundColor: colors.primary }}>
                <Text style={{ fontFamily: "Inter_700Bold", color: colors.primaryForeground }}>Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pageHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  pageTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  profileCard: { flexDirection: "row", alignItems: "flex-start", gap: 16, padding: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  avatarBig: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarBigText: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#fff" },
  profileName: { fontSize: 18, fontFamily: "Inter_700Bold" },
  profileSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  memberBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
  memberBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  nameInput: { fontSize: 16, fontFamily: "Inter_600SemiBold", borderBottomWidth: 1.5, paddingVertical: 2 },
  saveBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  saveBtnText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: 8, marginLeft: 4, marginTop: 16 },
  sectionCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  rowValue: { fontSize: 13, fontFamily: "Inter_400Regular" },
  linkBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  linkBtnText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 15, borderRadius: 14, borderWidth: 1, marginTop: 12 },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#F6465D" },
  guestCenter: { flex: 1, alignItems: "center", padding: 24 },
  guestIconCircle: { width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center", marginTop: 40, marginBottom: 16 },
  guestTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  guestSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, marginTop: 6 },
  signInBtn: { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 14, marginTop: 20 },
  signInBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  pickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
