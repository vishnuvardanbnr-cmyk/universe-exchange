import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState, useMemo } from "react";
import { router } from "expo-router";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Share,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "@/context/ThemeContext";
import { useWallet, CoinBalance, StakePosition } from "@/context/WalletContext";
import { useLivePrice } from "@/context/LivePriceContext";
import CoinLogo from "@/components/CoinLogo";

// ─── Constants ────────────────────────────────────────────────────────────────

const CHAINS = [
  { id: "all",      label: "All Networks", color: "#F0B90B", icon: "layers"    },
  { id: "eth",      label: "Ethereum",     color: "#627EEA", icon: "cpu"       },
  { id: "bsc",      label: "BNB Chain",    color: "#F0B90B", icon: "zap"       },
  { id: "sol",      label: "Solana",       color: "#9945FF", icon: "wind"      },
  { id: "polygon",  label: "Polygon",      color: "#8247E5", icon: "hexagon"   },
  { id: "arbitrum", label: "Arbitrum",     color: "#28A0F0", icon: "triangle"  },
];

const COIN_CHAIN: Record<string, string> = {
  ETH:"eth", LINK:"eth", UNI:"eth",
  BNB:"bsc",
  SOL:"sol", NEAR:"sol",
  MATIC:"polygon",
  ARB:"arbitrum", OP:"arbitrum",
  BTC:"btc", DOGE:"btc", LTC:"btc",
  XRP:"xrp", ADA:"ada", DOT:"dot",
  ATOM:"cosmos", TRX:"trx",
  AVAX:"avax", APT:"aptos", SUI:"sui", INJ:"inj",
  USDT:"eth", USDC:"eth",
};

const COIN_COLORS: Record<string, string> = {
  BTC:"#F7931A", ETH:"#627EEA", BNB:"#F0B90B", USDT:"#26A17B", USDC:"#2775CA",
  SOL:"#9945FF", XRP:"#346AA9", ADA:"#0033AD", DOGE:"#C3A634", AVAX:"#E84142",
  TRX:"#EF0027", DOT:"#E6007A", MATIC:"#8247E5", LINK:"#2A5ADA", LTC:"#BFBBBB",
  ATOM:"#6F7390", UNI:"#FF007A", NEAR:"#00C08B", ARB:"#28A0F0", OP:"#FF0420",
  APT:"#2AA3EF", SUI:"#6FBCF0", INJ:"#00F2FE",
};

