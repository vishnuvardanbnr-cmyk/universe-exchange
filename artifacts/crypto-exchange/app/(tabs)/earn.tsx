import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { useWallet } from "@/context/WalletContext";
import { COIN_PRICES } from "@/context/WalletContext";
import { useEarn, EarnProduct } from "@/context/EarnContext";
import { useLivePrice } from "@/context/LivePriceContext";
import { MARKET_DATA } from "@/data/marketData";
import StakeModal from "@/components/StakeModal";
import CoinLogo from "@/components/CoinLogo";

type EarnTab = "Staking" | "Liquid Staking" | "Earn";

const SYMBOLS = ["BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "AVAX", "TRX", "DOT", "MATIC", "LINK", "LTC", "ATOM", "UNI", "NEAR", "ARB", "OP", "APT", "SUI", "INJ", "USDT", "USDC"];
const TYPE_OPTIONS: Array<EarnProduct["type"]> = ["staking", "liquid", "earn"];

export default function EarnScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { stakePositions, unstakePosition } = useWallet();
  const { getPrice } = useLivePrice();
  const { stakingProducts, liquidProducts, earnProducts, allProducts, loading, error, refresh, adminCreateProduct, adminUpdateProduct, adminDeleteProduct } = useEarn();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const scrollRef = useRef<ScrollView>(null);
  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));
  const [activeTab, setActiveTab] = useState<EarnTab>("Staking");
  const [stakeModal, setStakeModal] = useState<null | EarnProduct>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminLongPressCount, setAdminLongPressCount] = useState(0);

  const products = activeTab === "Staking" ? stakingProducts : activeTab === "Liquid Staking" ? liquidProducts : earnProducts;

  const totalStakedUsd = stakePositions.reduce((sum, pos) => {
    const lp = getPrice(pos.symbol);
    const price = lp > 0 ? lp : (COIN_PRICES[pos.symbol] ?? 1);
    return sum + pos.amount * price;
  }, 0);

  const handleTitlePress = () => {
    const next = adminLongPressCount + 1;
    setAdminLongPressCount(next);
    if (next >= 5) {
      setAdminLongPressCount(0);
      setShowAdmin(true);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <TouchableOpacity onPress={handleTitlePress} activeOpacity={1}>
          <Text style={[styles.title, { color: colors.foreground }]}>Earn</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {loading && <ActivityIndicator size="small" color={colors.primary} />}
          <TouchableOpacity onPress={() => refresh()} style={[styles.refreshBtn, { backgroundColor: colors.secondary }]}>
            <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAdmin(true)} style={[styles.refreshBtn, { backgroundColor: colors.secondary }]}>
            <Feather name="settings" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={[styles.errorBar, { backgroundColor: colors.destructive + "20" }]}>
          <Feather name="alert-circle" size={13} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error} · Tap ↺ to retry</Text>
        </View>
      )}

      {totalStakedUsd > 0 && (
        <View style={[styles.summaryCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30", marginHorizontal: 16, marginBottom: 12 }]}>
          <View>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total Staked Value</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>${totalStakedUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
          <View>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Positions</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>{stakePositions.length}</Text>
          </View>
        </View>
      )}

      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(["Staking", "Liquid Staking", "Earn"] as EarnTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabBtn, { borderBottomColor: activeTab === tab ? colors.primary : "transparent" }]}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {activeTab === "Staking" && (
          <View style={[styles.infoBox, { backgroundColor: colors.secondary }]}>
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>Stake your assets and earn passive rewards. Flexible staking lets you unstake anytime.</Text>
          </View>
        )}
        {activeTab === "Liquid Staking" && (
          <View style={[styles.infoBox, { backgroundColor: colors.secondary }]}>
            <Feather name="droplet" size={14} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>Stake and receive liquid tokens (stETH, mSOL, etc.) that you can use in DeFi while earning rewards.</Text>
          </View>
        )}
        {activeTab === "Earn" && (
          <View style={[styles.infoBox, { backgroundColor: colors.secondary }]}>
            <Feather name="trending-up" size={14} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>Subscribe to flexible or fixed-term savings products to earn higher yields.</Text>
          </View>
        )}

        {loading && products.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[{ fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 12, color: colors.mutedForeground }]}>Loading products...</Text>
          </View>
        )}

        {!loading && products.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
            <Feather name="inbox" size={32} color={colors.mutedForeground} />
            <Text style={[{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }]}>No products available</Text>
            <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }]}>Admin has not created any products yet</Text>
          </View>
        )}

        {products.map((product) => {
          const coin = MARKET_DATA.find((c) => c.symbol === product.symbol);
          const typeColor = activeTab === "Earn" ? colors.primary : colors.success;
          return (
            <TouchableOpacity
              key={product.id}
              style={[styles.productCard, { backgroundColor: colors.card }]}
              onPress={() => setStakeModal(product)}
              activeOpacity={0.8}
            >
              <View style={styles.productTop}>
                <CoinLogo logo={coin?.logo ?? product.symbol[0]} symbol={product.symbol} color={coin?.color ?? "#888"} size={44} />
                <View style={{ flex: 1 }}>
                  <View style={styles.productNameRow}>
                    <Text style={[styles.productName, { color: colors.foreground }]}>{product.name}</Text>
                    {product.tag ? (
                      <View style={[styles.productTag, { backgroundColor: typeColor + "22" }]}>
                        <Text style={[styles.productTagText, { color: typeColor }]}>{product.tag}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.productSub, { color: colors.mutedForeground }]}>
                    {product.lockDays === 0 ? "Flexible · No lock-up" : `Fixed · ${product.lockDays}-day lock`}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.apyLabel, { color: colors.mutedForeground }]}>APY</Text>
                  <Text style={[styles.apyValue, { color: typeColor }]}>{product.apy.toFixed(1)}%</Text>
                </View>
              </View>
              <View style={[styles.productFooter, { borderTopColor: colors.border }]}>
                <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
                  Min: {product.minAmount} {product.symbol}
                </Text>
                <View style={[styles.subscribeBtn, { backgroundColor: typeColor }]}>
                  <Text style={[styles.subscribeBtnText, { color: activeTab === "Earn" ? "#1A1A1A" : "#fff" }]}>
                    {activeTab === "Liquid Staking" ? "Liquid Stake" : activeTab === "Earn" ? "Subscribe" : "Stake"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {stakePositions.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 8 }]}>MY POSITIONS</Text>
            {stakePositions.map((pos) => {
              const lp = getPrice(pos.symbol);
              const price = lp > 0 ? lp : (COIN_PRICES[pos.symbol] ?? 1);
              const usdValue = pos.amount * price;
              const daysStaked = (Date.now() - pos.startDate) / (1000 * 60 * 60 * 24);
              const earned = (pos.amount * pos.apy / 100) * (daysStaked / 365);
              const isLocked = pos.lockEnd && pos.lockEnd > Date.now();
              const typeColor = pos.type === "earn" ? colors.primary : colors.success;
              return (
                <View key={pos.id} style={[styles.positionCard, { backgroundColor: colors.card }]}>
                  <View style={styles.positionHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.positionTopRow}>
                        <Text style={[styles.positionSymbol, { color: colors.foreground }]}>{pos.symbol}</Text>
                        <View style={[styles.positionTypeBadge, { backgroundColor: typeColor + "22" }]}>
                          <Text style={[styles.positionTypeText, { color: typeColor }]}>{pos.type === "liquid" ? "Liquid" : pos.type === "earn" ? "Earn" : "Staked"}</Text>
                        </View>
                      </View>
                      <Text style={[styles.positionAmount, { color: colors.foreground }]}>
                        {pos.amount.toFixed(6)} {pos.symbol} · ${usdValue.toFixed(2)}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={[styles.positionApy, { color: typeColor }]}>{pos.apy}% APY</Text>
                      <Text style={[styles.positionEarned, { color: colors.success }]}>+{earned.toFixed(6)} {pos.symbol}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.unstakeBtn, { backgroundColor: isLocked ? colors.secondary : colors.destructive + "22", borderColor: isLocked ? colors.border : colors.destructive + "44" }]}
                    onPress={() => { if (!isLocked) unstakePosition(pos.id); }}
                    disabled={!!isLocked}
                  >
                    <Text style={[styles.unstakeBtnText, { color: isLocked ? colors.mutedForeground : colors.destructive }]}>
                      {isLocked ? `Locked until ${new Date(pos.lockEnd!).toLocaleDateString()}` : "Unstake"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {stakeModal && (
        <StakeModal
          visible={!!stakeModal}
          onClose={() => setStakeModal(null)}
          symbol={stakeModal.symbol}
          name={stakeModal.name}
          apy={stakeModal.apy}
          type={stakeModal.type}
          lockDays={stakeModal.lockDays}
        />
      )}

      <AdminPanelModal
        visible={showAdmin}
        onClose={() => setShowAdmin(false)}
        allProducts={allProducts}
        onCreate={adminCreateProduct}
        onUpdate={adminUpdateProduct}
        onDelete={adminDeleteProduct}
      />
    </View>
  );
}

function AdminPanelModal({
  visible,
  onClose,
  allProducts,
  onCreate,
  onUpdate,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  allProducts: EarnProduct[];
  onCreate: (data: Omit<EarnProduct, "id" | "active" | "createdAt">) => Promise<void>;
  onUpdate: (id: string, data: Partial<EarnProduct>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<"list" | "create">("list");
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<EarnProduct["type"] | "all">("all");

  const [form, setForm] = useState({
    symbol: "ETH",
    name: "",
    apy: "",
    minAmount: "0.01",
    lockDays: "0",
    type: "staking" as EarnProduct["type"],
    tag: "",
  });

  const resetForm = () => setForm({ symbol: "ETH", name: "", apy: "", minAmount: "0.01", lockDays: "0", type: "staking", tag: "" });

  const handleCreate = async () => {
    if (!form.symbol || !form.name || !form.apy) {
      Alert.alert("Missing Fields", "Symbol, Name and APY are required.");
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        symbol: form.symbol.toUpperCase(),
        name: form.name,
        apy: parseFloat(form.apy),
        minAmount: parseFloat(form.minAmount) || 0,
        lockDays: parseInt(form.lockDays) || 0,
        type: form.type,
        tag: form.tag,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Created!", `${form.name} is now live.`);
      resetForm();
      setView("list");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (product: EarnProduct) => {
    try {
      await onUpdate(product.id, { active: !product.active });
      Haptics.selectionAsync();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to update");
    }
  };

  const handleDelete = (product: EarnProduct) => {
    Alert.alert("Deactivate Product", `Hide "${product.name}" from users?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Deactivate", style: "destructive", onPress: async () => {
        try {
          await onDelete(product.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch (err: any) {
          Alert.alert("Error", err?.message ?? "Failed to delete");
        }
      }},
    ]);
  };

  const visibleProducts = allProducts.filter((p) => filterType === "all" || p.type === filterType);

  const typeColor = (type: string) => type === "earn" ? colors.primary : colors.success;

  const inputStyle = [styles.adminInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }];
  const labelStyle = [styles.adminLabel, { color: colors.mutedForeground }];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.adminContainer, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.adminHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.adminTitle, { color: colors.foreground }]}>Admin Panel · Earn Products</Text>
          <TouchableOpacity onPress={() => { setView(view === "list" ? "create" : "list"); resetForm(); }}>
            <Feather name={view === "list" ? "plus" : "list"} size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {view === "create" ? (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
            <Text style={[styles.adminSectionTitle, { color: colors.foreground }]}>Create New Product</Text>

            <Text style={labelStyle}>Type *</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {TYPE_OPTIONS.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setForm((p) => ({ ...p, type: t }))}
                  style={[styles.typeChip, { backgroundColor: form.type === t ? colors.primary : colors.secondary, borderColor: form.type === t ? colors.primary : colors.border }]}
                >
                  <Text style={[styles.typeChipText, { color: form.type === t ? colors.primaryForeground : colors.foreground }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={labelStyle}>Symbol *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {SYMBOLS.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setForm((p) => ({ ...p, symbol: s }))}
                  style={[styles.symbolChip, { backgroundColor: form.symbol === s ? colors.primary : colors.secondary, borderColor: form.symbol === s ? colors.primary : colors.border }]}
                >
                  <Text style={[styles.symbolChipText, { color: form.symbol === s ? colors.primaryForeground : colors.foreground }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={labelStyle}>Product Name *</Text>
            <TextInput style={inputStyle} value={form.name} onChangeText={(v) => setForm((p) => ({ ...p, name: v }))} placeholder={`e.g. ${form.symbol} ${form.type === "earn" ? "Flexible Savings" : "Staking"}`} placeholderTextColor={colors.mutedForeground} />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={labelStyle}>APY (%) *</Text>
                <TextInput style={inputStyle} value={form.apy} onChangeText={(v) => setForm((p) => ({ ...p, apy: v }))} keyboardType="decimal-pad" placeholder="e.g. 6.5" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={labelStyle}>Min Amount</Text>
                <TextInput style={inputStyle} value={form.minAmount} onChangeText={(v) => setForm((p) => ({ ...p, minAmount: v }))} keyboardType="decimal-pad" placeholder="0.01" placeholderTextColor={colors.mutedForeground} />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={labelStyle}>Lock Days (0 = flexible)</Text>
                <TextInput style={inputStyle} value={form.lockDays} onChangeText={(v) => setForm((p) => ({ ...p, lockDays: v }))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={labelStyle}>Tag (optional)</Text>
                <TextInput style={inputStyle} value={form.tag} onChangeText={(v) => setForm((p) => ({ ...p, tag: v }))} placeholder="Hot / New / Popular" placeholderTextColor={colors.mutedForeground} />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.adminCreateBtn, { backgroundColor: saving ? colors.mutedForeground : colors.primary }]}
              onPress={handleCreate}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={[styles.adminCreateBtnText, { color: colors.primaryForeground }]}>Create Product</Text>}
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
              {(["all", ...TYPE_OPTIONS] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setFilterType(t)}
                  style={[styles.filterChip, { backgroundColor: filterType === t ? colors.primary : colors.secondary, borderColor: filterType === t ? colors.primary : colors.border }]}
                >
                  <Text style={[styles.filterChipText, { color: filterType === t ? colors.primaryForeground : colors.mutedForeground }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
              <Text style={[styles.adminSectionTitle, { color: colors.mutedForeground }]}>{visibleProducts.length} products</Text>
              {visibleProducts.map((product) => {
                const coin = MARKET_DATA.find((c) => c.symbol === product.symbol);
                return (
                  <View key={product.id} style={[styles.adminProductRow, { backgroundColor: colors.card, borderColor: product.active ? colors.border : colors.destructive + "40" }]}>
                    <CoinLogo logo={coin?.logo ?? product.symbol[0]} symbol={product.symbol} color={coin?.color ?? "#888"} size={36} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.adminProductName, { color: product.active ? colors.foreground : colors.mutedForeground }]}>{product.name}</Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <View style={[styles.productTag, { backgroundColor: typeColor(product.type) + "22" }]}>
                          <Text style={[styles.productTagText, { color: typeColor(product.type) }]}>{product.type}</Text>
                        </View>
                        <Text style={[{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: typeColor(product.type) }]}>{product.apy}% APY</Text>
                        {product.lockDays > 0 && <Text style={[{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }]}>{product.lockDays}d lock</Text>}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleToggle(product)} style={{ padding: 4 }}>
                      <Feather name={product.active ? "eye" : "eye-off"} size={18} color={product.active ? colors.success : colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(product)} style={{ padding: 4 }}>
                      <Feather name="trash-2" size={18} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  refreshBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  errorBar: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 8 },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  summaryCard: { flexDirection: "row", justifyContent: "space-around", padding: 16, borderRadius: 12, borderWidth: 1 },
  summaryLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 2 },
  summaryValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  tabRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2 },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  infoBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  productCard: { borderRadius: 12, overflow: "hidden" },
  productTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  productNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  productName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  productTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  productTagText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  productSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  apyLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  apyValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  productFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  footerText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  subscribeBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  subscribeBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  positionCard: { borderRadius: 12, padding: 14, gap: 10 },
  positionHeader: { flexDirection: "row", justifyContent: "space-between" },
  positionTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  positionSymbol: { fontSize: 14, fontFamily: "Inter_700Bold" },
  positionTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  positionTypeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  positionAmount: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  positionApy: { fontSize: 13, fontFamily: "Inter_700Bold" },
  positionEarned: { fontSize: 11, fontFamily: "Inter_400Regular" },
  unstakeBtn: { paddingVertical: 8, borderRadius: 8, alignItems: "center", borderWidth: 1 },
  unstakeBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  adminContainer: { flex: 1 },
  adminHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  adminTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  adminSectionTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  adminLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 },
  adminInput: { fontSize: 14, fontFamily: "Inter_400Regular", padding: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  adminCreateBtn: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
  adminCreateBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  adminProductRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  adminProductName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  typeChip: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", borderWidth: 1 },
  typeChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  symbolChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  symbolChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
