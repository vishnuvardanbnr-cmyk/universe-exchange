import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Modal,
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
import { useLivePrice } from "@/context/LivePriceContext";

interface StakeModalProps {
  visible: boolean;
  onClose: () => void;
  symbol: string;
  name: string;
  apy: number;
  type: "staking" | "liquid" | "earn";
  lockDays: number;
}

export default function StakeModal({ visible, onClose, symbol, name, apy, type, lockDays }: StakeModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { cexBalances, stakeCoins } = useWallet();
  const { getPrice } = useLivePrice();
  const [amount, setAmount] = useState("");

  const coinBalance = cexBalances.find((c) => c.symbol === symbol);
  const liveP = getPrice(symbol);
  const price = liveP > 0 ? liveP : (COIN_PRICES[symbol] ?? 1);
  const numAmount = parseFloat(amount) || 0;
  const usdValue = numAmount * price;
  const estAnnual = (numAmount * apy) / 100;

  const handleStake = () => {
    if (numAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }
    if (!coinBalance || coinBalance.balance < numAmount) {
      Alert.alert("Insufficient Balance", `You don't have enough ${symbol}.`);
      return;
    }
    const success = stakeCoins(symbol, numAmount, apy, type, lockDays > 0 ? lockDays : undefined);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success!", `Successfully staked ${numAmount} ${symbol}`);
      setAmount("");
      onClose();
    }
  };

  const typeLabel = type === "liquid" ? "Liquid Stake" : type === "earn" ? "Subscribe" : "Stake";
  const typeColor = type === "earn" ? colors.primary : colors.success;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>{typeLabel} {symbol}</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView style={styles.content} contentContainerStyle={{ gap: 16 }}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Product</Text>
            <Text style={[styles.cardValue, { color: colors.foreground }]}>{name}</Text>
          </View>
          <View style={[styles.statsRow]}>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>APY</Text>
              <Text style={[styles.statValue, { color: typeColor }]}>{apy.toFixed(1)}%</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Lock Period</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{lockDays === 0 ? "Flexible" : `${lockDays} Days`}</Text>
            </View>
          </View>
          <View style={[styles.inputSection, { backgroundColor: colors.card }]}>
            <View style={styles.inputHeader}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Amount ({symbol})</Text>
              <TouchableOpacity onPress={() => coinBalance && setAmount(coinBalance.balance.toFixed(6))}>
                <Text style={[styles.maxBtn, { color: colors.primary }]}>Max</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              placeholder={`0.00 ${symbol}`}
              placeholderTextColor={colors.mutedForeground}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <View style={styles.balanceRow}>
              <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                Available: {coinBalance ? coinBalance.balance.toFixed(6) : "0"} {symbol}
              </Text>
              <Text style={[styles.usdValue, { color: colors.mutedForeground }]}>
                ≈ ${usdValue.toFixed(2)}
              </Text>
            </View>
          </View>
          {numAmount > 0 && (
            <View style={[styles.estimateCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
              <Text style={[styles.estimateTitle, { color: colors.foreground }]}>Estimated Returns</Text>
              <View style={styles.estimateRow}>
                <Text style={[styles.estimateLabel, { color: colors.mutedForeground }]}>Daily</Text>
                <Text style={[styles.estimateValue, { color: colors.success }]}>+{(estAnnual / 365).toFixed(6)} {symbol}</Text>
              </View>
              <View style={styles.estimateRow}>
                <Text style={[styles.estimateLabel, { color: colors.mutedForeground }]}>Monthly</Text>
                <Text style={[styles.estimateValue, { color: colors.success }]}>+{(estAnnual / 12).toFixed(6)} {symbol}</Text>
              </View>
              <View style={styles.estimateRow}>
                <Text style={[styles.estimateLabel, { color: colors.mutedForeground }]}>Annual</Text>
                <Text style={[styles.estimateValue, { color: colors.success }]}>+{estAnnual.toFixed(6)} {symbol}</Text>
              </View>
            </View>
          )}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: typeColor }]}
            onPress={handleStake}
            activeOpacity={0.85}
          >
            <Text style={[styles.submitText, { color: type === "earn" ? "#1A1A1A" : "#fff" }]}>{typeLabel} Now</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  content: { flex: 1, padding: 16 },
  card: { padding: 16, borderRadius: 12, gap: 4 },
  cardLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardValue: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, gap: 4 },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  inputSection: { padding: 16, borderRadius: 12, gap: 10 },
  inputHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  inputLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  maxBtn: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  input: { fontSize: 20, fontFamily: "Inter_600SemiBold", borderWidth: 1, borderRadius: 8, padding: 12 },
  balanceRow: { flexDirection: "row", justifyContent: "space-between" },
  balanceLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  usdValue: { fontSize: 12, fontFamily: "Inter_400Regular" },
  estimateCard: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 8 },
  estimateTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  estimateRow: { flexDirection: "row", justifyContent: "space-between" },
  estimateLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  estimateValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  submitBtn: { padding: 16, borderRadius: 12, alignItems: "center" },
  submitText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
