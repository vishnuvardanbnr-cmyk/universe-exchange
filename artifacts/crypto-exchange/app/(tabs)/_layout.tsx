import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useI18n } from "@/context/I18nContext";

function NativeTabLayout() {
  const { t } = useI18n();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>{t("tab.markets")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="trade">
        <Icon sf={{ default: "arrow.up.arrow.down", selected: "arrow.up.arrow.down.circle.fill" }} />
        <Label>{t("tab.trade")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="swap">
        <Icon sf={{ default: "arrow.2.circlepath", selected: "arrow.2.circlepath.circle.fill" }} />
        <Label>Swap</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="earn">
        <Icon sf={{ default: "percent", selected: "percent" }} />
        <Label>{t("tab.earn")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="wallet">
        <Icon sf={{ default: "wallet.pass", selected: "wallet.pass.fill" }} />
        <Label>{t("tab.wallet")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications" style={{ display: "none" }}>
        <Icon sf={{ default: "bell", selected: "bell.fill" }} />
        <Label>{t("tab.notifications")}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]}
            />
          ) : null,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "Inter_500Medium",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab.markets"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.bar" tintColor={color} size={22} />
            ) : (
              <Feather name="bar-chart-2" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="trade"
        options={{
          title: t("tab.trade"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="arrow.up.arrow.down" tintColor={color} size={22} />
            ) : (
              <Feather name="trending-up" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="swap"
        options={{
          title: "Swap",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="arrow.2.circlepath" tintColor={color} size={22} />
            ) : (
              <Feather name="refresh-cw" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="earn"
        options={{
          title: t("tab.earn"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="percent" tintColor={color} size={22} />
            ) : (
              <Feather name="percent" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: t("tab.wallet"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="wallet.pass" tintColor={color} size={22} />
            ) : (
              <Feather name="briefcase" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarItemStyle: { display: "none" },
          tabBarIcon: ({ color }) => <Feather name="bell" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
