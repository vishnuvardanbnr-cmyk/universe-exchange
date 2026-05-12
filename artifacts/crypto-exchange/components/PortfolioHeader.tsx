import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";

interface PortfolioHeaderProps {
  totalUsd: number;
  change24h?: number;
  title?: string;
}

export default function PortfolioHeader({ totalUsd, change24h = 2.4, title = "Total Balance" }: PortfolioHeaderProps) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(false);
  const isPositive = change24h >= 0;
  const changeUsd = (totalUsd * change24h) / 100;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={styles.row}>
        <Text style={[styles.total, { color: colors.foreground }]}>
          {hidden ? "••••••" : `$${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </Text>
        <TouchableOpacity onPress={() => setHidden(!hidden)} style={styles.eyeBtn}>
          <Feather name={hidden ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      {!hidden && (
        <View style={styles.changeRow}>
          <View style={[styles.changeBadge, { backgroundColor: isPositive ? colors.success + "22" : colors.destructive + "22" }]}>
            <Feather name={isPositive ? "trending-up" : "trending-down"} size={12} color={isPositive ? colors.success : colors.destructive} />
            <Text style={[styles.changeText, { color: isPositive ? colors.success : colors.destructive }]}>
              {isPositive ? "+" : ""}{change24h.toFixed(2)}%
            </Text>
          </View>
          <Text style={[styles.changeUsd, { color: colors.mutedForeground }]}>
            {isPositive ? "+" : ""}{changeUsd >= 0 ? "" : "-"}${Math.abs(changeUsd).toFixed(2)} today
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 16, gap: 4 },
  label: { fontSize: 13, fontFamily: "Inter_400Regular" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  total: { fontSize: 32, fontFamily: "Inter_700Bold" },
  eyeBtn: { padding: 4 },
  changeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  changeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  changeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  changeUsd: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
