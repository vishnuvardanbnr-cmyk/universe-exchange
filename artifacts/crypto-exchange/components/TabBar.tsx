import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter, usePathname } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";

const TABS = [
  { name: "Markets", icon: "bar-chart-2", route: "/(tabs)/" },
  { name: "Trade", icon: "trending-up", route: "/(tabs)/trade" },
  { name: "Swap", icon: "refresh-cw", route: "/(tabs)/swap" },
  { name: "Earn", icon: "percent", route: "/(tabs)/earn" },
  { name: "Wallet", icon: "briefcase", route: "/(tabs)/wallet" },
];

export default function TabBar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const bottomPad = isWeb ? 34 : insets.bottom;
  const barHeight = 50 + bottomPad;

  const isActive = (route: string) => {
    if (route === "/(tabs)/") return pathname === "/" || pathname === "/index";
    return pathname.includes(route.replace("/(tabs)", ""));
  };

  return (
    <View style={[styles.wrapper, { height: barHeight, borderTopColor: colors.border }]}>
      {isIOS ? (
        <BlurView intensity={100} tint={colorScheme === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
      )}
      <View style={[styles.row, { paddingBottom: bottomPad }]}>
        {TABS.map((tab) => {
          const active = isActive(tab.route);
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tab}
              onPress={() => router.push(tab.route as any)}
              activeOpacity={0.7}
            >
              <Feather
                name={tab.icon as any}
                size={22}
                color={active ? colors.primary : colors.mutedForeground}
              />
              <Text style={[styles.label, { color: active ? colors.primary : colors.mutedForeground }]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
});