function formatUsd(n: number) {
  if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n/1e3).toFixed(2)}K`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortAddr(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

// ─── Receive Modal ────────────────────────────────────────────────────────────
function ReceiveModal({ address, onClose }: { address: string; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const [chain, setChain] = useState("eth");

  const copy = async () => {
    await Clipboard.setStringAsync(address);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = () => Share.share({ message: `My DeFi Wallet Address:\n${address}` });

  const displayChains = CHAINS.filter(c => c.id !== "all").slice(0, 5);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: insets.bottom }}>
        <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={s.iconBtn}>
            <Feather name="x" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.modalTitle, { color: colors.foreground }]}>Receive</Text>
          <TouchableOpacity onPress={share} style={s.iconBtn}>
            <Feather name="share" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20, alignItems: "center" }}>
          {/* Chain selector */}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {displayChains.map(c => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setChain(c.id)}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
                  backgroundColor: chain === c.id ? c.color + "18" : colors.secondary,
                  borderColor: chain === c.id ? c.color : colors.border,
                }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.color }} />
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: chain === c.id ? c.color : colors.mutedForeground }}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* QR card */}
          <View style={[s.qrCard, { backgroundColor: "#fff", shadowColor: "#000" }]}>
            <QRCode value={address || "0x0"} size={200} color="#000" backgroundColor="#fff" />
          </View>

          {/* Warning */}
          <View style={[s.warnBox, { backgroundColor: "#F0B90B12", borderColor: "#F0B90B30" }]}>
            <Feather name="alert-circle" size={13} color="#F0B90B" />
            <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: "#F0B90B", lineHeight: 18 }}>
              Only send assets compatible with this network. Wrong network assets may be lost.
            </Text>
          </View>

          {/* Address */}
          <View style={[s.addressBox, { backgroundColor: colors.card, borderColor: colors.border, width: "100%" }]}>
            <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 0.8, marginBottom: 6 }}>
              WALLET ADDRESS
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, lineHeight: 20 }} selectable>
              {address}
            </Text>
          </View>

          {/* Buttons */}
          <TouchableOpacity
            onPress={copy}
            activeOpacity={0.8}
            style={[s.primaryBtn, { backgroundColor: copied ? "#0ECB81" : colors.primary, width: "100%" }]}
          >
            <Feather name={copied ? "check" : "copy"} size={16} color="#fff" />
            <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" }}>
              {copied ? "Copied!" : "Copy Address"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Send Modal ───────────────────────────────────────────────────────────────
function SendModal({ tokens, onClose }: { tokens: CoinBalance[]; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { sendFromDex } = useWallet();
  const [step, setStep] = useState<"pick" | "form">("pick");
  const [selected, setSelected] = useState<CoinBalance | null>(null);
  const [toAddr, setToAddr] = useState("");
  const [amount, setAmount] = useState("");
  const [sent, setSent] = useState(false);
  const [sentHash, setSentHash] = useState("");

  const handleSend = () => {
    if (!toAddr.trim()) return Alert.alert("Invalid Address", "Please enter a destination address.");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return Alert.alert("Invalid Amount", "Please enter a valid amount.");
    if (selected && amt > selected.balance) return Alert.alert("Insufficient Balance", `You only have ${selected.balance.toFixed(6)} ${selected.symbol}.`);
    Alert.alert("Confirm Send", `Send ${amount} ${selected?.symbol} to\n${toAddr.slice(0,8)}…${toAddr.slice(-6)}?\n\nNetwork fee: ~$2.40`, [
      { text: "Cancel", style: "cancel" },
      { text: "Send", style: "destructive", onPress: () => {
          if (!selected) return;
          const network = COIN_CHAIN[selected.symbol] ?? "eth";
          const res = sendFromDex(selected.symbol, amt, toAddr.trim(), network);
          if (!res.ok) { Alert.alert("Send Failed", res.error ?? "Could not send transaction."); return; }
          setSentHash(res.tx?.hash ?? "");
          setSent(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } },
    ]);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: insets.bottom }}>
        <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={step === "form" && !sent ? () => setStep("pick") : onClose} style={s.iconBtn}>
            <Feather name={step === "form" && !sent ? "arrow-left" : "x"} size={18} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.modalTitle, { color: colors.foreground }]}>Send</Text>
          <View style={{ width: 40 }} />
        </View>

        {sent ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: "#0ECB8118", alignItems: "center", justifyContent: "center" }}>
              <Feather name="check-circle" size={44} color="#0ECB81" />
            </View>
            <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground }}>Transaction Sent</Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center" }}>
              {amount} {selected?.symbol} has been broadcast to the network.
            </Text>
            {sentHash ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.secondary }}>
                <Feather name="hash" size={12} color={colors.mutedForeground} />
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>{sentHash.slice(0, 10)}…{sentHash.slice(-8)}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
              <TouchableOpacity onPress={() => { onClose(); router.push("/defi-transactions"); }} style={[s.primaryBtn, { backgroundColor: colors.secondary, flex: 1 }]}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>View History</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={[s.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" }}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : step === "pick" ? (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 0.8, marginBottom: 4 }}>SELECT TOKEN</Text>
            {tokens.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 48, gap: 12 }}>
                <Feather name="inbox" size={40} color={colors.border} />
                <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>No tokens in DeFi wallet</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center" }}>
                  Transfer tokens from your Exchange Wallet first.
                </Text>
              </View>
            ) : (
              <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
                {tokens.map((t, i) => (
                  <TouchableOpacity
                    key={t.symbol}
                    onPress={() => { setSelected(t); setStep("form"); }}
                    activeOpacity={0.75}
                    style={[{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14 }, i < tokens.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                  >
                    <CoinLogo symbol={t.symbol} color={COIN_COLORS[t.symbol] ?? "#848E9C"} size={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{t.symbol}</Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{t.name}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>{t.balance.toFixed(6)}</Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{formatUsd(t.usdValue)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            {/* Token + balance */}
            <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <CoinLogo symbol={selected!.symbol} color={COIN_COLORS[selected!.symbol] ?? "#848E9C"} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>{selected!.symbol}</Text>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>Balance: {selected!.balance.toFixed(6)}</Text>
                </View>
                <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground }}>{formatUsd(selected!.usdValue)}</Text>
              </View>
            </View>

            {/* To address */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 0.8 }}>TO ADDRESS</Text>
              <View style={[s.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="at-sign" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={{ flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground }}
                  placeholder="0x... or ENS name"
                  placeholderTextColor={colors.mutedForeground}
                  value={toAddr}
                  onChangeText={setToAddr}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={async () => { const t = await Clipboard.getStringAsync(); setToAddr(t); }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary }}>Paste</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Amount */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 0.8 }}>AMOUNT</Text>
              <View style={[s.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  style={{ flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground }}
                  placeholder="0.000000"
                  placeholderTextColor={colors.mutedForeground}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity onPress={() => setAmount(selected!.balance.toFixed(6))}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: colors.primary }}>MAX</Text>
                </TouchableOpacity>
              </View>
              {/* Quick %s */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["25%","50%","75%","100%"].map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setAmount(((selected!.balance * parseInt(p)) / 100).toFixed(6))}
                    style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}
                  >
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Gas fee estimate */}
            <View style={[s.feeRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="zap" size={13} color={colors.mutedForeground} />
              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>Estimated network fee</Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: colors.foreground, marginLeft: "auto" }}>~$2.40</Text>
            </View>

            <TouchableOpacity onPress={handleSend} activeOpacity={0.85} style={[s.primaryBtn, { backgroundColor: colors.primary }]}>
              <Feather name="send" size={16} color="#fff" />
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" }}>Send {selected?.symbol}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Seed Phrase Modal ────────────────────────────────────────────────────────
function SeedPhraseModal({ seedPhrase, onClose }: { seedPhrase: string[]; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [confirmed, setConfirmed] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: insets.bottom }}>
        <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={s.iconBtn}>
            <Feather name="x" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.modalTitle, { color: colors.foreground }]}>Recovery Phrase</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          {!confirmed ? (
            <>
              <View style={{ alignItems: "center", gap: 14, paddingVertical: 12 }}>
                <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: "#FF4B4B18", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="alert-triangle" size={40} color="#FF4B4B" />
                </View>
                <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center" }}>Keep This Secret</Text>
                <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center", lineHeight: 22 }}>
                  Your 12-word recovery phrase is the master key to your wallet. Anyone who sees it can take all your funds.
                </Text>
              </View>
              {[
                { icon: "eye-off", text: "Never share it with anyone, including support staff" },
                { icon: "wifi-off", text: "Don't store it digitally or take screenshots" },
                { icon: "shield", text: "Write it on paper and store in a secure location" },
              ].map(r => (
                <View key={r.text} style={[{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
                  <Feather name={r.icon as any} size={16} color={colors.primary} />
                  <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground }}>{r.text}</Text>
                </View>
              ))}
              <TouchableOpacity
                onPress={() => { setConfirmed(true); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }}
                activeOpacity={0.85}
                style={[s.primaryBtn, { backgroundColor: "#FF4B4B" }]}
              >
                <Feather name="unlock" size={16} color="#fff" />
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" }}>I Understand, Show Phrase</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[s.warnBox, { backgroundColor: "#FF4B4B12", borderColor: "#FF4B4B30" }]}>
                <Feather name="eye-off" size={13} color="#FF4B4B" />
                <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: "#FF4B4B" }}>
                  Never share this phrase. Support will never ask for it.
                </Text>
              </View>
              <View style={[{ borderRadius: 16, padding: 18, gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 0.8 }}>12-WORD SEED PHRASE</Text>
                  <TouchableOpacity onPress={() => setRevealed(r => !r)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name={revealed ? "eye-off" : "eye"} size={14} color={colors.primary} />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary }}>{revealed ? "Hide" : "Reveal"}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {seedPhrase.map((word, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.secondary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, minWidth: "30%", flex: 1 }}>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: colors.mutedForeground, minWidth: 16 }}>{i + 1}</Text>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: revealed ? colors.foreground : colors.secondary }}>
                        {revealed ? word : "••••"}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  if (!revealed) return Alert.alert("Reveal First", "Please reveal your seed phrase before copying.");
                  await Clipboard.setStringAsync(seedPhrase.join(" "));
                  Alert.alert("⚠️ Copied to Clipboard", "Your seed phrase is now in your clipboard. Clear it immediately after use.");
                }}
                style={[s.secondaryBtn, { borderColor: colors.border }]}
              >
                <Feather name="copy" size={14} color={colors.mutedForeground} />
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>Copy (use with caution)</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── DeFi Position Card ───────────────────────────────────────────────────────
function PositionCard({ pos }: { pos: StakePosition }) {
  const { colors } = useTheme();
  const { getPrice } = useLivePrice();
  const lp = getPrice(pos.symbol);
  const usdValue = pos.amount * (lp > 0 ? lp : 0);
  const earned = pos.earnedRewards;
  const earnedUsd = earned * (lp > 0 ? lp : 0);
  const isActive = !pos.lockEnd || pos.lockEnd > Date.now();
  const typeColor = pos.type === "staking" ? "#9945FF" : pos.type === "liquid" ? "#00C087" : "#F0B90B";

  return (
    <View style={[s.posCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <CoinLogo symbol={pos.symbol} color={COIN_COLORS[pos.symbol] ?? "#848E9C"} size={44} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground }}>{pos.symbol}</Text>
            <View style={{ backgroundColor: typeColor + "18", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: typeColor }}>
                {pos.type === "staking" ? "STAKED" : pos.type === "liquid" ? "LIQUID" : "EARN"}
              </Text>
            </View>
            <View style={{ backgroundColor: isActive ? "#0ECB8118" : colors.secondary, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: isActive ? "#0ECB81" : colors.mutedForeground }}>
                {isActive ? "ACTIVE" : "ENDED"}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
            {pos.apy}% APY · {pos.duration ? `${pos.duration}d lock` : "Flexible"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 3 }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>{formatUsd(usdValue)}</Text>
          <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{pos.amount.toFixed(4)} {pos.symbol}</Text>
        </View>
      </View>
      {earned > 0 && (
        <View style={[s.rewardRow, { backgroundColor: "#0ECB8108", borderColor: "#0ECB8120" }]}>
          <Feather name="trending-up" size={13} color="#0ECB81" />
          <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: "#0ECB81" }}>
            Rewards earned: {earned.toFixed(6)} {pos.symbol}
          </Text>
          <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#0ECB81" }}>{formatUsd(earnedUsd)}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DeFiWalletDashboard() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { dexBalances, dexAddress, dexSeedPhrase, stakePositions, depositToDex, totalDexUsd, dexTxs, connectedDapps, resetDexWallet } = useWallet();
  const { getPrice, connected } = useLivePrice();

  const [hideBalance, setHideBalance] = useState(false);
  const [chain, setChain] = useState("all");
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);

  // Live-priced balances
  const tokens: CoinBalance[] = useMemo(() =>
    dexBalances
      .map(b => {
        const lp = getPrice(b.symbol);
        const uv = lp > 0 ? b.balance * lp : b.usdValue;
        return { ...b, usdValue: uv, color: COIN_COLORS[b.symbol] ?? "#848E9C" };
      })
      .filter(b => b.balance > 0)
      .sort((a, b) => b.usdValue - a.usdValue),
  [dexBalances, getPrice]);

  const totalUsd = tokens.reduce((s, t) => s + t.usdValue, 0) || totalDexUsd;

  const filteredTokens = chain === "all" ? tokens : tokens.filter(t => (COIN_CHAIN[t.symbol] ?? "eth") === chain);

  const copyAddr = async () => {
    await Clipboard.setStringAsync(dexAddress);
    setCopiedAddr(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const dexPositions = stakePositions.filter(p => p.type === "staking" || p.type === "liquid");

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

      {/* ── Balance Card ─────────────────────────────────────────────────── */}
      <View style={[s.balCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Header row */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#0ECB81" }} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>Self-Custody · Multi-Chain</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => router.push("/defi-transactions")} style={s.smallBtn}>
              <Feather name="clock" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setHideBalance(v => !v)} style={s.smallBtn}>
              <Feather name={hideBalance ? "eye-off" : "eye"} size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Total balance */}
        <View style={{ marginTop: 12, gap: 4 }}>
          <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>Total Portfolio Value</Text>
          <Text style={{ fontSize: 36, fontFamily: "Inter_700Bold", color: colors.foreground, letterSpacing: -1 }}>
            {hideBalance ? "••••••" : formatUsd(totalUsd)}
          </Text>
          {tokens.length > 0 && (
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
              {tokens.length} token{tokens.length !== 1 ? "s" : ""} across {Object.keys(new Set(tokens.map(t => COIN_CHAIN[t.symbol] ?? "eth"))).length} network{tokens.length > 1 ? "s" : ""}
            </Text>
          )}
        </View>

        {/* Address pill */}
        <TouchableOpacity onPress={copyAddr} activeOpacity={0.75} style={[s.addrPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="link" size={12} color={colors.mutedForeground} />
          <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{shortAddr(dexAddress)}</Text>
          <Feather name={copiedAddr ? "check" : "copy"} size={13} color={copiedAddr ? "#0ECB81" : colors.primary} />
          {copiedAddr && <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#0ECB81" }}>Copied</Text>}
        </TouchableOpacity>

        {/* Quick actions */}
        <View style={s.actionRow}>
          {[
            { icon: "send",         label: "Send",    color: "#F6465D", onPress: () => setShowSend(true) },
            { icon: "download",     label: "Receive", color: "#0ECB81", onPress: () => setShowReceive(true) },
            { icon: "repeat",       label: "Swap",    color: "#628EEA", onPress: () => Alert.alert("Swap", "Use the Swap tab to exchange tokens instantly.") },
            { icon: "chevrons-right",label: "Bridge", color: "#F0B90B", onPress: () => Alert.alert("Bridge", "Cross-chain bridge coming soon.") },
          ].map(a => (
            <TouchableOpacity key={a.label} onPress={a.onPress} activeOpacity={0.8} style={{ alignItems: "center", gap: 8, flex: 1 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: a.color + "18", alignItems: "center", justifyContent: "center" }}>
                <Feather name={a.icon as any} size={20} color={a.color} />
              </View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Network Filter ───────────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
        {CHAINS.map(c => (
          <TouchableOpacity
            key={c.id}
            onPress={() => setChain(c.id)}
            activeOpacity={0.75}
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
              backgroundColor: chain === c.id ? c.color + "18" : colors.card,
              borderColor: chain === c.id ? c.color : colors.border,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.color }} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: chain === c.id ? c.color : colors.mutedForeground }}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Token List ───────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 0.8 }}>
            TOKENS {filteredTokens.length > 0 && `· ${filteredTokens.length}`}
          </Text>
        </View>

        {filteredTokens.length === 0 ? (
          <View style={[s.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="inbox" size={32} color={colors.border} />
            <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>No tokens yet</Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center" }}>
              Transfer assets from your Exchange Wallet to get started.
            </Text>
          </View>
        ) : (
          <View style={[s.tokenCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {filteredTokens.map((t, i) => {
              const chain = CHAINS.find(c => c.id === (COIN_CHAIN[t.symbol] ?? "eth"));
              return (
                <TouchableOpacity
                  key={t.symbol}
                  activeOpacity={0.75}
                  onPress={() => router.push({ pathname: "/defi-asset", params: { symbol: t.symbol } })}
                  style={[
                    { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
                    i < filteredTokens.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                >
                  <CoinLogo symbol={t.symbol} color={COIN_COLORS[t.symbol] ?? "#848E9C"} size={44} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>{t.symbol}</Text>
                      {chain && (
                        <View style={{ backgroundColor: chain.color + "18", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: chain.color }}>{chain.label.split(" ")[0].toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{t.name}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 3 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                      {hideBalance ? "••••" : formatUsd(t.usdValue)}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                      {hideBalance ? "•••" : t.balance.toFixed(t.balance < 0.001 ? 8 : 6)}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* ── DeFi Positions ───────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 0.8 }}>
            DEFI POSITIONS {dexPositions.length > 0 && `· ${dexPositions.length}`}
          </Text>
        </View>

        {dexPositions.length === 0 ? (
          <View style={[s.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="percent" size={32} color={colors.border} />
            <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>No active positions</Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center" }}>
              Stake or provide liquidity from the Earn tab to start earning yield.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {dexPositions.map(p => <PositionCard key={p.id} pos={p} />)}
          </View>
        )}
      </View>

      {/* ── Security & Settings ──────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 0.8, marginBottom: 10 }}>
          SECURITY & SETTINGS
        </Text>
        <View style={[s.tokenCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { icon: "key",        color: "#F0B90B", label: "Recovery Phrase",      sub: "View and backup your 12-word phrase",                onPress: () => setShowSeed(true) },
            { icon: "list",       color: "#628EEA", label: "Transaction History",  sub: `${dexTxs.length} transaction${dexTxs.length === 1 ? "" : "s"}`, onPress: () => router.push("/defi-transactions") },
            { icon: "globe",      color: "#0ECB81", label: "Connected dApps",      sub: connectedDapps.length === 0 ? "No dApps connected" : `${connectedDapps.length} dApp${connectedDapps.length === 1 ? "" : "s"} connected`, onPress: () => router.push("/defi-dapps") },
            { icon: "copy",       color: "#9945FF", label: "Copy Full Address",    sub: dexAddress ? shortAddr(dexAddress) : "—",             onPress: copyAddr },
            { icon: "shield",     color: "#9945FF", label: "Security Checkup",     sub: "Seed phrase backed up",                              onPress: () => Alert.alert("Security", "Your seed phrase has been confirmed. Wallet is secure.") },
            { icon: "refresh-cw", color: "#F6465D", label: "Reset DeFi Wallet",    sub: "Wipe local wallet data",                             onPress: () => Alert.alert("Reset Wallet", "This will permanently delete your DeFi wallet from this device. Make sure you have your seed phrase backed up before proceeding.", [{ text: "Cancel", style: "cancel" }, { text: "Reset", style: "destructive", onPress: () => resetDexWallet() }]) },
          ].map((row, i, arr) => (
            <TouchableOpacity
              key={row.label}
              onPress={() => { row.onPress(); Haptics.selectionAsync(); }}
              activeOpacity={0.75}
              style={[
                { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
                i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: row.color + "18", alignItems: "center", justifyContent: "center" }}>
                <Feather name={row.icon as any} size={17} color={row.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{row.label}</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{row.sub}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Modals */}
      {showReceive && <ReceiveModal address={dexAddress} onClose={() => setShowReceive(false)} />}
      {showSend   && <SendModal tokens={tokens} onClose={() => setShowSend(false)} />}
      {showSeed   && <SeedPhraseModal seedPhrase={dexSeedPhrase} onClose={() => setShowSeed(false)} />}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  balCard:    { margin: 16, borderRadius: 24, padding: 20, gap: 16, borderWidth: StyleSheet.hairlineWidth },
  addrPill:   { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  actionRow:  { flexDirection: "row", justifyContent: "space-around", paddingTop: 4 },
  smallBtn:   { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  tokenCard:  { borderRadius: 18, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  posCard:    { borderRadius: 18, padding: 16, gap: 12, borderWidth: StyleSheet.hairlineWidth },
  emptyBox:   { borderRadius: 18, padding: 32, alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth },
  rewardRow:  { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, borderWidth: 1 },
  modalHeader:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  iconBtn:    { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  qrCard:    { borderRadius: 24, padding: 24, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  warnBox:   { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  addressBox:{ borderRadius: 14, padding: 14, borderWidth: 1 },
  primaryBtn:{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 56, borderRadius: 16 },
  secondaryBtn:{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52, borderRadius: 14, borderWidth: 1 },
  formCard:  { borderRadius: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  inputRow:  { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  feeRow:    { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
});
