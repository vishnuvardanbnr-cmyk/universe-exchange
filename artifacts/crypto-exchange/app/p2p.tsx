import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE
  ? process.env.EXPO_PUBLIC_API_BASE
  : `https://${process.env["EXPO_PUBLIC_DOMAIN"] ?? "localhost:8080"}`;

const P2P_ALL_COINS = ["USDT"];
const P2P_PAYMENT_METHODS = [
  "UPI", "IMPS", "NEFT", "RTGS",
  "PhonePe", "Google Pay", "Paytm",
  "Bank Transfer", "Amazon Pay", "Mobikwik",
];

type PayField = { key: string; label: string; placeholder: string };
const PAYMENT_METHOD_FIELDS: Record<string, PayField[]> = {
  "UPI":           [{ key: "upi_id",          label: "UPI ID",                 placeholder: "yourname@upi" }],
  "IMPS":          [{ key: "account_number",  label: "Account Number",         placeholder: "000000000000" },
                    { key: "ifsc_code",        label: "IFSC Code",              placeholder: "SBIN0001234" },
                    { key: "account_name",     label: "Account Holder Name",    placeholder: "Full Name" }],
  "NEFT":          [{ key: "account_number",  label: "Account Number",         placeholder: "000000000000" },
                    { key: "ifsc_code",        label: "IFSC Code",              placeholder: "SBIN0001234" },
                    { key: "account_name",     label: "Account Holder Name",    placeholder: "Full Name" },
                    { key: "bank_name",        label: "Bank Name",              placeholder: "State Bank of India" }],
  "RTGS":          [{ key: "account_number",  label: "Account Number",         placeholder: "000000000000" },
                    { key: "ifsc_code",        label: "IFSC Code",              placeholder: "SBIN0001234" },
                    { key: "account_name",     label: "Account Holder Name",    placeholder: "Full Name" },
                    { key: "bank_name",        label: "Bank Name",              placeholder: "State Bank of India" }],
  "PhonePe":       [{ key: "phone",            label: "Phone / UPI ID",         placeholder: "+91 9999999999" }],
  "Google Pay":    [{ key: "phone",            label: "Phone / UPI ID",         placeholder: "+91 9999999999" }],
  "Paytm":         [{ key: "phone",            label: "Phone / Wallet ID",      placeholder: "+91 9999999999" }],
  "Bank Transfer": [{ key: "account_number",  label: "Account Number",         placeholder: "000000000000" },
                    { key: "ifsc_code",        label: "IFSC Code",              placeholder: "SBIN0001234" },
                    { key: "account_name",     label: "Account Holder Name",    placeholder: "Full Name" },
                    { key: "bank_name",        label: "Bank Name",              placeholder: "State Bank of India" }],
  "Amazon Pay":    [{ key: "phone",            label: "Phone / Amazon Pay ID",  placeholder: "+91 9999999999" }],
  "Mobikwik":      [{ key: "phone",            label: "Phone Number",           placeholder: "+91 9999999999" }],
};

const COIN_COLORS: Record<string, string> = {
  USDT:"#26A17B", BTC:"#F7931A", ETH:"#627EEA", BNB:"#F0B90B",
  SOL:"#9945FF", XRP:"#346AA9",
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending Payment", color: "#F0B90B" },
  paid:      { label: "Payment Sent",    color: "#2775CA" },
  released:  { label: "Completed",       color: "#0ECB81" },
  cancelled: { label: "Cancelled",       color: "#848E9C" },
  disputed:  { label: "Disputed",        color: "#F6465D" },
  resolved:  { label: "Resolved",        color: "#0ECB81" },
};

type P2PAd = {
  id: number; user_id: string; type: "buy" | "sell"; coin: string;
  fiat_currency: string; price: number; min_amount: number; max_amount: number;
  available_amount: number; payment_methods: string[]; terms?: string;
  status: string; merchant: string; orders: number; completion: string;
  verified?: boolean;
};

type P2POrder = {
  id: number; ad_id: number; buyer_id: string; seller_id: string; coin: string;
  crypto_amount: number; fiat_amount: number; price: number;
  payment_method: string; status: string; dispute_reason?: string;
  admin_note?: string; created_at: string; ad_type?: string;
  is_buyer: boolean; terms?: string; ad_payment_methods?: string[];
  payment_proof?: string | null; payment_window_minutes?: number; paid_at?: string | null;
};

type SellerPayment = { method: string; details: Record<string, string> | null; seller_name: string };

type P2PMsg = { id: number; sender_id: string; message: string; created_at: string; is_me: boolean };

type View = "browse" | "my-orders" | "my-ads" | "order-detail";

function apiFetch(path: string, userId: string, opts?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
      ...(opts?.headers ?? {}),
    },
  });
}

