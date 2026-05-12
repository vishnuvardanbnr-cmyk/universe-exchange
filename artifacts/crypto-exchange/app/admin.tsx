import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE
  ? process.env.EXPO_PUBLIC_API_BASE
  : `https://${process.env["EXPO_PUBLIC_DOMAIN"] ?? "localhost:8080"}`;
const ADMIN_KEY = "cryptox-admin-2024";

function adminFetch(path: string, opts?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": ADMIN_KEY,
      ...(opts?.headers ?? {}),
    },
  });
}

const COIN_OPTIONS = [
  "BTC","ETH","BNB","SOL","XRP","ADA","DOGE","AVAX","TRX","DOT",
  "MATIC","LINK","LTC","ATOM","UNI","NEAR","ARB","OP","APT","SUI",
  "INJ","USDT","USDC",
];

type DepositRow = { id: number; user_id: string; coin: string; network: string; amount: string; status: string; created_at: string };
type WithdrawalRow = { id: number; user_id: string; coin: string; amount: string; address: string; status: string; created_at: string };
type AddressRow = { id: number; coin: string; network: string; address: string; memo?: string; label?: string };
type UserAddressRow = { id: number; user_id: string; coin: string; network: string; address: string; memo?: string; created_at: string };

type Panel = "menu" | "credit" | "tradableCoins" | "userAddresses" | "addresses" | "deposits" | "withdrawals" | "p2pAds" | "p2pOrders" | "p2pVerified" | "kyc" | "assets" | "liquidity" | "mmBot" | "blockchainDeposits" | "earn" | "notifications";

export default function AdminScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 20 : insets.top + 8;

  const [panel, setPanel] = useState<Panel>("menu");

  const [authed, setAuthed] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [authError, setAuthError] = useState("");

  const verifyAdmin = () => {
    if (adminInput.trim() === ADMIN_KEY) {
      setAuthed(true);
      setAuthError("");
    } else {
      setAuthError("Invalid admin key.");
    }
  };

  const Header = ({ title, onBack }: { title: string; onBack: () => void }) => (
    <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (!authed) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Header title="Admin Panel" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
          <View style={{ alignItems: "center", gap: 10, marginBottom: 8 }}>
            <View style={[styles.iconCircle, { backgroundColor: "#F0B90B18" }]}>
              <Feather name="shield" size={32} color="#F0B90B" />
            </View>
            <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground }}>Admin Access</Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" }}>
              Enter the admin key to access the control panel.
            </Text>
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: authError ? "#F6465D" : colors.border, color: colors.foreground }]}
            placeholder="Admin key"
            placeholderTextColor={colors.mutedForeground}
            value={adminInput}
            onChangeText={(t) => { setAdminInput(t); setAuthError(""); }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={verifyAdmin}
          />
          {authError ? <Text style={{ color: "#F6465D", fontSize: 12, fontFamily: "Inter_400Regular" }}>{authError}</Text> : null}
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#F0B90B" }]} onPress={verifyAdmin} activeOpacity={0.85}>
            <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#000" }}>Unlock</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (panel === "credit") return <CreditPanel colors={colors} insets={insets} onBack={() => setPanel("menu")} topPad={topPad} />;
  if (panel === "tradableCoins") return <TradableCoinsPanel colors={colors} insets={insets} onBack={() => setPanel("menu")} topPad={topPad} />;
  if (panel === "userAddresses") return <UserAddressesPanel colors={colors} insets={insets} onBack={() => setPanel("menu")} topPad={topPad} />;
  if (panel === "addresses") return <AddressesPanel colors={colors} insets={insets} onBack={() => setPanel("menu")} topPad={topPad} />;
  if (panel === "deposits") return <DepositsPanel colors={colors} insets={insets} onBack={() => setPanel("menu")} topPad={topPad} />;
  if (panel === "withdrawals") return <WithdrawalsPanel colors={colors} insets={insets} onBack={() => setPanel("menu")} topPad={topPad} />;
  if (panel === "p2pAds") return <P2PAdsPanel colors={colors} insets={insets} onBack={() => setPanel("menu")} topPad={topPad} />;
  if (panel === "p2pOrders") return <P2POrdersPanel colors={colors} insets={insets} onBack={() => setPanel("menu")} topPad={topPad} />;
  if (panel === "p2pVerified") return <P2PVerifiedPanel colors={colors} insets={insets} onBack={() => setPanel("menu")} topPad={topPad} />;
  if (panel === "kyc") return <KycAdminPanel colors={colors} insets={insets} onBack={() => setPanel("menu")} topPad={topPad} />;
  if (panel === "assets") return <AssetsPanel colors={colors} insets={insets} onBack={() => setPanel("menu")} topPad={topPad} />;
  if (panel === "liquidity") return <LiquidityPanel colors={colors} insets={insets} onBack={() => setPanel("menu")} topPad={topPad} />;
  if (panel === "mmBot") return <MMBotPanel colors={colors} insets={insets} onBack={() => setPanel("menu")} topPad={topPad} />;
  if (panel === "blockchainDeposits") return <BlockchainDepositsPanel colors={colors} insets={insets} onBack={() => setPanel("menu")} topPad={topPad} />;
  if (panel === "earn") return <EarnProductsPanel colors={colors} onBack={() => setPanel("menu")} topPad={topPad} />;
  if (panel === "notifications") return <NotificationsBroadcastPanel colors={colors} onBack={() => setPanel("menu")} topPad={topPad} />;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Admin Panel</Text>
        <TouchableOpacity onPress={() => { setAuthed(false); setAdminInput(""); }} style={styles.backBtn}>
          <Feather name="lock" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>WALLET MANAGEMENT</Text>
        <MenuCard icon="plus-circle" iconColor="#0ECB81" title="Credit User Balance" desc="Add funds to a user's account after deposit confirmation" onPress={() => setPanel("credit")} colors={colors} />
        <MenuCard icon="toggle-right" iconColor="#F0B90B" title="Tradable Coins" desc="Enable or disable coins for deposit and wallet display" onPress={() => setPanel("tradableCoins")} colors={colors} />
        <MenuCard icon="users" iconColor="#628EEA" title="User Deposit Addresses" desc="View each user's unique deposit address per coin" onPress={() => setPanel("userAddresses")} colors={colors} />
        <MenuCard icon="map-pin" iconColor="#F0B90B" title="Admin Hot Wallet" desc="Configure admin sweep-to wallet addresses" onPress={() => setPanel("addresses")} colors={colors} />
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>REQUESTS</Text>
        <MenuCard icon="arrow-down-circle" iconColor="#628EEA" title="Deposit Requests" desc="View user deposit submissions" onPress={() => setPanel("deposits")} colors={colors} />
        <MenuCard icon="arrow-up-circle" iconColor="#9945FF" title="Withdrawal Requests" desc="View and process withdrawal requests" onPress={() => setPanel("withdrawals")} colors={colors} />
        <MenuCard icon="user-check" iconColor="#0ECB81" title="KYC Verification" desc="Review and approve identity verification submissions" onPress={() => setPanel("kyc")} colors={colors} />
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>P2P TRADING</Text>
        <MenuCard icon="shield" iconColor="#F0B90B" title="Verified Traders" desc="Grant or revoke the verified badge for P2P merchants" onPress={() => setPanel("p2pVerified")} colors={colors} />
        <MenuCard icon="users" iconColor="#F0B90B" title="P2P Ads" desc="View, pause or remove all P2P advertisements" onPress={() => setPanel("p2pAds")} colors={colors} />
        <MenuCard icon="list" iconColor="#0ECB81" title="P2P Orders & Disputes" desc="Monitor orders and resolve active disputes" onPress={() => setPanel("p2pOrders")} colors={colors} />
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>ASSET REGISTRY</Text>
        <MenuCard icon="box" iconColor="#9945FF" title="Custom Assets" desc="Add tokens with contract address, chain, key reference" onPress={() => setPanel("assets")} colors={colors} />
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>ON-CHAIN OPS</Text>
        <MenuCard icon="cpu" iconColor="#628EEA" title="Blockchain Deposits" desc="Scan listener results, confirm and credit deposits" onPress={() => setPanel("blockchainDeposits")} colors={colors} />
        <MenuCard icon="database" iconColor="#0ECB81" title="Liquidity Dashboard" desc="Hot wallet balances, top-up alerts and sweep targets" onPress={() => setPanel("liquidity")} colors={colors} />
        <MenuCard icon="activity" iconColor="#F0B90B" title="Market Making Bot" desc="Configure spread, order size and start/stop the MM bot" onPress={() => setPanel("mmBot")} colors={colors} />
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>EARN & NOTIFICATIONS</Text>
        <MenuCard icon="percent" iconColor="#0ECB81" title="Earn Products" desc="Create, edit and toggle Staking, Liquid Staking and Earn products" onPress={() => setPanel("earn")} colors={colors} />
        <MenuCard icon="bell" iconColor="#F0B90B" title="Broadcast Notifications" desc="Send announcements to all users — appears in the bell tab" onPress={() => setPanel("notifications")} colors={colors} />
      </ScrollView>
    </View>
  );
}

