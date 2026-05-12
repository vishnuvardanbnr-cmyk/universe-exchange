import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { MarketCoin, formatPrice } from "@/data/marketData";

interface CoinRowProps {
  coin: MarketCoin;
  onPress?: () => void;
  rank?: number;
}

export default function CoinRow({ coin, onPress, rank }: CoinRowProps) {
  const { colors } = useTheme();
  const isPositive = coin.change24h >= 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.container, { borderBottomColor: colors.border }]}
      activeOpacity={0.7}
    >
      <View style={styles.left}>
        <View style={[styles.logoCircle, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.logoText, { color: colors.primary }]}>{coin.logo}</Text>
        </View>
        <View style={styles.nameGroup}>
          <Text style={[styles.symbol, { color: colors.foreground }]}>{coin.symbol}</Text>
          <Text style={[styles.name, { color: colors.mutedForeground }]}>{coin.name}</Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.price, { color: colors.foreground }]}>${formatPrice(coin.price)}</Text>
        <View style={[styles.changeBadge, { backgroundColor: isPositive ? colors.success + "22" : colors.destructive + "22" }]}>
          <Text style={[styles.change, { color: isPositive ? colors.success : colors.destructive }]}>
            {isPositive ? "+" : ""}{coin.change24h.toFixed(2)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoCircle: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  nameGroup: { gap: 2 },
  symbol: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  name: { fontSize: 12, fontFamily: "Inter_400Regular" },
  right: { alignItems: "flex-end", gap: 4 },
  price: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  changeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  change: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