export default function P2PScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [view, setView] = useState<View>("browse");
  const [selectedOrder, setSelectedOrder] = useState<P2POrder | null>(null);

  const openOrderById = useCallback(async (orderId: number) => {
    if (!userId) return;
    try {
      const r = await apiFetch(`/api/p2p/orders/${orderId}`, userId);
      const d = await r.json();
      if (d.order) { setSelectedOrder(d.order); setView("order-detail"); }
    } catch {}
  }, [userId]);

  const topPad = Platform.OS === "web" ? 20 : insets.top + 8;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => view === "browse" ? router.back() : setView("browse")} style={s.headerBack}>
          <Feather name={view === "browse" ? "x" : "arrow-left"} size={21} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>
            {view === "browse" ? "P2P Trading" : view === "my-orders" ? "My Orders" : view === "my-ads" ? "My Ads" : "Order Detail"}
          </Text>
          {view === "browse" && (
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
              Peer-to-peer crypto trading
            </Text>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          {view === "browse" && (
            <>
              <TouchableOpacity onPress={() => setView("my-orders")}>
                <Feather name="list" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setView("my-ads")}>
                <Feather name="briefcase" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {view === "browse" && <BrowseView userId={userId} colors={colors} onOrderOpen={(o) => { setSelectedOrder(o); setView("order-detail"); }} onOrderPlaced={openOrderById} />}
      {view === "my-orders" && <MyOrdersView userId={userId} colors={colors} onSelect={(o) => { setSelectedOrder(o); setView("order-detail"); }} />}
      {view === "my-ads" && <MyAdsView userId={userId} colors={colors} />}
      {view === "order-detail" && selectedOrder && (
        <OrderDetailView
          userId={userId} colors={colors} order={selectedOrder}
          onBack={() => setView("my-orders")}
          onUpdated={(o) => setSelectedOrder(o)}
        />
      )}
    </View>
  );
}

// ─── PaymentFilterBar ──────────────────────────────────────────────────────────
function PaymentFilterBar({ payFilter, setPayFilter, colors }: { payFilter: string; setPayFilter: (v: string) => void; colors: any }) {
  const [open, setOpen] = useState(false);
  const methods = ["All", ...P2P_PAYMENT_METHODS];

  return (
    <>
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingVertical: 10,
        backgroundColor: colors.card,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
      }}>
        {/* Left: USDT badge */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6,
          backgroundColor: "#26A17B18", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
          borderWidth: 1, borderColor: "#26A17B" }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#26A17B", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 7, fontFamily: "Inter_700Bold", color: "#fff" }}>U</Text>
          </View>
          <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#26A17B" }}>USDT</Text>
        </View>

        {/* Right: Payment filter dropdown */}
        <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.75}
          style={{ flexDirection: "row", alignItems: "center", gap: 6,
            backgroundColor: payFilter !== "All" ? colors.primary + "15" : colors.secondary,
            borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
            borderWidth: 1, borderColor: payFilter !== "All" ? colors.primary : colors.border }}>
          <Feather name="credit-card" size={13} color={payFilter !== "All" ? colors.primary : colors.mutedForeground} />
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold",
            color: payFilter !== "All" ? colors.primary : colors.mutedForeground }}>
            {payFilter === "All" ? "Payment" : payFilter}
          </Text>
          <Feather name="chevron-down" size={13} color={payFilter !== "All" ? colors.primary : colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Payment picker modal */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "#00000060" }} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0,
            backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingBottom: 32 }}>
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground,
              paddingHorizontal: 20, paddingBottom: 12 }}>Select Payment Method</Text>
            <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
              {methods.map((m, i) => {
                const active = payFilter === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { setPayFilter(m); setOpen(false); }} activeOpacity={0.7}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                      paddingHorizontal: 20, paddingVertical: 15,
                      borderBottomWidth: i < methods.length - 1 ? StyleSheet.hairlineWidth : 0,
                      borderBottomColor: colors.border }}>
                    <Text style={{ fontSize: 14, fontFamily: active ? "Inter_700Bold" : "Inter_400Regular",
                      color: active ? colors.primary : colors.foreground }}>{m}</Text>
                    {active && <Feather name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── BrowseView ────────────────────────────────────────────────────────────────
function BrowseView({ userId, colors, onOrderOpen, onOrderPlaced }: { userId: string; colors: any; onOrderOpen: (o: P2POrder) => void; onOrderPlaced: (id: number) => void }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [coin, setCoin] = useState("USDT");
  const [payFilter, setPayFilter] = useState("All");
  const [ads, setAds] = useState<P2PAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [placeAd, setPlaceAd] = useState<P2PAd | null>(null);
  const [showCreateAd, setShowCreateAd] = useState(false);

  const fetchAds = useCallback(async () => {
    try {
      const adType = side === "buy" ? "sell" : "buy";
      let url = `/api/p2p/ads?type=${adType}&coin=${coin}`;
      if (payFilter !== "All") url += `&payment=${encodeURIComponent(payFilter)}`;
      const r = await fetch(`${API_BASE}${url}`);
      const d = await r.json();
      setAds(d.ads ?? []);
    } catch { setAds([]); } finally { setLoading(false); setRefreshing(false); }
  }, [side, coin, payFilter]);

  useEffect(() => { setLoading(true); fetchAds(); }, [fetchAds]);

  const btnColor = side === "buy" ? "#0ECB81" : "#F6465D";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* ── Buy / Sell tabs ── */}
      <View style={{ flexDirection: "row", backgroundColor: colors.card }}>
        {(["buy","sell"] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setSide(t)} activeOpacity={0.8}
            style={{ flex: 1, paddingVertical: 13, alignItems: "center",
              borderBottomWidth: 2.5,
              borderBottomColor: side === t ? (t === "buy" ? "#0ECB81" : "#F6465D") : "transparent" }}>
            <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold",
              color: side === t ? (t === "buy" ? "#0ECB81" : "#F6465D") : colors.mutedForeground }}>
              {t === "buy" ? "Buy" : "Sell"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Filter bar ── */}
      <PaymentFilterBar
        payFilter={payFilter}
        setPayFilter={setPayFilter}
        colors={colors}
      />

      {/* ── Column headers ── */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
        backgroundColor: colors.background }}>
        <Text style={{ flex: 1, fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.4 }}>ADVERTISER</Text>
        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.4 }}>PRICE / LIMITS</Text>
      </View>

      {/* ── Ads list ── */}
      <ScrollView style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAds(); }} tintColor={colors.primary} />}>
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 70, gap: 14 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Fetching offers…</Text>
          </View>
        ) : ads.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 70, gap: 14 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}>
              <Feather name="inbox" size={32} color={colors.border} />
            </View>
            <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>No offers right now</Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", paddingHorizontal: 40, lineHeight: 20 }}>
              No one is {side === "buy" ? "selling" : "buying"} {coin} at the moment.{userId ? " Be the first to post an ad." : ""}
            </Text>
            {userId && (
              <TouchableOpacity onPress={() => setShowCreateAd(true)} activeOpacity={0.85}
                style={{ marginTop: 4, backgroundColor: "#F0B90B", paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12, flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Feather name="plus" size={16} color="#000" />
                <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" }}>Post an Ad</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          ads.map((ad, i) => (
            <AdCard key={ad.id} ad={ad} side={side} colors={colors} userId={userId}
              isLast={i === ads.length - 1} onPress={() => setPlaceAd(ad)} />
          ))
        )}
      </ScrollView>

      {/* ── FAB ── */}
      {userId ? (
        <TouchableOpacity onPress={() => setShowCreateAd(true)} activeOpacity={0.9}
          style={{ position: "absolute", bottom: 24, right: 18,
            backgroundColor: "#F0B90B", paddingHorizontal: 20, paddingVertical: 13,
            borderRadius: 28, flexDirection: "row", gap: 8, alignItems: "center",
            shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
          <Feather name="plus" size={18} color="#000" />
          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" }}>Post Ad</Text>
        </TouchableOpacity>
      ) : null}

      {placeAd && (
        <PlaceOrderModal ad={placeAd} side={side} userId={userId} colors={colors}
          onClose={() => setPlaceAd(null)}
          onSuccess={(orderId) => {
            setPlaceAd(null);
            fetchAds();
            onOrderPlaced(orderId);
          }}
        />
      )}
      {showCreateAd && (
        <CreateAdModal userId={userId} colors={colors}
          onClose={() => setShowCreateAd(false)}
          onSuccess={() => { setShowCreateAd(false); fetchAds(); }}
        />
      )}
    </View>
  );
}

