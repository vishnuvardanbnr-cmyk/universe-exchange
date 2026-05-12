import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useWallet, ConnectedDapp } from "@/context/WalletContext";

const POPULAR_DAPPS: Omit<ConnectedDapp, "connectedAt">[] = [
  { id: "uniswap",    name: "Uniswap",       url: "https://app.uniswap.org",   icon: "🦄", category: "DEX",         network: "eth" },
  { id: "aave",       name: "Aave",          url: "https://app.aave.com",      icon: "👻", category: "Lending",     network: "eth" },
  { id: "opensea",    name: "OpenSea",       url: "https://opensea.io",        icon: "⛵", category: "NFT",         network: "eth" },
  { id: "compound",   name: "Compound",      url: "https://app.compound.finance", icon: "🏛", category: "Lending",  network: "eth" },
  { id: "lido",       name: "Lido",          url: "https://lido.fi",           icon: "🌊", category: "Staking",     network: "eth" },
  { id: "curve",      name: "Curve Finance", url: "https://curve.fi",          icon: "📈", category: "DEX",         network: "eth" },
  { id: "pancake",    name: "PancakeSwap",   url: "https://pancakeswap.finance", icon: "🥞", category: "DEX",       network: "bsc" },
  { id: "1inch",      name: "1inch",         url: "https://app.1inch.io",      icon: "🦄", category: "Aggregator",  network: "eth" },
  { id: "gmx",        name: "GMX",           url: "https://app.gmx.io",        icon: "📊", category: "Perps",       network: "arbitrum" },
  { id: "raydium",    name: "Raydium",       url: "https://raydium.io",        icon: "☀", category: "DEX",          network: "sol" },
  { id: "magiceden",  name: "Magic Eden",    url: "https://magiceden.io",      icon: "🪄", category: "NFT",         network: "sol" },
  { id: "jupiter",    name: "Jupiter",       url: "https://jup.ag",            icon: "🪐", category: "Aggregator",  network: "sol" },
];

const NETWORK_COLORS: Record<string, string> = {
  eth: "#627EEA", bsc: "#F0B90B", sol: "#9945FF", polygon: "#8247E5", arbitrum: "#28A0F0",
};

const NETWORK_LABELS: Record<string, string> = {
  eth: "Ethereum", bsc: "BNB Chain", sol: "Solana", polygon: "Polygon", arbitrum: "Arbitrum",
};

export default function DefiDappsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { connectedDapps, connectDapp, disconnectDapp, dexAddress } = useWallet();
  const [scanInput, setScanInput] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  const isConnected = (id: string) => !!connectedDapps.find((d) => d.id === id);

  const handleConnect = (dapp: Omit<ConnectedDapp, "connectedAt">) => {
    Alert.alert(
      `Connect to ${dapp.name}?`,
      `This will give ${dapp.name} permission to:\n\n• View your wallet address (${dexAddress.slice(0, 10)}…)\n• Request transaction signatures\n\nIt will NEVER move funds without your approval.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Connect",
          onPress: () => {
            connectDapp(dapp);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleDisconnect = (dapp: ConnectedDapp) => {
    Alert.alert(`Disconnect ${dapp.name}?`, "It will no longer be able to read your wallet or request signatures.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: () => { disconnectDapp(dapp.id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
    ]);
  };

  const handleScan = () => {
    if (!scanInput.trim().toLowerCase().startsWith("wc:")) {
      Alert.alert("Invalid URI", "Paste a WalletConnect URI (starts with `wc:`).");
      return;
    }
    Alert.alert("Connection Request", "Demo: WalletConnect session established. In production, this opens the dApp's connection prompt.", [{ text: "OK", onPress: () => { setShowScanner(false); setScanInput(""); } }]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>Connected dApps</Text>
        <TouchableOpacity onPress={() => setShowScanner(true)} style={s.iconBtn}>
          <Feather name="maximize" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Connected section */}
        <View>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>
            CONNECTED · {connectedDapps.length}
          </Text>
          {connectedDapps.length === 0 ? (
            <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="link-2" size={28} color={colors.border} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>No dApps connected</Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center" }}>
                Connect to a dApp from the list below or scan a WalletConnect QR.
              </Text>
            </View>
          ) : (
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {connectedDapps.map((d, i, arr) => (
                <View key={d.id} style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 22 }}>{d.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>{d.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: NETWORK_COLORS[d.network] ?? "#888" }} />
                      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{NETWORK_LABELS[d.network] ?? d.network} · {d.category}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => handleDisconnect(d)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: "#F6465D18", borderWidth: 1, borderColor: "#F6465D30" }}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#F6465D" }}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Popular dApps */}
        <View>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>POPULAR DAPPS</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {POPULAR_DAPPS.map((d) => {
              const connected = isConnected(d.id);
              return (
                <View key={d.id} style={[s.dappTile, { backgroundColor: colors.card, borderColor: connected ? "#0ECB81" : colors.border }]}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                    <Text style={{ fontSize: 26 }}>{d.icon}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>{d.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3, marginBottom: 10 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: NETWORK_COLORS[d.network] ?? "#888" }} />
                    <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{d.category}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => connected ? handleDisconnect({ ...d, connectedAt: 0 }) : handleConnect(d)}
                    style={{ paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: connected ? "#0ECB8118" : colors.primary, borderWidth: connected ? 1 : 0, borderColor: "#0ECB81" }}
                  >
                    <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: connected ? "#0ECB81" : colors.primaryForeground }}>
                      {connected ? "Connected" : "Connect"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[s.note, { backgroundColor: "#F0B90B12", borderColor: "#F0B90B30" }]}>
          <Feather name="shield" size={14} color="#F0B90B" />
          <Text style={{ flex: 1, fontSize: 11, fontFamily: "Inter_500Medium", color: "#F0B90B", lineHeight: 16 }}>
            dApps can request signatures, but cannot move funds without your explicit approval. Always verify what you're signing.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={showScanner} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowScanner(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: insets.bottom }}>
          <View style={[s.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowScanner(false)} style={s.iconBtn}>
              <Feather name="x" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>WalletConnect</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ padding: 24, gap: 18 }}>
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 18 }}>
              <View style={{ width: 88, height: 88, borderRadius: 24, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center" }}>
                <Feather name="link" size={42} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground }}>Connect via URI</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center" }}>
                Open the dApp on your computer, click "Connect Wallet → WalletConnect", then paste the URI here.
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 0.8 }}>WALLETCONNECT URI</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
                <Feather name="link-2" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={{ flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground }}
                  placeholder="wc:..."
                  placeholderTextColor={colors.mutedForeground}
                  value={scanInput}
                  onChangeText={setScanInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
            <TouchableOpacity onPress={handleScan} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderRadius: 14, backgroundColor: colors.primary }}>
              <Feather name="link" size={16} color={colors.primaryForeground} />
              <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.primaryForeground }}>Connect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 16, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth },
  empty: { borderRadius: 16, padding: 28, alignItems: "center", gap: 10, borderWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, marginBottom: 10 },
  dappTile: { width: "31%", padding: 12, borderRadius: 16, borderWidth: 1, alignItems: "stretch", flexGrow: 1 },
  note: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
});