function MenuCard({ icon, iconColor, title, desc, onPress, colors }: any) {
  return (
    <TouchableOpacity style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.menuIcon, { backgroundColor: iconColor + "18" }]}>
        <Feather name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{title}</Text>
        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>{desc}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function CreditPanel({ colors, insets, onBack, topPad }: any) {
  const [userId, setUserId] = useState("");
  const [coin, setCoin] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCredit = async () => {
    if (!userId.trim()) { Alert.alert("Required", "Enter a user ID."); return; }
    if (!amount || parseFloat(amount) <= 0) { Alert.alert("Required", "Enter a valid amount."); return; }
    setSubmitting(true);
    try {
      const res = await adminFetch("/api/admin/credit", {
        method: "POST",
        body: JSON.stringify({ userId: userId.trim(), coin, amount: parseFloat(amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", `Credited ${amount} ${coin} to user ${userId.trim()}.`);
      setUserId(""); setAmount("");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally { setSubmitting(false); }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Credit User</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>USER ID</Text>
          <TextInput
            style={[styles.inputField, { color: colors.foreground }]}
            placeholder="e.g. user_abc123"
            placeholderTextColor={colors.mutedForeground}
            value={userId}
            onChangeText={setUserId}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>SELECT COIN</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {COIN_OPTIONS.map((s) => (
              <TouchableOpacity key={s} onPress={() => setCoin(s)} style={[styles.chip, { backgroundColor: coin === s ? colors.primary : colors.card, borderColor: coin === s ? colors.primary : colors.border }]} activeOpacity={0.8}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: coin === s ? colors.primaryForeground : colors.foreground }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>AMOUNT ({coin})</Text>
          <TextInput
            style={[styles.inputField, { color: colors.foreground }]}
            placeholder="0.0"
            placeholderTextColor={colors.mutedForeground}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={{ backgroundColor: "#0ECB8112", borderRadius: 10, padding: 12, flexDirection: "row", gap: 8 }}>
          <Feather name="info" size={13} color="#0ECB81" style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#0ECB81", lineHeight: 18 }}>
            This will immediately credit the user's available balance. Use this after confirming an on-chain deposit.
          </Text>
        </View>

        <TouchableOpacity style={[styles.btn, { backgroundColor: "#0ECB81", opacity: submitting ? 0.6 : 1 }]} onPress={handleCredit} disabled={submitting} activeOpacity={0.85}>
          {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" }}>Credit Balance</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

type TradableCoinRow = { coin: string; enabled: boolean };

function TradableCoinsPanel({ colors, insets, onBack, topPad }: any) {
  const [coins, setCoins] = useState<TradableCoinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/tradable-coins");
      const data = await res.json();
      setCoins(data.coins ?? []);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (coin: string, currentEnabled: boolean) => {
    setToggling(coin);
    try {
      await adminFetch(`/api/admin/tradable-coins/${coin}`, {
        method: "POST",
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      setCoins((prev) => prev.map((c) => c.coin === coin ? { ...c, enabled: !currentEnabled } : c));
      Haptics.selectionAsync();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally { setToggling(null); }
  };

  const enabledCount = coins.filter((c) => c.enabled).length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Tradable Coins</Text>
        <TouchableOpacity onPress={load} style={styles.backBtn}><Feather name="refresh-cw" size={18} color={colors.primary} /></TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card + "80", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
          <Text style={{ color: colors.success, fontFamily: "Inter_600SemiBold" }}>{enabledCount}</Text>
          {" of "}{coins.length} coins enabled — users can deposit enabled coins.{"\n"}Coins with user balances always show in wallets even when disabled.
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {coins.map((item) => (
            <View key={item.coin} style={[styles.addrCard, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center", paddingVertical: 14 }]}>
              <View style={[{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 14 }, { backgroundColor: (COIN_COLORS_ADMIN[item.coin] ?? "#848E9C") + "22" }]}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: COIN_COLORS_ADMIN[item.coin] ?? "#848E9C" }}>{item.coin}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{item.coin}</Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: item.enabled ? colors.success : colors.mutedForeground, marginTop: 2 }}>
                  {item.enabled ? "Enabled — deposit & wallet" : "Disabled — hidden from deposit"}
                </Text>
              </View>
              {toggling === item.coin ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <TouchableOpacity
                  onPress={() => toggle(item.coin, item.enabled)}
                  style={[
                    styles.toggleBtn,
                    { backgroundColor: item.enabled ? colors.success : colors.secondary, borderColor: item.enabled ? colors.success : colors.border },
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.toggleKnob, { transform: [{ translateX: item.enabled ? 18 : 0 }], backgroundColor: "#fff" }]} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const COIN_COLORS_ADMIN: Record<string, string> = {
  BTC: "#F7931A", ETH: "#627EEA", BNB: "#F0B90B", USDT: "#26A17B", USDC: "#2775CA",
  SOL: "#9945FF", XRP: "#346AA9", ADA: "#0033AD", DOGE: "#C3A634", AVAX: "#E84142",
  TRX: "#EF0027", DOT: "#E6007A", MATIC: "#8247E5", LINK: "#2A5ADA", LTC: "#BFBBBB",
  ATOM: "#6F7390", UNI: "#FF007A", NEAR: "#00C08B", ARB: "#28A0F0", OP: "#FF0420",
  APT: "#2AA3EF", SUI: "#6FBCF0", INJ: "#00F2FE",
};

function UserAddressesPanel({ colors, insets, onBack, topPad }: any) {
  const [rows, setRows] = useState<UserAddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCoin, setFilterCoin] = useState("");
  const [copied, setCopied] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterCoin ? `/api/admin/user-deposit-addresses?coin=${filterCoin}` : "/api/admin/user-deposit-addresses";
      const res = await adminFetch(url);
      const data = await res.json();
      setRows(data.addresses ?? []);
    } catch { } finally { setLoading(false); }
  }, [filterCoin]);

  useEffect(() => { load(); }, [load]);

  const copyAddr = async (row: UserAddressRow) => {
    const { Clipboard } = await import("expo-clipboard");
    await Clipboard.setStringAsync(row.address);
    setCopied(row.id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>User Deposit Addresses</Text>
        <TouchableOpacity onPress={load} style={styles.backBtn}><Feather name="refresh-cw" size={18} color={colors.primary} /></TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {["", ...COIN_OPTIONS].map((s) => (
            <TouchableOpacity key={s || "all"} onPress={() => setFilterCoin(s)} style={[styles.chip, { backgroundColor: filterCoin === s ? colors.primary : colors.card, borderColor: filterCoin === s ? colors.primary : colors.border }]} activeOpacity={0.8}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: filterCoin === s ? colors.primaryForeground : colors.foreground }}>{s || "All"}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {rows.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 48, gap: 10 }}>
              <Feather name="users" size={40} color={colors.border} />
              <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>No addresses generated yet</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" }}>
                Addresses appear here once users open the deposit flow.
              </Text>
            </View>
          ) : (
            rows.map((row) => (
              <View key={row.id} style={[styles.addrCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[styles.coinBadge, { backgroundColor: colors.secondary }]}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.foreground }}>{row.coin}</Text>
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{row.network}</Text>
                  </View>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                    {new Date(row.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginBottom: 4 }}>
                  User: <Text style={{ color: colors.foreground }}>{row.user_id}</Text>
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: colors.secondary, borderRadius: 8, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }}
                  onPress={() => copyAddr(row)}
                  activeOpacity={0.8}
                >
                  <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: colors.foreground }} numberOfLines={1}>
                    {row.address}
                  </Text>
                  <Feather name={copied === row.id ? "check" : "copy"} size={14} color={copied === row.id ? "#0ECB81" : colors.primary} />
                </TouchableOpacity>
                {row.memo ? (
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#F0B90B", marginTop: 6 }}>
                    Memo/Tag: {row.memo}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function AddressesPanel({ colors, insets, onBack, topPad }: any) {
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [coin, setCoin] = useState("BTC");
  const [network, setNetwork] = useState("");
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/deposit-addresses");
      const data = await res.json();
      setAddresses(data.addresses ?? []);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!network.trim() || !address.trim()) { Alert.alert("Required", "Network and address are required."); return; }
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/deposit-addresses", {
        method: "POST",
        body: JSON.stringify({ coin, network: network.trim(), address: address.trim(), memo: memo.trim() || undefined, label: label.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", `${coin} (${network}) address saved.`);
      setNetwork(""); setAddress(""); setMemo(""); setLabel("");
      setAdding(false);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally { setSaving(false); }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => { if (adding) setAdding(false); else onBack(); }} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{adding ? "Add Hot Wallet" : "Admin Hot Wallet"}</Text>
        {!adding ? (
          <TouchableOpacity onPress={() => setAdding(true)} style={styles.backBtn}>
            <Feather name="plus" size={22} color={colors.primary} />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      {adding ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <View>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>COIN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {COIN_OPTIONS.map((s) => (
                <TouchableOpacity key={s} onPress={() => setCoin(s)} style={[styles.chip, { backgroundColor: coin === s ? colors.primary : colors.card, borderColor: coin === s ? colors.primary : colors.border }]} activeOpacity={0.8}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: coin === s ? colors.primaryForeground : colors.foreground }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <InputField label="NETWORK (e.g. Bitcoin, ERC-20, BEP-20)" value={network} onChange={setNetwork} placeholder="Network identifier" colors={colors} />
          <InputField label="LABEL (optional, shown to user)" value={label} onChange={setLabel} placeholder="e.g. Bitcoin Mainnet" colors={colors} />
          <InputField label="WALLET ADDRESS" value={address} onChange={setAddress} placeholder="Deposit wallet address" colors={colors} autoCapitalize="none" />
          <InputField label="MEMO / TAG (optional)" value={memo} onChange={setMemo} placeholder="Required for XRP, XLM, ATOM, etc." colors={colors} autoCapitalize="none" />
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#F0B90B", opacity: saving ? 0.6 : 1 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#000" }}>Save Address</Text>}
          </TouchableOpacity>
        </ScrollView>
      ) : loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {addresses.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 48, gap: 10 }}>
              <Feather name="map-pin" size={40} color={colors.border} />
              <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>No addresses yet</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" }}>
                Tap + to add your first deposit address.
              </Text>
            </View>
          ) : (
            addresses.map((a) => (
              <View key={a.id} style={[styles.addrCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[styles.coinBadge, { backgroundColor: colors.secondary }]}>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: colors.foreground }}>{a.coin}</Text>
                    </View>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{a.label ?? a.network}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.foreground, letterSpacing: 0.2 }} numberOfLines={1}>
                  {a.address}
                </Text>
                {a.memo ? <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#F0B90B", marginTop: 4 }}>Memo: {a.memo}</Text> : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function DepositsPanel({ colors, insets, onBack, topPad }: any) {
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch("/api/admin/deposits").then((r) => r.json()).then((d) => setRows(d.deposits ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Deposit Requests</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {rows.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 48, gap: 10 }}>
              <Feather name="inbox" size={40} color={colors.border} />
              <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>No deposit requests</Text>
            </View>
          ) : (
            rows.map((row) => (
              <View key={row.id} style={[styles.addrCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <View style={[styles.coinBadge, { backgroundColor: colors.secondary }]}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.foreground }}>{row.coin}</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{row.amount}</Text>
                  </View>
                  <StatusBadge status={row.status} />
                </View>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 6 }}>
                  User: {row.user_id}
                </Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                  Network: {row.network} · {new Date(row.created_at).toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function WithdrawalsPanel({ colors, insets, onBack, topPad }: any) {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminFetch("/api/admin/withdrawals").then((r) => r.json()).then((d) => setRows(d.withdrawals ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = (id: number) => Alert.alert("Approve Withdrawal", "Mark this as approved/processed?", [
    { text: "Cancel", style: "cancel" },
    { text: "Approve", onPress: async () => {
      setProcessing(id);
      try {
        const res = await adminFetch(`/api/admin/withdrawals/${id}/approve`, { method: "POST" });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        load();
      } catch (e: any) { Alert.alert("Error", e.message); }
      finally { setProcessing(null); }
    }},
  ]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Withdrawal Requests</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {rows.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 48, gap: 10 }}>
              <Feather name="inbox" size={40} color={colors.border} />
              <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>No withdrawal requests</Text>
            </View>
          ) : (
            rows.map((row) => (
              <View key={row.id} style={[styles.addrCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <View style={[styles.coinBadge, { backgroundColor: colors.secondary }]}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.foreground }}>{row.coin}</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{row.amount}</Text>
                  </View>
                  <StatusBadge status={row.status} />
                </View>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 6 }} numberOfLines={1}>
                  To: {row.address}
                </Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                  User: {row.user_id} · {new Date(row.created_at).toLocaleString()}
                </Text>
                {row.status === "pending" && (
                  <TouchableOpacity
                    style={[styles.approveBtn, { backgroundColor: "#0ECB8118", borderColor: "#0ECB8140", opacity: processing === row.id ? 0.6 : 1 }]}
                    onPress={() => approve(row.id)}
                    disabled={processing === row.id}
                    activeOpacity={0.8}
                  >
                    {processing === row.id ? <ActivityIndicator color="#0ECB81" size="small" /> : (
                      <>
                        <Feather name="check" size={14} color="#0ECB81" />
                        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0ECB81" }}>Mark Approved</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── P2P Ads Panel ────────────────────────────────────────────────────────────
function P2PAdsPanel({ colors, insets, onBack, topPad }: any) {
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetch_ = async () => {
    setLoading(true);
    try {
      const url = filter === "all" ? "/api/admin/p2p/ads" : `/api/admin/p2p/ads?status=${filter}`;
      const r = await adminFetch(url);
      const d = await r.json();
      setAds(d.ads ?? []);
    } catch { setAds([]); } finally { setLoading(false); }
  };

  useEffect(() => { fetch_(); }, [filter]);

  const setStatus = async (id: number, status: string) => {
    try {
      await adminFetch(`/api/admin/p2p/ads/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      Haptics.selectionAsync();
      fetch_();
    } catch { Alert.alert("Error", "Failed to update ad"); }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>P2P Ads</Text>
        <TouchableOpacity onPress={fetch_} style={styles.backBtn}><Feather name="refresh-cw" size={18} color={colors.primary} /></TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 52, backgroundColor: colors.card }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
        {["all","active","paused","admin_paused","deleted"].map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}
            style={[styles.chip, { backgroundColor: filter === f ? colors.primary + "22" : colors.secondary,
              borderColor: filter === f ? colors.primary : colors.border }]}>
            <Text style={{ fontSize: 12, fontFamily: filter === f ? "Inter_700Bold" : "Inter_400Regular",
              color: filter === f ? colors.primary : colors.mutedForeground }}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} /> :
          ads.length === 0 ? <Text style={{ textAlign: "center", color: colors.mutedForeground, marginTop: 40 }}>No ads found</Text> :
          ads.map(ad => (
            <View key={ad.id} style={[styles.addrCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                  #{ad.id} · {ad.type.toUpperCase()} {ad.coin}
                </Text>
                <View style={{ backgroundColor: ad.status === "active" ? "#0ECB8118" : "#F6465D18", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: ad.status === "active" ? "#0ECB81" : "#F6465D" }}>
                    {ad.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 4 }}>
                User: {ad.user_id.slice(0,12)}… · Price: ${ad.price.toLocaleString()} · Avail: {ad.available_amount} {ad.coin}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 10 }}>
                Limits: ${ad.min_amount} – ${ad.max_amount} · {ad.payment_methods?.join(", ")}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {ad.status !== "active" && <TouchableOpacity onPress={() => setStatus(ad.id, "active")}
                  style={{ flex: 1, backgroundColor: "#0ECB8118", borderRadius: 8, padding: 8, alignItems: "center", borderWidth: 1, borderColor: "#0ECB8140" }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#0ECB81" }}>Activate</Text>
                </TouchableOpacity>}
                {ad.status !== "admin_paused" && ad.status !== "deleted" && <TouchableOpacity onPress={() => setStatus(ad.id, "admin_paused")}
                  style={{ flex: 1, backgroundColor: "#F0B90B18", borderRadius: 8, padding: 8, alignItems: "center", borderWidth: 1, borderColor: "#F0B90B40" }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#F0B90B" }}>Pause</Text>
                </TouchableOpacity>}
                {ad.status !== "deleted" && <TouchableOpacity onPress={() => Alert.alert("Delete Ad", "Remove this ad permanently?", [
                  { text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => setStatus(ad.id, "deleted") }
                ])} style={{ flex: 1, backgroundColor: "#F6465D18", borderRadius: 8, padding: 8, alignItems: "center", borderWidth: 1, borderColor: "#F6465D40" }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#F6465D" }}>Delete</Text>
                </TouchableOpacity>}
              </View>
            </View>
          ))
        }
      </ScrollView>
    </View>
  );
}

// ─── P2P Orders Panel ─────────────────────────────────────────────────────────
function P2POrdersPanel({ colors, insets, onBack, topPad }: any) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [resolving, setResolving] = useState<number | null>(null);
  const [stats, setStats] = useState<any>(null);

  const fetch_ = async () => {
    setLoading(true);
    try {
      const [oRes, sRes] = await Promise.all([
        adminFetch(filter === "all" ? "/api/admin/p2p/orders" : `/api/admin/p2p/orders?status=${filter}`),
        adminFetch("/api/admin/p2p/stats"),
      ]);
      const oD = await oRes.json();
      const sD = await sRes.json();
      setOrders(oD.orders ?? []);
      setStats(sD);
    } catch { setOrders([]); } finally { setLoading(false); }
  };

  useEffect(() => { fetch_(); }, [filter]);

  const resolve = async (id: number, action: "release" | "refund") => {
    Alert.alert(`Resolve: ${action === "release" ? "Release to buyer" : "Refund to seller"}`, "This will complete the order.", [
      { text: "Cancel" },
      { text: "Confirm", style: "destructive", onPress: async () => {
        setResolving(id);
        try {
          const r = await adminFetch(`/api/admin/p2p/orders/${id}/resolve`, {
            method: "POST", body: JSON.stringify({ action, note: `Admin ${action}d` })
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          fetch_();
        } catch (e: any) { Alert.alert("Error", e.message); } finally { setResolving(null); }
      }},
    ]);
  };

  const STATUS_COLORS: Record<string, string> = {
    pending:"#F0B90B", paid:"#2775CA", released:"#0ECB81",
    cancelled:"#848E9C", disputed:"#F6465D", resolved:"#0ECB81",
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>P2P Orders</Text>
        <TouchableOpacity onPress={fetch_} style={styles.backBtn}><Feather name="refresh-cw" size={18} color={colors.primary} /></TouchableOpacity>
      </View>

      {/* Stats bar */}
      {stats && (
        <View style={{ flexDirection: "row", backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 12, gap: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
          {[
            { label: "Total Ads", value: stats.ads?.total ?? 0, color: colors.foreground },
            { label: "Active Ads", value: stats.ads?.active ?? 0, color: "#0ECB81" },
            { label: "Total Orders", value: stats.orders?.total ?? 0, color: colors.foreground },
            { label: "Disputed", value: stats.orders?.disputed ?? 0, color: "#F6465D" },
          ].map(s => (
            <View key={s.label} style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: s.color }}>{s.value}</Text>
              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 52, backgroundColor: colors.card }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
        {["all","pending","paid","disputed","released","cancelled"].map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}
            style={[styles.chip, { backgroundColor: filter === f ? colors.primary + "22" : colors.secondary, borderColor: filter === f ? colors.primary : colors.border }]}>
            <Text style={{ fontSize: 12, fontFamily: filter === f ? "Inter_700Bold" : "Inter_400Regular", color: filter === f ? colors.primary : colors.mutedForeground }}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} /> :
          orders.length === 0 ? <Text style={{ textAlign: "center", color: colors.mutedForeground, marginTop: 40 }}>No orders found</Text> :
          orders.map(order => {
            const sColor = STATUS_COLORS[order.status] ?? "#848E9C";
            return (
              <View key={order.id} style={[styles.addrCard, { backgroundColor: colors.card, borderColor: order.status === "disputed" ? "#F6465D40" : colors.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                    Order #{order.id} · {order.ad_type?.toUpperCase()} {order.coin}
                  </Text>
                  <View style={{ backgroundColor: sColor + "18", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: sColor }}>{order.status.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                  Buyer: {order.buyer_id.slice(0,10)}… → Seller: {order.seller_id.slice(0,10)}…
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>
                  {order.crypto_amount} {order.coin} · ${order.fiat_amount.toLocaleString()} USD via {order.payment_method}
                </Text>
                {order.dispute_reason && (
                  <View style={{ backgroundColor: "#F6465D12", borderRadius: 8, padding: 8, marginTop: 8 }}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#F6465D" }}>Dispute: {order.dispute_reason}</Text>
                  </View>
                )}
                {order.status === "disputed" && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <TouchableOpacity disabled={resolving === order.id}
                      onPress={() => resolve(order.id, "release")}
                      style={{ flex: 1, backgroundColor: "#0ECB8118", borderRadius: 8, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#0ECB8140" }}>
                      {resolving === order.id ? <ActivityIndicator size="small" color="#0ECB81" /> :
                        <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#0ECB81" }}>Release to Buyer</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity disabled={resolving === order.id}
                      onPress={() => resolve(order.id, "refund")}
                      style={{ flex: 1, backgroundColor: "#F0B90B18", borderRadius: 8, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#F0B90B40" }}>
                      {resolving === order.id ? <ActivityIndicator size="small" color="#F0B90B" /> :
                        <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#F0B90B" }}>Refund to Seller</Text>}
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 6 }}>
                  {new Date(order.created_at).toLocaleString()}
                </Text>
              </View>
            );
          })
        }
      </ScrollView>
    </View>
  );
}

// ─── P2P Verified Traders Panel ───────────────────────────────────────────────
function P2PVerifiedPanel({ colors, insets, onBack, topPad }: any) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/p2p/verified-users");
      const d = await r.json();
      setUsers(d.users ?? []);
    } catch { setUsers([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const verify = async () => {
    if (!userId.trim()) return Alert.alert("Error", "Enter a User ID");
    setSaving(true);
    try {
      const r = await adminFetch(`/api/admin/p2p/users/${userId.trim()}/verify`, {
        method: "POST", body: JSON.stringify({ note: note.trim() || null }),
      });
      const d = await r.json();
      if (d.ok) { setUserId(""); setNote(""); load(); Alert.alert("Done", "Trader verified successfully"); }
      else Alert.alert("Error", d.error ?? "Failed");
    } catch { Alert.alert("Error", "Network error"); } finally { setSaving(false); }
  };

  const revoke = async (uid: string) => {
    Alert.alert("Revoke Verification", `Remove verified badge from ${uid.slice(0,12)}…?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Revoke", style: "destructive", onPress: async () => {
        setRevoking(uid);
        try {
          await adminFetch(`/api/admin/p2p/users/${uid}/verify`, { method: "DELETE" });
          load();
        } finally { setRevoking(null); }
      }},
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Verified Traders</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {/* Grant form */}
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 12,
          borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#F0B90B18", alignItems: "center", justifyContent: "center" }}>
              <Feather name="shield" size={16} color="#F0B90B" />
            </View>
            <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground }}>Grant Verified Badge</Text>
          </View>
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 18 }}>
            Enter the full User ID of the trader to mark them as a verified merchant. The badge will appear next to their name in all P2P listings.
          </Text>
          <View style={[styles.inputGroup, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>USER ID</Text>
            <TextInput
              style={[styles.inputField, { color: colors.foreground }]}
              placeholder="e.g. abc123..."
              placeholderTextColor={colors.mutedForeground}
              value={userId}
              onChangeText={setUserId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={[styles.inputGroup, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>NOTE (optional)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.foreground }]}
              placeholder="e.g. KYC verified, high-volume trader"
              placeholderTextColor={colors.mutedForeground}
              value={note}
              onChangeText={setNote}
            />
          </View>
          <TouchableOpacity onPress={verify} disabled={saving}
            style={[styles.btn, { backgroundColor: "#F0B90B", opacity: saving ? 0.6 : 1 }]}>
            {saving ? <ActivityIndicator color="#000" size="small" /> : <Feather name="shield" size={16} color="#000" />}
            <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#000" }}>
              {saving ? "Verifying…" : "Verify Trader"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Verified list */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginLeft: 4 }]}>
          VERIFIED TRADERS · {users.length}
        </Text>

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : users.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
            <Feather name="shield-off" size={36} color={colors.border} />
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>No verified traders yet</Text>
          </View>
        ) : users.map((u) => (
          <View key={u.user_id} style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14,
            borderWidth: StyleSheet.hairlineWidth, borderColor: "#F0B90B40", flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#F0B90B20",
              alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#F0B90B" }}>
              <Feather name="shield" size={18} color="#F0B90B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                {"Trader_" + u.user_id.slice(0, 6).toUpperCase()}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                {u.user_id.slice(0, 18)}…
              </Text>
              {u.note && (
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>
                  {u.note}
                </Text>
              )}
              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>
                Since {new Date(u.verified_at).toLocaleDateString()}
              </Text>
            </View>
            <TouchableOpacity onPress={() => revoke(u.user_id)} disabled={revoking === u.user_id}
              style={{ backgroundColor: "#F6465D18", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
                borderWidth: 1, borderColor: "#F6465D40" }}>
              {revoking === u.user_id
                ? <ActivityIndicator size="small" color="#F6465D" />
                : <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#F6465D" }}>Revoke</Text>}
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function InputField({ label, value, onChange, placeholder, colors, autoCapitalize }: any) {
  return (
    <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[styles.inputField, { color: colors.foreground }]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChange}
        autoCapitalize={autoCapitalize ?? "sentences"}
        autoCorrect={false}
      />
    </View>
  );
}

function KycAdminPanel({ colors, insets, onBack, topPad }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [rejReason, setRejReason] = useState("");
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      let url = `/api/admin/kyc?status=${filterStatus}`;
      if (filterLevel) url += `&level=${filterLevel}`;
      const data = await adminFetch(url);
      setItems(data.submissions ?? []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterStatus, filterLevel]);

  const act = async (id: number, action: "approve" | "reject") => {
    setActing(true);
    try {
      await adminFetch(`/api/admin/kyc/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ reason: rejReason || "Does not meet requirements" }) : "{}",
      });
      setSelected(null);
      setRejReason("");
      load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { Alert.alert("Error", "Action failed."); }
    setActing(false);
  };

  if (selected) {
    const s = STATUS_COLORS[selected.status as keyof typeof STATUS_COLORS] ?? "#848E9C";
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => { setSelected(null); setRejReason(""); }} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>KYC Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground }}>Level {selected.level} — {selected.first_name} {selected.last_name}</Text>
              <View style={{ backgroundColor: s + "18", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: s, textTransform: "capitalize" }}>{selected.status.replace("_", " ")}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>User ID: {selected.user_id}</Text>
            {[
              ["Date of Birth", selected.date_of_birth],
              ["Nationality", selected.nationality],
              ["Country", selected.country],
              ["Document", selected.document_type?.replace("_", " ")],
            ].filter(([, v]) => !!v).map(([k, v]) => (
              <View key={k as string} style={{ flexDirection: "row", gap: 8 }}>
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, width: 100 }}>{k}:</Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.foreground, textTransform: "capitalize", flex: 1 }}>{v}</Text>
              </View>
            ))}
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Submitted: {new Date(selected.created_at).toLocaleString()}</Text>
            {selected.rejection_reason && (
              <View style={{ borderRadius: 8, backgroundColor: "#F6465D10", padding: 10 }}>
                <Text style={{ fontSize: 11, color: "#F6465D" }}>Rejection: {selected.rejection_reason}</Text>
              </View>
            )}
          </View>

          {(selected.status === "pending" || selected.status === "under_review") && (
            <>
              <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>REJECTION REASON (if rejecting)</Text>
                <TextInput
                  style={[styles.inputField, { color: colors.foreground }]}
                  placeholder="e.g. Image unclear, ID expired..."
                  placeholderTextColor={colors.mutedForeground}
                  value={rejReason}
                  onChangeText={setRejReason}
                  multiline
                />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => act(selected.id, "reject")}
                  disabled={acting}
                  style={{ flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center", backgroundColor: "#F6465D15", borderWidth: 1, borderColor: "#F6465D30", opacity: acting ? 0.7 : 1 }}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#F6465D" }}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => act(selected.id, "approve")}
                  disabled={acting}
                  style={{ flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center", backgroundColor: "#0ECB8115", borderWidth: 1, borderColor: "#0ECB8130", opacity: acting ? 0.7 : 1 }}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#0ECB81" }}>Approve</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>KYC Verification</Text>
        <TouchableOpacity onPress={load} style={styles.backBtn}><Feather name="refresh-cw" size={16} color={colors.foreground} /></TouchableOpacity>
      </View>
      <View style={{ flexDirection: "row", gap: 8, padding: 12, flexWrap: "wrap" }}>
        {(["pending", "under_review", "approved", "rejected"] as const).map((s) => (
          <TouchableOpacity key={s} onPress={() => setFilterStatus(s)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: filterStatus === s ? "#F0B90B" : colors.border, backgroundColor: filterStatus === s ? "#F0B90B15" : colors.card }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: filterStatus === s ? "#F0B90B" : colors.mutedForeground, textTransform: "capitalize" }}>{s.replace("_", " ")}</Text>
          </TouchableOpacity>
        ))}
        {([null, 1, 2] as const).map((l) => (
          <TouchableOpacity key={String(l)} onPress={() => setFilterLevel(l)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: filterLevel === l ? colors.primary : colors.border, backgroundColor: filterLevel === l ? colors.primary + "15" : colors.card }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: filterLevel === l ? colors.primary : colors.mutedForeground }}>{l === null ? "All Levels" : `Level ${l}`}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Feather name="user-check" size={36} color={colors.mutedForeground} />
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>No submissions found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
          {items.map((item) => {
            const sc = STATUS_COLORS[item.status as keyof typeof STATUS_COLORS] ?? "#848E9C";
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setSelected(item)}
                style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14 }}
                activeOpacity={0.85}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: sc + "18", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: sc }}>L{item.level}</Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{item.first_name ?? "—"} {item.last_name ?? ""}</Text>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{item.user_id.substring(0, 16)}…</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: sc + "18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: sc, textTransform: "capitalize" }}>{item.status.replace("_", " ")}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  {item.nationality && <Text style={{ fontSize: 11, color: colors.mutedForeground }}>🌍 {item.nationality}</Text>}
                  {item.document_type && <Text style={{ fontSize: 11, color: colors.mutedForeground }}>📄 {item.document_type.replace("_", " ")}</Text>}
                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── ASSETS PANEL ────────────────────────────────────────────────────────────
type AssetRow = { id: number; symbol: string; name: string; chain: string; contract_address?: string; decimals: number; logo_url?: string; key_ref?: string; min_deposit: string; min_withdrawal: string; withdrawal_fee: string; enabled: boolean; listed: boolean; created_at: string };

function AssetsPanel({ colors, onBack, topPad }: any) {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AssetRow | null>(null);
  const [form, setForm] = useState({ symbol: "", name: "", chain: "EVM", contract_address: "", decimals: "18", logo_url: "", key_ref: "", min_deposit: "0", min_withdrawal: "0", withdrawal_fee: "0" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/assets");
      const d = await r.json();
      setAssets(d.assets ?? []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (a: AssetRow) => {
    setEditing(a);
    setForm({ symbol: a.symbol, name: a.name, chain: a.chain, contract_address: a.contract_address ?? "", decimals: String(a.decimals), logo_url: a.logo_url ?? "", key_ref: a.key_ref ?? "", min_deposit: a.min_deposit, min_withdrawal: a.min_withdrawal, withdrawal_fee: a.withdrawal_fee });
    setShowForm(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ symbol: "", name: "", chain: "EVM", contract_address: "", decimals: "18", logo_url: "", key_ref: "", min_deposit: "0", min_withdrawal: "0", withdrawal_fee: "0" });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.symbol.trim() || !form.name.trim()) { Alert.alert("Required", "Symbol and name are required."); return; }
    setSaving(true);
    try {
      const payload = { ...form, decimals: parseInt(form.decimals) || 18, min_deposit: parseFloat(form.min_deposit) || 0, min_withdrawal: parseFloat(form.min_withdrawal) || 0, withdrawal_fee: parseFloat(form.withdrawal_fee) || 0 };
      const r = editing
        ? await adminFetch(`/api/admin/assets/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : await adminFetch("/api/admin/assets", { method: "POST", body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { Alert.alert("Error", d.error); return; }
      setShowForm(false);
      load();
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setSaving(false); }
  };

  const toggle = async (a: AssetRow, field: "enabled" | "listed") => {
    try {
      await adminFetch(`/api/admin/assets/${a.id}/toggle`, { method: "PATCH", body: JSON.stringify({ field }) });
      load();
    } catch {}
  };

  const remove = (a: AssetRow) => {
    Alert.alert("Delete Asset", `Remove ${a.symbol} permanently?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await adminFetch(`/api/admin/assets/${a.id}`, { method: "DELETE" });
        load();
      }},
    ]);
  };

  if (showForm) {
    const fields: Array<[string, keyof typeof form, string]> = [
      ["Symbol", "symbol", "BTC"], ["Name", "name", "Bitcoin"],
      ["Chain", "chain", "EVM / BTC / SOL / TRX"],
      ["Contract Address", "contract_address", "0x... (optional)"],
      ["Decimals", "decimals", "18"], ["Logo URL", "logo_url", "https://..."],
      ["Key Ref (env var)", "key_ref", "WALLET_KEY_BTC"],
      ["Min Deposit", "min_deposit", "0.0001"],
      ["Min Withdrawal", "min_withdrawal", "0.001"],
      ["Withdrawal Fee", "withdrawal_fee", "0.0005"],
    ];
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowForm(false)} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{editing ? `Edit ${editing.symbol}` : "New Asset"}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {fields.map(([label, key, ph]) => (
            <View key={key} style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
              <TextInput
                style={[styles.inputField, { color: colors.foreground }]}
                placeholder={ph} placeholderTextColor={colors.mutedForeground}
                value={form[key]} onChangeText={(v) => setForm(f => ({ ...f, [key]: v }))}
                autoCapitalize="none" autoCorrect={false}
                editable={!(editing && key === "symbol")}
              />
            </View>
          ))}
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#F0B90B", marginTop: 8 }]} onPress={save} activeOpacity={0.85} disabled={saving}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#000" }}>{editing ? "Save Changes" : "Create Asset"}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Custom Assets</Text>
        <TouchableOpacity onPress={openNew} style={styles.backBtn}><Feather name="plus" size={20} color="#F0B90B" /></TouchableOpacity>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>
      ) : assets.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Feather name="box" size={42} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }}>No custom assets yet</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#F0B90B", paddingHorizontal: 32 }]} onPress={openNew}>
            <Text style={{ color: "#000", fontFamily: "Inter_700Bold" }}>Add First Asset</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
          {assets.map((a) => (
            <View key={a.id} style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: "#9945FF18", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#9945FF" }}>{a.symbol.substring(0,4)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{a.symbol} <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>{a.name}</Text></Text>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{a.chain} {a.contract_address ? `· ${a.contract_address.substring(0,10)}…` : ""}</Text>
                </View>
                <TouchableOpacity onPress={() => openEdit(a)} style={{ padding: 6 }}><Feather name="edit-2" size={16} color={colors.mutedForeground} /></TouchableOpacity>
                <TouchableOpacity onPress={() => remove(a)} style={{ padding: 6 }}><Feather name="trash-2" size={16} color="#F6465D" /></TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <View style={{ backgroundColor: a.enabled ? "#0ECB8115" : "#F6465D15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: a.enabled ? "#0ECB81" : "#F6465D" }}>ENABLED</Text>
                </View>
                <View style={{ backgroundColor: a.listed ? "#628EEA15" : "#84848415", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: a.listed ? "#628EEA" : colors.mutedForeground }}>LISTED</Text>
                </View>
                {a.key_ref && <View style={{ backgroundColor: "#F0B90B15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#F0B90B" }}>🔑 {a.key_ref}</Text></View>}
                <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, alignSelf: "center" }}>Fee: {a.withdrawal_fee}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <TouchableOpacity onPress={() => toggle(a, "enabled")} style={[styles.approveBtn, { flex: 1, borderColor: a.enabled ? "#F6465D" : "#0ECB81" }]}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: a.enabled ? "#F6465D" : "#0ECB81" }}>{a.enabled ? "Disable" : "Enable"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggle(a, "listed")} style={[styles.approveBtn, { flex: 1, borderColor: a.listed ? "#84848490" : "#628EEA" }]}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: a.listed ? colors.mutedForeground : "#628EEA" }}>{a.listed ? "Unlist" : "List"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── BLOCKCHAIN DEPOSITS PANEL ────────────────────────────────────────────────
type ScanRow = { id: number; user_id: string; coin: string; network: string; deposit_address: string; amount: string; tx_hash?: string; confirmations: number; required_confirmations: number; status: string; detected_at: string; credited_at?: string };

function BlockchainDepositsPanel({ colors, onBack, topPad }: any) {
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterStatus ? `/api/admin/blockchain/deposits?status=${filterStatus}` : "/api/admin/blockchain/deposits";
      const r = await adminFetch(url);
      const d = await r.json();
      setRows(d.deposits ?? []);
    } catch {} finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const scan = async () => {
    setScanning(true);
    try {
      const r = await adminFetch("/api/admin/blockchain/scan", { method: "POST" });
      const d = await r.json();
      Alert.alert("Scan Complete", `Scanned ${d.scanned ?? 0} addresses\nNew deposits detected: ${d.detected ?? 0}`);
      load();
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setScanning(false); }
  };

  const advance = async (id: number) => {
    await adminFetch(`/api/admin/blockchain/deposits/${id}/advance`, { method: "POST" });
    load();
  };

  const confirm = (row: ScanRow) => {
    Alert.alert("Confirm & Credit", `Credit ${row.amount} ${row.coin} to user?\n${row.user_id.substring(0,20)}…`, [
      { text: "Cancel", style: "cancel" },
      { text: "Credit", onPress: async () => {
        const r = await adminFetch(`/api/admin/blockchain/deposits/${row.id}/confirm`, { method: "POST" });
        const d = await r.json();
        if (!r.ok) Alert.alert("Error", d.error);
        else { Alert.alert("Credited", `${d.credited} ${d.coin} credited`); load(); }
      }},
    ]);
  };

  const STATUSES = ["detected", "confirming", "confirmed", "credited", "failed"];
  const STATUS_C: Record<string,string> = { detected: "#F0B90B", confirming: "#628EEA", confirmed: "#0ECB81", credited: "#0ECB81", failed: "#F6465D" };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Blockchain Deposits</Text>
        <TouchableOpacity onPress={load} style={styles.backBtn}><Feather name="refresh-cw" size={16} color={colors.foreground} /></TouchableOpacity>
      </View>
      <View style={{ padding: 12, gap: 8 }}>
        <TouchableOpacity onPress={scan} disabled={scanning} style={[styles.btn, { backgroundColor: "#628EEA", height: 42 }]} activeOpacity={0.85}>
          {scanning ? <ActivityIndicator color="#fff" /> : <><Feather name="cpu" size={16} color="#fff" /><Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Run Blockchain Scan</Text></>}
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
          {[null, ...STATUSES].map((s) => (
            <TouchableOpacity key={String(s)} onPress={() => setFilterStatus(s)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: filterStatus === s ? "#F0B90B" : colors.border, backgroundColor: filterStatus === s ? "#F0B90B15" : colors.card, marginRight: 6 }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: filterStatus === s ? "#F0B90B" : colors.mutedForeground, textTransform: "capitalize" }}>{s ?? "All"}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>
      ) : rows.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
          <Feather name="cpu" size={42} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }}>No deposits scanned yet</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>Press "Run Blockchain Scan" to simulate on-chain checks</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
          {rows.map((row) => {
            const sc = STATUS_C[row.status] ?? "#848E9C";
            return (
              <View key={row.id} style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ backgroundColor: sc + "18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: sc, textTransform: "uppercase" }}>{row.status}</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground }}>{row.amount} {row.coin}</Text>
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{row.network}</Text>
                </View>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 4 }}>User: {row.user_id.substring(0,22)}…</Text>
                {row.tx_hash && <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 4 }}>TX: {row.tx_hash.substring(0,26)}…</Text>}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {[...Array(row.required_confirmations)].map((_, i) => (
                    <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i < row.confirmations ? "#0ECB81" : colors.border }} />
                  ))}
                  <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{row.confirmations}/{row.required_confirmations} confs</Text>
                </View>
                {row.status !== "credited" && row.status !== "failed" && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <TouchableOpacity onPress={() => advance(row.id)} style={[styles.approveBtn, { flex: 1, borderColor: "#628EEA" }]}>
                      <Feather name="arrow-up" size={14} color="#628EEA" />
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#628EEA" }}>+1 Block</Text>
                    </TouchableOpacity>
                    {(row.status === "confirmed" || row.confirmations >= row.required_confirmations) && (
                      <TouchableOpacity onPress={() => confirm(row)} style={[styles.approveBtn, { flex: 1, borderColor: "#0ECB81" }]}>
                        <Feather name="check" size={14} color="#0ECB81" />
                        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#0ECB81" }}>Credit User</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── LIQUIDITY PANEL ──────────────────────────────────────────────────────────
type LiqWallet = { id: number; coin: string; network: string; address: string; key_ref?: string; balance: string; balance_usd: string; low_threshold: string; note?: string; last_checked?: string };

function LiquidityPanel({ colors, onBack, topPad }: any) {
  const [wallets, setWallets] = useState<LiqWallet[]>([]);
  const [totalUsd, setTotalUsd] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editWallet, setEditWallet] = useState<LiqWallet | null>(null);
  const [form, setForm] = useState({ coin: "", network: "", address: "", key_ref: "", balance: "0", balance_usd: "0", low_threshold: "0", note: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/liquidity");
      const d = await r.json();
      setWallets(d.wallets ?? []);
      setTotalUsd(d.total_usd ?? 0);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = (w?: LiqWallet) => {
    if (w) {
      setEditWallet(w);
      setForm({ coin: w.coin, network: w.network, address: w.address, key_ref: w.key_ref ?? "", balance: w.balance, balance_usd: w.balance_usd, low_threshold: w.low_threshold, note: w.note ?? "" });
    } else {
      setEditWallet(null);
      setForm({ coin: "", network: "", address: "", key_ref: "", balance: "0", balance_usd: "0", low_threshold: "0", note: "" });
    }
    setShowForm(true);
  };

  const save = async () => {
    if (!form.coin || !form.network || !form.address) { Alert.alert("Required", "Coin, network, address required"); return; }
    setSaving(true);
    try {
      const r = await adminFetch("/api/admin/liquidity", { method: "POST", body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) { Alert.alert("Error", d.error); return; }
      setShowForm(false); load();
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setSaving(false); }
  };

  const remove = (w: LiqWallet) => {
    Alert.alert("Remove Wallet", `Remove ${w.coin}/${w.network}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        await adminFetch(`/api/admin/liquidity/${w.id}`, { method: "DELETE" });
        load();
      }},
    ]);
  };

  if (showForm) {
    const fields: Array<[string, keyof typeof form, string]> = [
      ["Coin", "coin", "BTC"], ["Network", "network", "BITCOIN"],
      ["Address", "address", "bc1q..."],
      ["Key Ref (env var)", "key_ref", "HOT_WALLET_BTC"],
      ["Balance (coin units)", "balance", "0.5"],
      ["Balance (USD)", "balance_usd", "35000"],
      ["Low Alert Threshold", "low_threshold", "0.1"],
      ["Note", "note", "Primary hot wallet"],
    ];
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowForm(false)} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{editWallet ? "Edit Wallet" : "Add Hot Wallet"}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {fields.map(([label, key, ph]) => (
            <View key={key} style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
              <TextInput style={[styles.inputField, { color: colors.foreground }]} placeholder={ph} placeholderTextColor={colors.mutedForeground} value={form[key]} onChangeText={(v) => setForm(f => ({ ...f, [key]: v }))} autoCapitalize="none" autoCorrect={false} />
            </View>
          ))}
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#F0B90B", marginTop: 8 }]} onPress={save} activeOpacity={0.85} disabled={saving}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#000" }}>Save Wallet</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Liquidity Dashboard</Text>
        <TouchableOpacity onPress={() => openForm()} style={styles.backBtn}><Feather name="plus" size={20} color="#0ECB81" /></TouchableOpacity>
      </View>
      <View style={{ margin: 12, borderRadius: 16, backgroundColor: "#0ECB8112", borderWidth: 1, borderColor: "#0ECB8130", padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#0ECB8120", alignItems: "center", justifyContent: "center" }}>
          <Feather name="database" size={22} color="#0ECB81" />
        </View>
        <View>
          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#0ECB81" }}>TOTAL HOT WALLET VALUE</Text>
          <Text style={{ fontSize: 24, fontFamily: "Inter_700Bold", color: colors.foreground }}>${totalUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}</Text>
        </View>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>
      ) : wallets.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
          <Feather name="database" size={42} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }}>No wallets configured</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#0ECB81", paddingHorizontal: 32 }]} onPress={() => openForm()}>
            <Text style={{ color: "#000", fontFamily: "Inter_700Bold" }}>Add Hot Wallet</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
          {wallets.map((w) => {
            const isLow = parseFloat(w.balance) <= parseFloat(w.low_threshold) && parseFloat(w.low_threshold) > 0;
            return (
              <TouchableOpacity key={w.id} onPress={() => openForm(w)} activeOpacity={0.85} style={{ borderRadius: 14, borderWidth: 1, borderColor: isLow ? "#F6465D50" : colors.border, backgroundColor: colors.card, padding: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground }}>{w.coin}</Text>
                      <View style={{ backgroundColor: "#62EEA15", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#628EEA" }}>{w.network}</Text>
                      </View>
                      {isLow && <View style={{ backgroundColor: "#F6465D18", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#F6465D" }}>LOW</Text>
                      </View>}
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>{w.address.substring(0,22)}…</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: isLow ? "#F6465D" : colors.foreground }}>{parseFloat(w.balance).toFixed(6)} {w.coin}</Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>${parseFloat(w.balance_usd).toLocaleString()}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  {w.key_ref && <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#F0B90B" }}>🔑 {w.key_ref}</Text>}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <TouchableOpacity onPress={() => remove(w)} style={{ padding: 6 }}><Feather name="trash-2" size={14} color="#F6465D80" /></TouchableOpacity>
                    {w.last_checked && <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Checked: {new Date(w.last_checked).toLocaleTimeString()}</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── MM BOT PANEL ─────────────────────────────────────────────────────────────
type BotConfig = { active: boolean; spread_pct: number; order_size_usd: number; active_coins: string[]; refresh_secs: number; usdt_budget: number; total_trades: number; total_pnl_usd: number; updated_at?: string };

function MMBotPanel({ colors, onBack, topPad }: any) {
  const [cfg, setCfg] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState({ spread_pct: "", order_size_usd: "", refresh_secs: "", usdt_budget: "" });
  const [coinInput, setCoinInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/mm-bot");
      const d = await r.json();
      setCfg(d.config);
      if (d.config) {
        setEdit({ spread_pct: String(d.config.spread_pct), order_size_usd: String(d.config.order_size_usd), refresh_secs: String(d.config.refresh_secs), usdt_budget: String(d.config.usdt_budget) });
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    setToggling(true);
    try {
      const r = await adminFetch("/api/admin/mm-bot/toggle", { method: "POST" });
      const d = await r.json();
      setCfg(c => c ? { ...c, active: d.active } : c);
    } catch {} finally { setToggling(false); }
  };

  const saveConfig = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const r = await adminFetch("/api/admin/mm-bot", { method: "POST", body: JSON.stringify({ spread_pct: parseFloat(edit.spread_pct), order_size_usd: parseFloat(edit.order_size_usd), refresh_secs: parseInt(edit.refresh_secs), usdt_budget: parseFloat(edit.usdt_budget) }) });
      const d = await r.json();
      if (r.ok) setCfg(d.config);
      else Alert.alert("Error", d.error);
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setSaving(false); }
  };

  const addCoin = async () => {
    if (!cfg || !coinInput.trim()) return;
    const sym = coinInput.trim().toUpperCase();
    const coins = cfg.active_coins.includes(sym) ? cfg.active_coins : [...cfg.active_coins, sym];
    const r = await adminFetch("/api/admin/mm-bot", { method: "POST", body: JSON.stringify({ active_coins: coins }) });
    const d = await r.json();
    if (r.ok) { setCfg(d.config); setCoinInput(""); }
  };

  const removeCoin = async (sym: string) => {
    if (!cfg) return;
    const coins = cfg.active_coins.filter(c => c !== sym);
    const r = await adminFetch("/api/admin/mm-bot", { method: "POST", body: JSON.stringify({ active_coins: coins }) });
    const d = await r.json();
    if (r.ok) setCfg(d.config);
  };

  if (loading || !cfg) return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Market Making Bot</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>
    </View>
  );

  const pnlColor = cfg.total_pnl_usd >= 0 ? "#0ECB81" : "#F6465D";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Market Making Bot</Text>
        <TouchableOpacity onPress={load} style={styles.backBtn}><Feather name="refresh-cw" size={16} color={colors.foreground} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {/* Status Banner */}
        <View style={{ borderRadius: 16, backgroundColor: cfg.active ? "#0ECB8112" : "#F6465D12", borderWidth: 1, borderColor: cfg.active ? "#0ECB8130" : "#F6465D30", padding: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cfg.active ? "#0ECB81" : "#F6465D" }} />
              <View>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>{cfg.active ? "Bot Running" : "Bot Stopped"}</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{cfg.active ? `Refreshes every ${cfg.refresh_secs}s` : "Press Start to activate"}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={toggle} disabled={toggling} style={{ backgroundColor: cfg.active ? "#F6465D" : "#0ECB81", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
              {toggling ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 13 }}>{cfg.active ? "Stop" : "Start"}</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>TOTAL TRADES</Text>
            <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, marginTop: 4 }}>{cfg.total_trades.toLocaleString()}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>TOTAL P&L</Text>
            <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: pnlColor, marginTop: 4 }}>{cfg.total_pnl_usd >= 0 ? "+" : ""}${parseFloat(String(cfg.total_pnl_usd)).toFixed(2)}</Text>
          </View>
        </View>

        {/* Config Form */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CONFIGURATION</Text>
        {[
          ["Spread %", "spread_pct", "0.5"],
          ["Order Size (USD)", "order_size_usd", "100"],
          ["Refresh Interval (secs)", "refresh_secs", "30"],
          ["USDT Budget", "usdt_budget", "10000"],
        ].map(([label, key, ph]) => (
          <View key={key} style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
            <TextInput
              style={[styles.inputField, { color: colors.foreground }]}
              placeholder={ph} placeholderTextColor={colors.mutedForeground}
              value={edit[key as keyof typeof edit]}
              onChangeText={(v) => setEdit(e => ({ ...e, [key]: v }))}
              keyboardType="numeric"
            />
          </View>
        ))}
        <TouchableOpacity style={[styles.btn, { backgroundColor: "#F0B90B" }]} onPress={saveConfig} activeOpacity={0.85} disabled={saving}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 14 }}>Save Configuration</Text>}
        </TouchableOpacity>

        {/* Active Coins */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 4 }]}>ACTIVE COINS</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {cfg.active_coins.map((sym) => (
            <TouchableOpacity key={sym} onPress={() => removeCoin(sym)} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F0B90B15", borderRadius: 8, borderWidth: 1, borderColor: "#F0B90B30", paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#F0B90B" }}>{sym}</Text>
              <Feather name="x" size={12} color="#F0B90B" />
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            style={[styles.inputGroup, { flex: 1, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="Add coin (e.g. ETH)" placeholderTextColor={colors.mutedForeground}
            value={coinInput} onChangeText={setCoinInput}
            autoCapitalize="characters" autoCorrect={false}
          />
          <TouchableOpacity onPress={addCoin} style={{ backgroundColor: "#F0B90B", borderRadius: 12, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 14 }}>Add</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#F0B90B", under_review: "#628EEA", approved: "#0ECB81", rejected: "#F6465D",
};

// ─── EARN PRODUCTS PANEL ─────────────────────────────────────────────────────
type EarnRow = { id: string; symbol: string; name: string; apy: number; minAmount: number; lockDays: number; type: "staking" | "liquid" | "earn"; tag: string; active: boolean; createdAt: number };

function EarnProductsPanel({ colors, onBack, topPad }: any) {
  const [items, setItems] = useState<EarnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EarnRow | null>(null);
  const [form, setForm] = useState({ symbol: "", name: "", apy: "", minAmount: "0", lockDays: "0", type: "staking" as EarnRow["type"], tag: "" });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | EarnRow["type"]>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminFetch("/api/earn/products/all");
      const d = await r.json();
      setItems(d.products ?? []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ symbol: "", name: "", apy: "", minAmount: "0", lockDays: "0", type: "staking", tag: "" });
    setShowForm(true);
  };

  const openEdit = (p: EarnRow) => {
    setEditing(p);
    setForm({ symbol: p.symbol, name: p.name, apy: String(p.apy), minAmount: String(p.minAmount), lockDays: String(p.lockDays), type: p.type, tag: p.tag });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.symbol.trim() || !form.name.trim() || !form.apy.trim()) {
      Alert.alert("Required", "Symbol, name and APY are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        symbol: form.symbol.toUpperCase(),
        name: form.name,
        apy: parseFloat(form.apy) || 0,
        minAmount: parseFloat(form.minAmount) || 0,
        lockDays: parseInt(form.lockDays) || 0,
        type: form.type,
        tag: form.tag,
      };
      const r = editing
        ? await adminFetch(`/api/earn/products/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : await adminFetch("/api/earn/products", { method: "POST", body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { Alert.alert("Error", d.error ?? "Failed"); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowForm(false);
      load();
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setSaving(false); }
  };

  const toggleActive = async (p: EarnRow) => {
    try {
      await adminFetch(`/api/earn/products/${p.id}`, { method: "PUT", body: JSON.stringify({ active: !p.active }) });
      Haptics.selectionAsync();
      load();
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const remove = (p: EarnRow) => {
    Alert.alert("Delete Product", `Remove ${p.symbol} — ${p.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await adminFetch(`/api/earn/products/${p.id}`, { method: "DELETE" });
        load();
      }},
    ]);
  };

  if (showForm) {
    const TYPES: Array<{ id: EarnRow["type"]; label: string; color: string }> = [
      { id: "staking", label: "Staking", color: "#F0B90B" },
      { id: "liquid", label: "Liquid Staking", color: "#628EEA" },
      { id: "earn", label: "Earn / Savings", color: "#0ECB81" },
    ];
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowForm(false)} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{editing ? `Edit ${editing.symbol}` : "New Earn Product"}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <View>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>PRODUCT TYPE</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {TYPES.map((t) => (
                <TouchableOpacity key={t.id} onPress={() => setForm(f => ({ ...f, type: t.id }))}
                  style={[styles.chip, { flex: 1, alignItems: "center", backgroundColor: form.type === t.id ? t.color : colors.card, borderColor: form.type === t.id ? t.color : colors.border }]}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: form.type === t.id ? "#fff" : colors.foreground }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {([
            ["Symbol", "symbol", "BTC", "characters"],
            ["Name", "name", "BTC 30-Day Fixed", "sentences"],
            ["APY (%)", "apy", "5.5", "none"],
            ["Min Amount", "minAmount", "0.001", "none"],
            ["Lock Days (0 = flexible)", "lockDays", "0", "none"],
            ["Tag (optional)", "tag", "Popular / High APY / Hot", "sentences"],
          ] as Array<[string, keyof typeof form, string, "characters" | "sentences" | "none"]>).map(([label, key, ph, cap]) => (
            <View key={key} style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
              <TextInput
                style={[styles.inputField, { color: colors.foreground }]}
                placeholder={ph} placeholderTextColor={colors.mutedForeground}
                value={form[key] as string} onChangeText={(v) => setForm(f => ({ ...f, [key]: v }))}
                autoCapitalize={cap as any} autoCorrect={false}
                keyboardType={key === "apy" || key === "minAmount" || key === "lockDays" ? "decimal-pad" : "default"}
              />
            </View>
          ))}

          <TouchableOpacity style={[styles.btn, { backgroundColor: "#0ECB81", marginTop: 8 }]} onPress={save} activeOpacity={0.85} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" }}>{editing ? "Save Changes" : "Create Product"}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const visible = filter === "all" ? items : items.filter(p => p.type === filter);
  const typeColor = (t: EarnRow["type"]) => t === "staking" ? "#F0B90B" : t === "liquid" ? "#628EEA" : "#0ECB81";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Earn Products</Text>
        <TouchableOpacity onPress={openNew} style={styles.backBtn}><Feather name="plus" size={20} color="#0ECB81" /></TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {(["all", "staking", "liquid", "earn"] as const).map((f) => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.chip, { backgroundColor: filter === f ? colors.primary : colors.card, borderColor: filter === f ? colors.primary : colors.border }]}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: filter === f ? colors.primaryForeground : colors.foreground, textTransform: "capitalize" }}>{f === "all" ? `All (${items.length})` : f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>
      ) : visible.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 }}>
          <Feather name="percent" size={42} color={colors.mutedForeground} />
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>No products yet</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center" }}>
            Anything you create here will appear instantly on the user-facing Earn tab.
          </Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#0ECB81", paddingHorizontal: 32 }]} onPress={openNew}>
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold" }}>Add First Product</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
          {visible.map((p) => (
            <View key={p.id} style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, opacity: p.active ? 1 : 0.55 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: typeColor(p.type) + "18", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: typeColor(p.type) }}>{p.symbol.substring(0,4)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>
                    {p.symbol} · Min {p.minAmount} · {p.lockDays === 0 ? "Flexible" : `Locked ${p.lockDays}d`}
                  </Text>
                </View>
                <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#0ECB81" }}>{p.apy.toFixed(1)}%</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                <View style={{ backgroundColor: typeColor(p.type) + "15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: typeColor(p.type), textTransform: "uppercase" }}>{p.type}</Text>
                </View>
                {p.tag ? (
                  <View style={{ backgroundColor: "#F0B90B15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#F0B90B" }}>{p.tag}</Text>
                  </View>
                ) : null}
                <View style={{ backgroundColor: p.active ? "#0ECB8115" : "#84848420", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: p.active ? "#0ECB81" : colors.mutedForeground }}>{p.active ? "ACTIVE" : "INACTIVE"}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => toggleActive(p)} style={[styles.approveBtn, { flex: 1, marginTop: 0, borderColor: p.active ? "#F6465D" : "#0ECB81" }]}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: p.active ? "#F6465D" : "#0ECB81" }}>{p.active ? "Pause" : "Activate"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEdit(p)} style={[styles.approveBtn, { flex: 1, marginTop: 0, borderColor: "#628EEA" }]}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#628EEA" }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(p)} style={[styles.approveBtn, { width: 46, marginTop: 0, borderColor: "#F6465D" }]}>
                  <Feather name="trash-2" size={14} color="#F6465D" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── NOTIFICATIONS BROADCAST PANEL ───────────────────────────────────────────
type NotifRow = { id: number; title: string; body: string; type: string; icon?: string; is_active: boolean; created_at: string };

function NotificationsBroadcastPanel({ colors, onBack, topPad }: any) {
  const [items, setItems] = useState<NotifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<NotifRow | null>(null);
  const [form, setForm] = useState({ title: "", body: "", type: "system" });
  const [saving, setSaving] = useState(false);

  const NOTIF_TYPES: Array<{ id: string; label: string; color: string; icon: any }> = [
    { id: "system", label: "System", color: "#848E9C", icon: "info" },
    { id: "promo", label: "Promo", color: "#F0B90B", icon: "gift" },
    { id: "trade", label: "Trade", color: "#0ECB81", icon: "trending-up" },
    { id: "price", label: "Price", color: "#628EEA", icon: "bar-chart-2" },
    { id: "staking", label: "Staking", color: "#9945FF", icon: "percent" },
    { id: "security", label: "Security", color: "#F6465D", icon: "shield" },
  ];
  const meta = (t: string) => NOTIF_TYPES.find(x => x.id === t) ?? NOTIF_TYPES[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/notifications");
      const d = await r.json();
      setItems(d.notifications ?? []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", body: "", type: "system" });
    setShowForm(true);
  };

  const openEdit = (n: NotifRow) => {
    setEditing(n);
    setForm({ title: n.title, body: n.body, type: n.type });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      Alert.alert("Required", "Both title and body are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = { title: form.title.trim(), body: form.body.trim(), type: form.type };
      const r = editing
        ? await adminFetch(`/api/admin/notifications/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await adminFetch("/api/admin/notifications", { method: "POST", body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { Alert.alert("Error", d.error ?? "Failed"); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowForm(false);
      load();
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setSaving(false); }
  };

  const toggleActive = async (n: NotifRow) => {
    try {
      await adminFetch(`/api/admin/notifications/${n.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !n.is_active }) });
      Haptics.selectionAsync();
      load();
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const remove = (n: NotifRow) => {
    Alert.alert("Delete Notification", `Permanently remove "${n.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await adminFetch(`/api/admin/notifications/${n.id}`, { method: "DELETE" });
        load();
      }},
    ]);
  };

  if (showForm) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowForm(false)} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{editing ? "Edit Notification" : "New Broadcast"}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <View>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {NOTIF_TYPES.map((t) => {
                const sel = form.type === t.id;
                return (
                  <TouchableOpacity key={t.id} onPress={() => setForm(f => ({ ...f, type: t.id }))}
                    style={[styles.chip, { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: sel ? t.color : colors.card, borderColor: sel ? t.color : colors.border }]}>
                    <Feather name={t.icon} size={12} color={sel ? "#fff" : t.color} />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: sel ? "#fff" : colors.foreground }}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>TITLE</Text>
            <TextInput
              style={[styles.inputField, { color: colors.foreground }]}
              placeholder="e.g. New listing: PEPE/USDT" placeholderTextColor={colors.mutedForeground}
              value={form.title} onChangeText={(v) => setForm(f => ({ ...f, title: v }))}
              maxLength={120}
            />
          </View>

          <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>BODY</Text>
            <TextInput
              style={[styles.inputField, { color: colors.foreground, minHeight: 100, textAlignVertical: "top" }]}
              placeholder="Write the announcement that all users will see…" placeholderTextColor={colors.mutedForeground}
              value={form.body} onChangeText={(v) => setForm(f => ({ ...f, body: v }))}
              multiline maxLength={2000}
            />
            <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 4, textAlign: "right" }}>{form.body.length}/2000</Text>
          </View>

          <View style={{ backgroundColor: meta(form.type).color + "12", borderRadius: 10, padding: 12, flexDirection: "row", gap: 8 }}>
            <Feather name="info" size={13} color={meta(form.type).color} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: meta(form.type).color, lineHeight: 18 }}>
              {editing ? "Edits update the existing notification for everyone." : "Sending creates one notification visible to every user. They can mark it read or dismiss it from their bell tab."}
            </Text>
          </View>

          <TouchableOpacity style={[styles.btn, { backgroundColor: "#F0B90B", marginTop: 4 }]} onPress={save} activeOpacity={0.85} disabled={saving}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#000" }}>{editing ? "Save Changes" : "Send to All Users"}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Broadcasts</Text>
        <TouchableOpacity onPress={openNew} style={styles.backBtn}><Feather name="plus" size={20} color="#F0B90B" /></TouchableOpacity>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 }}>
          <Feather name="bell" size={42} color={colors.mutedForeground} />
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>No broadcasts yet</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center" }}>
            Send your first announcement — it will appear in every user's bell tab.
          </Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#F0B90B", paddingHorizontal: 32 }]} onPress={openNew}>
            <Text style={{ color: "#000", fontFamily: "Inter_700Bold" }}>Send First Broadcast</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
          {items.map((n) => {
            const m = meta(n.type);
            return (
              <View key={n.id} style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, opacity: n.is_active ? 1 : 0.55 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: m.color + "18", alignItems: "center", justifyContent: "center" }}>
                    <Feather name={m.icon} size={16} color={m.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }} numberOfLines={1}>{n.title}</Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 3, lineHeight: 17 }} numberOfLines={3}>{n.body}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <View style={{ backgroundColor: m.color + "15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: m.color, textTransform: "uppercase" }}>{m.label}</Text>
                  </View>
                  <View style={{ backgroundColor: n.is_active ? "#0ECB8115" : "#84848420", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: n.is_active ? "#0ECB81" : colors.mutedForeground }}>{n.is_active ? "LIVE" : "HIDDEN"}</Text>
                  </View>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, alignSelf: "center" }}>
                    {new Date(n.created_at).toLocaleString()}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity onPress={() => toggleActive(n)} style={[styles.approveBtn, { flex: 1, marginTop: 0, borderColor: n.is_active ? "#F6465D" : "#0ECB81" }]}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: n.is_active ? "#F6465D" : "#0ECB81" }}>{n.is_active ? "Hide" : "Show"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEdit(n)} style={[styles.approveBtn, { flex: 1, marginTop: 0, borderColor: "#628EEA" }]}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#628EEA" }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(n)} style={[styles.approveBtn, { width: 46, marginTop: 0, borderColor: "#F6465D" }]}>
                    <Feather name="trash-2" size={14} color="#F6465D" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "pending" ? "#F0B90B" : status === "approved" ? "#0ECB81" : "#F6465D";
  return (
    <View style={{ backgroundColor: color + "18", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color, textTransform: "capitalize" }}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  iconCircle: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  btn: { borderRadius: 14, paddingVertical: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginLeft: 4 },
  menuCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  menuIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  inputGroup: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 },
  inputLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: 6 },
  inputField: { fontSize: 14, fontFamily: "Inter_400Regular" },
  addrCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  coinBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  approveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, borderRadius: 10, paddingVertical: 10, borderWidth: 1 },
  toggleBtn: { width: 44, height: 26, borderRadius: 13, borderWidth: 1, justifyContent: "center", paddingHorizontal: 3 },
  toggleKnob: { width: 20, height: 20, borderRadius: 10 },
});