// ─── AdCard (Binance-style) ────────────────────────────────────────────────────
function AdCard({ ad, side, colors, userId, isLast, onPress }:
  { ad: P2PAd; side: "buy"|"sell"; colors: any; userId: string; isLast: boolean; onPress: () => void }) {
  const coinColor = COIN_COLORS[ad.coin] ?? "#848E9C";
  const isOwn = ad.user_id === userId;
  const btnColor = side === "buy" ? "#0ECB81" : "#F6465D";
  const initials = ad.merchant.replace("Trader_","").slice(0, 2);

  return (
    <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>

      {/* ── Top row: avatar + name + stats | price + button ── */}
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        {/* Left: avatar + info */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 }}>
          {/* Avatar — gold ring for verified */}
          <View style={{ position: "relative" }}>
            <View style={{ width: 34, height: 34, borderRadius: 17,
              backgroundColor: coinColor + "25", alignItems: "center", justifyContent: "center",
              borderWidth: ad.verified ? 1.5 : 1,
              borderColor: ad.verified ? "#F0B90B" : coinColor + "40" }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: coinColor }}>{initials}</Text>
            </View>
            {ad.verified && (
              <View style={{ position: "absolute", bottom: -3, right: -4,
                width: 14, height: 14, borderRadius: 7,
                backgroundColor: "#F0B90B", alignItems: "center", justifyContent: "center",
                borderWidth: 1.5, borderColor: colors.card }}>
                <Feather name="check" size={8} color="#000" />
              </View>
            )}
          </View>
          <View style={{ flex: 1, paddingTop: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{ad.merchant}</Text>
              {ad.verified && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3,
                  backgroundColor: "#F0B90B18", borderRadius: 5,
                  paddingHorizontal: 5, paddingVertical: 2,
                  borderWidth: 0.5, borderColor: "#F0B90B60" }}>
                  <Feather name="shield" size={9} color="#F0B90B" />
                  <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#F0B90B", letterSpacing: 0.3 }}>VERIFIED</Text>
                </View>
              )}
              {isOwn && (
                <View style={{ backgroundColor: "#F0B90B20", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#F0B90B" }}>YOU</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 }}>
              {ad.orders} orders · {ad.completion}
            </Text>
          </View>
        </View>

        {/* Right: price + button */}
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <View style={{ alignItems: "flex-end" }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
              <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: btnColor, letterSpacing: -0.3 }}>
                {ad.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>USD</Text>
            </View>
            <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>per {ad.coin}</Text>
          </View>
          <TouchableOpacity onPress={onPress} disabled={isOwn} activeOpacity={0.85}
            style={{ backgroundColor: isOwn ? colors.secondary : btnColor,
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
              borderWidth: isOwn ? StyleSheet.hairlineWidth : 0, borderColor: colors.border }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold",
              color: isOwn ? colors.mutedForeground : "#fff" }}>
              {isOwn ? "Your ad" : side === "buy" ? `Buy ${ad.coin}` : `Sell ${ad.coin}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Bottom: limits + payment methods ── */}
      <View style={{ marginTop: 10, marginLeft: 44, gap: 7 }}>
        <View style={{ flexDirection: "row", gap: 24 }}>
          <View>
            <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Available</Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
              {ad.available_amount.toFixed(4)} {ad.coin}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Limit (USD)</Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
              {ad.min_amount.toLocaleString()} – {ad.max_amount.toLocaleString()}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
          {ad.payment_methods.slice(0, 3).map(pm => (
            <View key={pm} style={{ backgroundColor: colors.secondary, borderRadius: 5,
              paddingHorizontal: 8, paddingVertical: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{pm}</Text>
            </View>
          ))}
          {ad.payment_methods.length > 3 && (
            <View style={{ backgroundColor: colors.secondary, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>+{ad.payment_methods.length - 3} more</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── PlaceOrderModal ───────────────────────────────────────────────────────────
function PlaceOrderModal({ ad, side, userId, colors, onClose, onSuccess }:
  { ad: P2PAd; side: "buy"|"sell"; userId: string; colors: any; onClose: () => void; onSuccess: (id: number) => void }) {
  const [cryptoAmt, setCryptoAmt] = useState("");
  const [payMethod, setPayMethod] = useState(ad.payment_methods[0] ?? "Bank Transfer");
  const [submitting, setSubmitting] = useState(false);

  if (!userId) {
    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 16, padding: 40 }}>
          <Feather name="lock" size={48} color={colors.border} />
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground }}>Sign in Required</Text>
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" }}>
            You must be signed in to place P2P orders.
          </Text>
          <TouchableOpacity onPress={onClose} style={{ backgroundColor: colors.primary, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 10 }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: colors.primaryForeground }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  const numAmt = parseFloat(cryptoAmt) || 0;
  const fiatTotal = numAmt * ad.price;
  const btnColor = side === "buy" ? "#0ECB81" : "#F6465D";

  const submit = async () => {
    if (numAmt < ad.min_amount || numAmt > ad.max_amount) {
      Alert.alert("Invalid Amount", `Enter between ${ad.min_amount} and ${ad.max_amount} ${ad.coin}`);
      return;
    }
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/p2p/orders", userId, {
        method: "POST",
        body: JSON.stringify({ ad_id: ad.id, crypto_amount: numAmt, payment_method: payMethod }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess(d.order_id);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally { setSubmitting(false); }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[s.header, { paddingTop: 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>
            {side === "buy" ? "Buy" : "Sell"} {ad.coin}
          </Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          {/* Ad summary */}
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 10 }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.8 }}>ADVERTISER</Text>
            <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>{ad.merchant}</Text>
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Price</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: btnColor }}>${ad.price.toLocaleString()} / {ad.coin}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Limits</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{ad.min_amount} – {ad.max_amount} {ad.coin}</Text>
            </View>
            {ad.terms && (
              <View style={{ backgroundColor: colors.secondary, borderRadius: 8, padding: 10 }}>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 16 }}>{ad.terms}</Text>
              </View>
            )}
          </View>

          {/* Amount */}
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.8 }}>AMOUNT ({ad.coin})</Text>
              <TouchableOpacity onPress={() => setCryptoAmt(ad.available_amount.toFixed(8))}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: colors.primary }}>MAX</Text>
              </TouchableOpacity>
            </View>
            <View style={{ backgroundColor: colors.secondary, borderRadius: 12, flexDirection: "row", alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 14 }}>
              <TextInput
                style={{ flex: 1, fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground }}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                value={cryptoAmt}
                onChangeText={setCryptoAmt}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>{ad.coin}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>You {side === "buy" ? "pay" : "receive"}</Text>
              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>${fiatTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD</Text>
            </View>
          </View>

          {/* Payment method */}
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 10 }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.8 }}>PAYMENT METHOD</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {ad.payment_methods.map(pm => (
                <TouchableOpacity key={pm} onPress={() => setPayMethod(pm)}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                    backgroundColor: payMethod === pm ? "#0ECB8118" : colors.secondary,
                    borderWidth: 1, borderColor: payMethod === pm ? "#0ECB81" : colors.border }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: payMethod === pm ? "#0ECB81" : colors.mutedForeground }}>{pm}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Warning */}
          <View style={{ backgroundColor: "#F0B90B12", borderRadius: 12, padding: 14, flexDirection: "row", gap: 8 }}>
            <Feather name="alert-triangle" size={14} color="#F0B90B" style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#F0B90B", lineHeight: 18 }}>
              Never cancel an order after making a payment. Always verify payment receipt before releasing crypto. Disputes are reviewed by admin.
            </Text>
          </View>

          <TouchableOpacity onPress={submit} disabled={submitting || numAmt <= 0}
            style={{ backgroundColor: numAmt > 0 && !submitting ? btnColor : colors.border, borderRadius: 14, padding: 18, alignItems: "center" }}
            activeOpacity={0.85}>
            {submitting ? <ActivityIndicator color="#fff" /> : (
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" }}>
                Confirm {side === "buy" ? "Purchase" : "Sale"} →
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── CreateAdModal ─────────────────────────────────────────────────────────────
function CreateAdModal({ userId, colors, onClose, onSuccess }: { userId: string; colors: any; onClose: () => void; onSuccess: () => void }) {
  const [type, setType] = useState<"buy"|"sell">("sell");
  const [coin, setCoin] = useState("USDT");
  const [price, setPrice] = useState("");
  const [minAmt, setMinAmt] = useState("");
  const [maxAmt, setMaxAmt] = useState("");
  const [availAmt, setAvailAmt] = useState("");
  const [selectedPays, setSelectedPays] = useState<string[]>(["Bank Transfer"]);
  const [terms, setTerms] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [payDetails, setPayDetails] = useState<Record<string, Record<string, string>>>({});
  const [loadingDetails, setLoadingDetails] = useState(true);

  useEffect(() => {
    if (!userId) { setLoadingDetails(false); return; }
    apiFetch("/api/p2p/payment-details", userId)
      .then(r => r.json())
      .then(d => { if (d.details) setPayDetails(d.details); })
      .catch(() => {})
      .finally(() => setLoadingDetails(false));
  }, [userId]);

  const togglePay = (pm: string) => {
    setSelectedPays(prev => prev.includes(pm) ? prev.filter(p => p !== pm) : [...prev, pm]);
  };

  const setDetailField = (method: string, key: string, value: string) => {
    setPayDetails(prev => ({
      ...prev,
      [method]: { ...(prev[method] ?? {}), [key]: value },
    }));
  };

  const submit = async () => {
    if (!price || !minAmt || !maxAmt || !availAmt || selectedPays.length === 0) {
      Alert.alert("Missing Fields", "Please fill in all required fields."); return;
    }
    for (const pm of selectedPays) {
      const fields = PAYMENT_METHOD_FIELDS[pm] ?? [];
      const saved = payDetails[pm] ?? {};
      for (const f of fields) {
        if (!saved[f.key]?.trim()) {
          Alert.alert("Missing Payment Details", `Please fill in your ${f.label} for ${pm}.`); return;
        }
      }
    }
    setSubmitting(true);
    try {
      await Promise.all(
        selectedPays.map(pm =>
          apiFetch("/api/p2p/payment-details", userId, {
            method: "PUT",
            body: JSON.stringify({ method: pm, details: payDetails[pm] ?? {} }),
          })
        )
      );
      const r = await apiFetch("/api/p2p/ads", userId, {
        method: "POST",
        body: JSON.stringify({ type, coin, price: parseFloat(price), min_amount: parseFloat(minAmt),
          max_amount: parseFloat(maxAmt), available_amount: parseFloat(availAmt),
          payment_methods: selectedPays, terms: terms || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setSubmitting(false); }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[s.header, { paddingTop: 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>Post P2P Ad</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          {/* Buy/Sell type */}
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 10 }}>
            <Text style={[s.label, { color: colors.mutedForeground }]}>I WANT TO</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {(["sell","buy"] as const).map(t => (
                <TouchableOpacity key={t} onPress={() => setType(t)}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center",
                    backgroundColor: type === t ? (t === "sell" ? "#0ECB8118" : "#F6465D18") : colors.secondary,
                    borderWidth: 1, borderColor: type === t ? (t === "sell" ? "#0ECB81" : "#F6465D") : colors.border }}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold",
                    color: type === t ? (t === "sell" ? "#0ECB81" : "#F6465D") : colors.mutedForeground }}>
                    {t === "sell" ? "Sell Crypto" : "Buy Crypto"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Coin */}
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 10 }}>
            <Text style={[s.label, { color: colors.mutedForeground }]}>COIN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {P2P_ALL_COINS.map(c => (
                <TouchableOpacity key={c} onPress={() => setCoin(c)}
                  style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: coin === c ? (COIN_COLORS[c] ?? colors.primary) + "22" : colors.secondary,
                    borderWidth: 1, borderColor: coin === c ? (COIN_COLORS[c] ?? colors.primary) : colors.border }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold",
                    color: coin === c ? (COIN_COLORS[c] ?? colors.primary) : colors.mutedForeground }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Price & amounts */}
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 14 }}>
            <Text style={[s.label, { color: colors.mutedForeground }]}>PRICING & LIMITS</Text>
            {[
              { label: "Your Price (USD per coin)", val: price, set: setPrice, placeholder: "e.g. 68000" },
              { label: type === "sell" ? "Available Amount (to sell)" : "Max Amount (you want)", val: availAmt, set: setAvailAmt, placeholder: `in ${coin}` },
              { label: "Min Order Amount (USD)", val: minAmt, set: setMinAmt, placeholder: "e.g. 100" },
              { label: "Max Order Amount (USD)", val: maxAmt, set: setMaxAmt, placeholder: "e.g. 5000" },
            ].map(({ label, val, set, placeholder }) => (
              <View key={label} style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>{label}</Text>
                <TextInput
                  style={{ backgroundColor: colors.secondary, borderRadius: 10, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}
                  placeholder={placeholder} placeholderTextColor={colors.mutedForeground}
                  value={val} onChangeText={set} keyboardType="decimal-pad"
                />
              </View>
            ))}
          </View>

          {/* Payment methods */}
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 10 }}>
            <Text style={[s.label, { color: colors.mutedForeground }]}>PAYMENT METHODS (select all that apply)</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {P2P_PAYMENT_METHODS.map(pm => {
                const sel = selectedPays.includes(pm);
                return (
                  <TouchableOpacity key={pm} onPress={() => togglePay(pm)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
                      backgroundColor: sel ? "#0ECB8118" : colors.secondary,
                      borderWidth: 1, borderColor: sel ? "#0ECB81" : colors.border }}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: sel ? "#0ECB81" : colors.mutedForeground }}>{pm}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Payment details — per selected method */}
          {selectedPays.length > 0 && (
            <View style={{ gap: 12 }}>
              {selectedPays.map(pm => {
                const fields = PAYMENT_METHOD_FIELDS[pm] ?? [];
                if (fields.length === 0) return null;
                const saved = payDetails[pm] ?? {};
                const hasAll = fields.every(f => saved[f.key]?.trim());
                return (
                  <View key={pm} style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 12,
                    borderWidth: 1, borderColor: hasAll ? "#0ECB8130" : colors.border }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#0ECB81" }} />
                        <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>{pm}</Text>
                        <Text style={[s.label, { color: colors.mutedForeground, fontSize: 10 }]}>PAYMENT DETAILS</Text>
                      </View>
                      {hasAll && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Feather name="check-circle" size={13} color="#0ECB81" />
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#0ECB81" }}>Saved</Text>
                        </View>
                      )}
                    </View>
                    {fields.map(f => (
                      <View key={f.key} style={{ gap: 5 }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>{f.label}</Text>
                        <TextInput
                          style={{ backgroundColor: colors.secondary, borderRadius: 10, padding: 12,
                            fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground,
                            borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}
                          placeholder={f.placeholder} placeholderTextColor={colors.mutedForeground}
                          value={saved[f.key] ?? ""}
                          onChangeText={v => setDetailField(pm, f.key, v)}
                          autoCapitalize="none" autoCorrect={false}
                        />
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          )}

          {/* Terms */}
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 8 }}>
            <Text style={[s.label, { color: colors.mutedForeground }]}>TERMS (optional)</Text>
            <TextInput
              style={{ backgroundColor: colors.secondary, borderRadius: 10, padding: 12, fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, minHeight: 70, textAlignVertical: "top" }}
              placeholder="Describe payment instructions, requirements, or notes for buyers…"
              placeholderTextColor={colors.mutedForeground}
              value={terms} onChangeText={setTerms} multiline numberOfLines={3}
            />
          </View>

          {type === "sell" && (
            <View style={{ backgroundColor: "#F0B90B12", borderRadius: 12, padding: 12, flexDirection: "row", gap: 8 }}>
              <Feather name="info" size={14} color="#F0B90B" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#F0B90B", lineHeight: 18 }}>
                The "available amount" will be locked from your balance when creating a sell ad. It's returned when you delete the ad.
              </Text>
            </View>
          )}

          <TouchableOpacity onPress={submit} disabled={submitting}
            style={{ backgroundColor: submitting ? colors.border : "#F0B90B", borderRadius: 14, padding: 18, alignItems: "center" }}
            activeOpacity={0.85}>
            {submitting ? <ActivityIndicator color="#000" /> : (
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" }}>Post Ad</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── MyOrdersView ──────────────────────────────────────────────────────────────
function MyOrdersView({ userId, colors, onSelect }: { userId: string; colors: any; onSelect: (o: P2POrder) => void }) {
  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<"all"|"buyer"|"seller">("all");

  const fetchOrders = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const r = await apiFetch(`/api/p2p/orders${roleFilter !== "all" ? `?role=${roleFilter}` : ""}`, userId);
      const d = await r.json();
      setOrders(d.orders ?? []);
    } catch { setOrders([]); } finally { setLoading(false); }
  }, [userId, roleFilter]);

  useEffect(() => { setLoading(true); fetchOrders(); }, [fetchOrders]);

  if (!userId) return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <Feather name="lock" size={44} color={colors.border} />
      <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Sign in to view orders</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", backgroundColor: colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
        {(["all","buyer","seller"] as const).map(r => (
          <TouchableOpacity key={r} onPress={() => setRoleFilter(r)}
            style={{ flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: roleFilter === r ? colors.primary : "transparent" }}>
            <Text style={{ fontSize: 13, fontFamily: roleFilter === r ? "Inter_700Bold" : "Inter_400Regular",
              color: roleFilter === r ? colors.primary : colors.mutedForeground }}>
              {r === "all" ? "All" : r === "buyer" ? "Buying" : "Selling"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} /> : orders.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}>
            <Feather name="inbox" size={44} color={colors.border} />
            <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>No orders yet</Text>
          </View>
        ) : orders.map(order => {
          const meta = STATUS_META[order.status] ?? { label: order.status, color: "#848E9C" };
          return (
            <TouchableOpacity key={order.id} onPress={() => onSelect(order)}
              style={[s.adCard, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.8}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                  {order.is_buyer ? "Buy" : "Sell"} {order.coin} · #{order.id}
                </Text>
                <View style={{ backgroundColor: meta.color + "18", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: meta.color }}>{meta.label}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Crypto</Text>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>{order.crypto_amount} {order.coin}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Fiat Total</Text>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                    ${order.fiat_amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 8 }}>
                Via {order.payment_method} · {new Date(order.created_at).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── MyAdsView ────────────────────────────────────────────────────────────────
function MyAdsView({ userId, colors }: { userId: string; colors: any }) {
  const [ads, setAds] = useState<P2PAd[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAds = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const r = await apiFetch("/api/p2p/ads/mine", userId);
      const d = await r.json();
      setAds(d.ads ?? []);
    } catch { setAds([]); } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  const toggleAd = async (id: number) => {
    try {
      const r = await apiFetch(`/api/p2p/ads/${id}/toggle`, userId, { method: "PATCH" });
      if (r.ok) { Haptics.selectionAsync(); fetchAds(); }
    } catch { Alert.alert("Error", "Failed to toggle ad"); }
  };

  const deleteAd = (id: number) => {
    Alert.alert("Delete Ad", "Are you sure? This will return any locked funds.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          const r = await apiFetch(`/api/p2p/ads/${id}`, userId, { method: "DELETE" });
          if (r.ok) fetchAds();
        } catch { Alert.alert("Error", "Failed to delete ad"); }
      }},
    ]);
  };

  if (!userId) return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.mutedForeground }}>Sign in to view your ads</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} /> : ads.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}>
          <Feather name="inbox" size={44} color={colors.border} />
          <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>No ads posted</Text>
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", paddingHorizontal: 30 }}>
            Create an ad from the Browse tab to start trading.
          </Text>
        </View>
      ) : ads.map(ad => (
        <View key={ad.id} style={[s.adCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                {ad.type === "sell" ? "Selling" : "Buying"} {ad.coin}
              </Text>
              <View style={{ backgroundColor: ad.status === "active" ? "#0ECB8118" : "#F6465D18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: ad.status === "active" ? "#0ECB81" : "#F6465D" }}>
                  {ad.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => toggleAd(ad.id)}>
                <Feather name={ad.status === "active" ? "pause-circle" : "play-circle"} size={22} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteAd(ad.id)}>
                <Feather name="trash-2" size={22} color="#F6465D" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 20 }}>
            <View>
              <Text style={{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>Price</Text>
              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#0ECB81" }}>${ad.price.toLocaleString()}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>Available</Text>
              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>{ad.available_amount.toFixed(4)} {ad.coin}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>Limits (USD)</Text>
              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>${ad.min_amount} – ${ad.max_amount}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {ad.payment_methods.map(pm => (
              <View key={pm} style={{ backgroundColor: colors.secondary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{pm}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── OrderDetailView ──────────────────────────────────────────────────────────
function OrderDetailView({ userId, colors, order: initialOrder, onBack, onUpdated }:
  { userId: string; colors: any; order: P2POrder; onBack: () => void; onUpdated: (o: P2POrder) => void }) {
  const [order, setOrder] = useState<P2POrder>(initialOrder);
  const [messages, setMessages] = useState<P2PMsg[]>([]);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeInput, setShowDisputeInput] = useState(false);
  const [sellerPay, setSellerPay] = useState<SellerPayment | null>(null);
  const [paymentProof, setPaymentProof] = useState("");
  const [showPayInput, setShowPayInput] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Live ticking clock for countdown
  useEffect(() => {
    if (order.status !== "pending") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [order.status]);

  // Fetch seller payment details (buyer-only, when pending or paid)
  useEffect(() => {
    if (!order.is_buyer || !["pending","paid","disputed"].includes(order.status)) return;
    (async () => {
      try {
        const r = await apiFetch(`/api/p2p/orders/${order.id}/seller-payment`, userId);
        if (r.ok) setSellerPay(await r.json());
      } catch {}
    })();
  }, [order.id, order.is_buyer, order.status, userId]);

  // Countdown
  const windowMin = order.payment_window_minutes ?? 15;
  const expiresAt = new Date(order.created_at).getTime() + windowMin * 60_000;
  const remainingMs = Math.max(0, expiresAt - now);
  const remainingMin = Math.floor(remainingMs / 60000);
  const remainingSec = Math.floor((remainingMs % 60000) / 1000);
  const expired = order.status === "pending" && remainingMs === 0;

  const refreshOrder = useCallback(async () => {
    try {
      const r = await apiFetch(`/api/p2p/orders/${order.id}`, userId);
      const d = await r.json();
      if (d.order) { setOrder(d.order); onUpdated(d.order); }
    } catch {}
  }, [order.id, userId]);

  const refreshMsgs = useCallback(async () => {
    try {
      const r = await apiFetch(`/api/p2p/orders/${order.id}/messages`, userId);
      const d = await r.json();
      setMessages(d.messages ?? []);
    } catch {}
  }, [order.id, userId]);

  useEffect(() => { refreshMsgs(); const t = setInterval(refreshMsgs, 5000); return () => clearInterval(t); }, [refreshMsgs]);

  const sendMsg = async () => {
    if (!msgText.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/p2p/orders/${order.id}/messages`, userId, {
        method: "POST", body: JSON.stringify({ message: msgText.trim() })
      });
      setMsgText("");
      refreshMsgs();
    } catch { Alert.alert("Error", "Failed to send message"); } finally { setSending(false); }
  };

  const doAction = async (action: "pay"|"release"|"cancel"|"dispute") => {
    if (action === "dispute" && !showDisputeInput) {
      setShowDisputeInput(true); return;
    }
    if (action === "pay" && !showPayInput) {
      setShowPayInput(true); return;
    }
    const labels: Record<string, string> = { pay: "I've Paid", release: "Release Crypto", cancel: "Cancel Order", dispute: "Open Dispute" };
    Alert.alert(
      `Confirm: ${labels[action]}`,
      action === "dispute" ? `Reason: ${disputeReason}` :
      action === "pay" ? "Only confirm AFTER you've actually transferred funds. False claims may result in account suspension." :
      action === "release" ? "This will immediately transfer crypto to the buyer. Make sure you've received the fiat payment first!" :
      undefined,
      [
        { text: "Back", style: "cancel" },
        { text: "Confirm", style: action === "cancel" || action === "dispute" ? "destructive" : "default", onPress: async () => {
          setLoading(true);
          try {
            const body =
              action === "dispute" ? JSON.stringify({ reason: disputeReason }) :
              action === "pay" ? JSON.stringify({ payment_proof: paymentProof.trim() || null }) :
              undefined;
            const r = await apiFetch(`/api/p2p/orders/${order.id}/${action}`, userId, { method: "POST", body });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error ?? "Failed");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowDisputeInput(false);
            setShowPayInput(false);
            setPaymentProof("");
            await refreshOrder();
            await refreshMsgs();
          } catch (e: any) { Alert.alert("Error", e.message); } finally { setLoading(false); }
        }},
      ]
    );
  };

  const copyText = async (text: string) => {
    try {
      const Clipboard = await import("expo-clipboard");
      await Clipboard.setStringAsync(text);
      Haptics.selectionAsync();
      Alert.alert("Copied", text);
    } catch {}
  };

  const meta = STATUS_META[order.status] ?? { label: order.status, color: "#848E9C" };
  const stepIndex = ["pending","paid","released"].indexOf(order.status);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={90}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 30 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
        {/* Status banner */}
        <View style={{ backgroundColor: meta.color + "18", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Feather name={order.status === "released" ? "check-circle" : order.status === "disputed" ? "alert-circle" : "clock"} size={22} color={meta.color} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: meta.color }}>{meta.label}</Text>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
              Order #{order.id} · {order.is_buyer ? "Buying" : "Selling"} {order.coin}
            </Text>
          </View>
          {order.status === "pending" && !expired && (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.5 }}>PAY WITHIN</Text>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: remainingMin < 3 ? "#F6465D" : meta.color, fontVariant: ["tabular-nums"] }}>
                {String(remainingMin).padStart(2,"0")}:{String(remainingSec).padStart(2,"0")}
              </Text>
            </View>
          )}
          {expired && (
            <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#F6465D" }}>EXPIRED</Text>
          )}
        </View>

        {/* Seller payment details — shown to buyer once order is placed */}
        {order.is_buyer && ["pending","paid","disputed"].includes(order.status) && (
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: order.status === "pending" ? "#0ECB8140" : colors.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                Seller's {order.payment_method} Details
              </Text>
              <View style={{ backgroundColor: "#F0B90B18", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#F0B90B" }}>VERIFIED ESCROW</Text>
              </View>
            </View>
            {!sellerPay ? (
              <ActivityIndicator color={colors.primary} />
            ) : !sellerPay.details || Object.keys(sellerPay.details).length === 0 ? (
              <View style={{ backgroundColor: "#F6465D12", borderRadius: 8, padding: 10 }}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#F6465D" }}>
                  Seller hasn't saved {order.payment_method} details yet. Please ask them in chat below.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {Object.entries(sellerPay.details).map(([k, v]) => (
                  <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.secondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" }}>
                        {k.replace(/_/g, " ")}
                      </Text>
                      <Text selectable style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground, marginTop: 2 }}>
                        {String(v)}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => copyText(String(v))} style={{ padding: 6 }}>
                      <Feather name="copy" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0ECB8112", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
                  <View>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#0ECB81", letterSpacing: 0.5 }}>EXACT AMOUNT TO SEND</Text>
                    <Text selectable style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: "#0ECB81", marginTop: 2 }}>
                      ${order.fiat_amount.toFixed(2)} USD
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => copyText(order.fiat_amount.toFixed(2))} style={{ padding: 6 }}>
                    <Feather name="copy" size={16} color="#0ECB81" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Progress steps */}
        {!["cancelled","resolved"].includes(order.status) && (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {["Transfer Funds","Confirm Payment","Crypto Released"].map((step, i) => (
              <React.Fragment key={step}>
                <View style={{ alignItems: "center", flex: 1 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
                    backgroundColor: i <= stepIndex ? colors.primary : colors.secondary, borderWidth: 1,
                    borderColor: i <= stepIndex ? colors.primary : colors.border }}>
                    {i < stepIndex ? <Feather name="check" size={14} color={colors.primaryForeground} /> :
                      <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: i === stepIndex ? colors.primaryForeground : colors.mutedForeground }}>{i+1}</Text>}
                  </View>
                  <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: i <= stepIndex ? colors.primary : colors.mutedForeground, marginTop: 4, textAlign: "center" }}>{step}</Text>
                </View>
                {i < 2 && <View style={{ height: 1, width: 20, backgroundColor: i < stepIndex ? colors.primary : colors.border, marginBottom: 16 }} />}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* Order info */}
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 12 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>Order Details</Text>
          {[
            { label: order.is_buyer ? "You Pay (Fiat)" : "You Receive (Fiat)", value: `$${order.fiat_amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD` },
            { label: order.is_buyer ? "You Receive (Crypto)" : "You Send (Crypto)", value: `${order.crypto_amount} ${order.coin}` },
            { label: "Price", value: `$${order.price.toLocaleString()} / ${order.coin}` },
            { label: "Payment Method", value: order.payment_method },
          ].map(row => (
            <View key={row.label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{row.label}</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>{row.value}</Text>
            </View>
          ))}
          {order.admin_note && (
            <View style={{ backgroundColor: "#0ECB8112", borderRadius: 8, padding: 10 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#0ECB81" }}>Admin Note: {order.admin_note}</Text>
            </View>
          )}
          {order.dispute_reason && (
            <View style={{ backgroundColor: "#F6465D12", borderRadius: 8, padding: 10 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#F6465D" }}>Dispute: {order.dispute_reason}</Text>
            </View>
          )}
          {order.payment_proof && (
            <View style={{ backgroundColor: "#2775CA12", borderRadius: 8, padding: 10 }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#2775CA", letterSpacing: 0.5 }}>BUYER'S PAYMENT REFERENCE</Text>
              <Text selectable style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground, marginTop: 4 }}>
                {order.payment_proof}
              </Text>
            </View>
          )}
        </View>

        {/* Payment instructions */}
        {order.status === "pending" && order.is_buyer && (
          <View style={{ backgroundColor: "#0ECB8112", borderRadius: 14, padding: 16, gap: 10 }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#0ECB81" }}>Action Required: Send Payment</Text>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 18 }}>
              Send <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground }}>${order.fiat_amount.toFixed(2)} USD</Text> via <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground }}>{order.payment_method}</Text> to the seller, then click "I've Paid".
            </Text>
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#F6465D", lineHeight: 16 }}>
              ⚠ Do NOT cancel after sending payment. Contact seller via chat for payment details.
            </Text>
          </View>
        )}

        {order.status === "paid" && !order.is_buyer && (
          <View style={{ backgroundColor: "#F0B90B12", borderRadius: 14, padding: 16, gap: 8 }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#F0B90B" }}>Action Required: Verify & Release</Text>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 18 }}>
              The buyer has marked their payment as sent. Verify you've received <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground }}>${order.fiat_amount.toFixed(2)} USD</Text> via {order.payment_method}, then release the crypto.
            </Text>
          </View>
        )}

        {/* Action buttons */}
        {loading ? <ActivityIndicator color={colors.primary} /> : (
          <View style={{ gap: 10 }}>
            {order.status === "pending" && order.is_buyer && !expired && (
              <>
                {showPayInput && (
                  <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 12, gap: 8, borderWidth: 1, borderColor: "#0ECB81" }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.5 }}>
                      PAYMENT REFERENCE / TRANSACTION ID (optional)
                    </Text>
                    <TextInput
                      style={{ backgroundColor: colors.secondary, borderRadius: 10, padding: 12, fontSize: 13,
                        fontFamily: "Inter_400Regular", color: colors.foreground, borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.border, minHeight: 44 }}
                      placeholder="e.g. UTR / Ref ID / screenshot link…" placeholderTextColor={colors.mutedForeground}
                      value={paymentProof} onChangeText={setPaymentProof}
                    />
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 16 }}>
                      Helps the seller confirm payment faster. They'll see this in the chat.
                    </Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => doAction("pay")}
                  style={{ backgroundColor: "#0ECB81", borderRadius: 12, padding: 16, alignItems: "center" }} activeOpacity={0.85}>
                  <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" }}>
                    {showPayInput ? "Confirm Payment Sent" : "I've Paid"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            {(order.status === "paid" || order.status === "disputed") && !order.is_buyer && (
              <TouchableOpacity onPress={() => doAction("release")}
                style={{ backgroundColor: "#0ECB81", borderRadius: 12, padding: 16, alignItems: "center" }} activeOpacity={0.85}>
                <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" }}>Release Crypto ✓</Text>
              </TouchableOpacity>
            )}
            {expired && order.status === "pending" && (
              <View style={{ backgroundColor: "#F6465D18", borderRadius: 12, padding: 14, gap: 6 }}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#F6465D" }}>
                  Payment Window Expired
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 17 }}>
                  This order will be auto-cancelled and the seller's crypto returned. Refresh in a moment, or place a new order.
                </Text>
                <TouchableOpacity onPress={refreshOrder}
                  style={{ marginTop: 4, alignSelf: "flex-start", backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: colors.foreground }}>Refresh</Text>
                </TouchableOpacity>
              </View>
            )}
            {order.status === "pending" && !expired && (
              <TouchableOpacity onPress={() => doAction("cancel")}
                style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, alignItems: "center",
                  borderWidth: 1, borderColor: "#F6465D" }} activeOpacity={0.85}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#F6465D" }}>Cancel Order</Text>
              </TouchableOpacity>
            )}
            {["pending","paid"].includes(order.status) && (
              <>
                {showDisputeInput && (
                  <TextInput
                    style={{ backgroundColor: colors.card, borderRadius: 10, padding: 12, fontSize: 13,
                      fontFamily: "Inter_400Regular", color: colors.foreground, borderWidth: 1,
                      borderColor: "#F6465D", minHeight: 60, textAlignVertical: "top" }}
                    placeholder="Describe the issue…" placeholderTextColor={colors.mutedForeground}
                    value={disputeReason} onChangeText={setDisputeReason} multiline
                  />
                )}
                <TouchableOpacity onPress={() => doAction("dispute")}
                  style={{ backgroundColor: "#F6465D18", borderRadius: 12, padding: 14, alignItems: "center",
                    borderWidth: 1, borderColor: "#F6465D" }} activeOpacity={0.85}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#F6465D" }}>
                    {showDisputeInput ? "Submit Dispute" : "Open Dispute"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Chat */}
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 12 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>Chat with {order.is_buyer ? "Seller" : "Buyer"}</Text>
          {messages.length === 0 ? (
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", paddingVertical: 16 }}>
              No messages yet. Use chat to coordinate payment details.
            </Text>
          ) : messages.map(msg => (
            <View key={msg.id} style={{ alignItems: msg.is_me ? "flex-end" : "flex-start" }}>
              <View style={{ backgroundColor: msg.is_me ? colors.primary : colors.secondary, borderRadius: 12,
                paddingHorizontal: 14, paddingVertical: 10, maxWidth: "80%" }}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: msg.is_me ? colors.primaryForeground : colors.foreground, lineHeight: 18 }}>
                  {msg.message}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: msg.is_me ? colors.primaryForeground + "aa" : colors.mutedForeground, marginTop: 4 }}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Chat input */}
      {!["released","cancelled","resolved"].includes(order.status) && (
        <View style={{ backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
          padding: 12, flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
          <TextInput
            style={{ flex: 1, backgroundColor: colors.secondary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
              fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground, maxHeight: 80 }}
            placeholder="Type a message…" placeholderTextColor={colors.mutedForeground}
            value={msgText} onChangeText={setMsgText} multiline
          />
          <TouchableOpacity onPress={sendMsg} disabled={sending || !msgText.trim()}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: msgText.trim() ? colors.primary : colors.border,
              alignItems: "center", justifyContent: "center" }}>
            {sending ? <ActivityIndicator size="small" color={colors.primaryForeground} /> :
              <Feather name="send" size={18} color={colors.primaryForeground} />}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  headerBack: { width: 36, alignItems: "flex-start" },
  adCard: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16,
  },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
});
