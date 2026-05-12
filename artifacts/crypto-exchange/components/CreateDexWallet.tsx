import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
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

type Step = "intro" | "generate" | "confirm" | "import" | "done";

export default function CreateDexWallet() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { createDexWallet, confirmSeed, dexAddress, importDexWallet, walletImported } = useWallet();
  const [step, setStep] = useState<Step>("intro");
  const [seedPhrase, setSeedPhrase] = useState<string[]>([]);
  const [confirmIndices] = useState<number[]>([1, 4, 7, 10]);
  const [confirmInputs, setConfirmInputs] = useState<Record<number, string>>({});
  const [confirmError, setConfirmError] = useState("");
  const [importWords, setImportWords] = useState<string[]>(Array(12).fill(""));
  const [importError, setImportError] = useState("");

  const [busy, setBusy] = useState(false);
  const handleGenerate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const seed = await createDexWallet();
      setSeedPhrase(seed);
      setStep("generate");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally { setBusy(false); }
  };

  const handleConfirm = () => {
    let allCorrect = true;
    for (const idx of confirmIndices) {
      const word = confirmInputs[idx] ?? "";
      if (word.trim().toLowerCase() !== seedPhrase[idx]) {
        allCorrect = false;
        break;
      }
    }
    if (!allCorrect) {
      setConfirmError("Some words are incorrect. Please check your seed phrase and try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setConfirmError("");
    confirmSeed();
    setStep("done");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (step === "intro") {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.iconWrap}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "40" }]}>
            <Feather name="shield" size={48} color={colors.primary} />
          </View>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Create Your{"\n"}DeFi Wallet</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Your decentralized wallet gives you full custody of your assets. Only you hold the keys.
        </Text>

        <View style={styles.featureList}>
          {[
            { icon: "key", label: "You own your private keys" },
            { icon: "lock", label: "12-word recovery seed phrase" },
            { icon: "globe", label: "Access any DeFi protocol" },
            { icon: "shield", label: "Non-custodial & trustless" },
          ].map((f) => (
            <View key={f.label} style={[styles.featureRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primary + "18" }]}>
                <Feather name={f.icon as any} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.featureText, { color: colors.foreground }]}>{f.label}</Text>
              <Feather name="check" size={14} color={colors.success} />
            </View>
          ))}
        </View>

        <View style={[styles.warningBox, { backgroundColor: "#FF6B35" + "15", borderColor: "#FF6B35" + "30" }]}>
          <Feather name="alert-triangle" size={16} color="#FF6B35" />
          <Text style={[styles.warningText, { color: "#FF6B35" }]}>
            You will be shown a 12-word seed phrase. Write it down and store it safely. Anyone with this phrase can access your funds.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={handleGenerate}
          activeOpacity={0.85}
        >
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Create New Wallet</Text>
          <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border }]}
          onPress={() => { setStep("import"); Haptics.selectionAsync(); }}
          activeOpacity={0.85}
        >
          <Feather name="download" size={16} color={colors.foreground} />
          <Text style={[styles.primaryBtnText, { color: colors.foreground }]}>Import Existing Wallet</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === "import") {
    const handleImport = async () => {
      if (busy) return;
      setBusy(true);
      try {
        const res = await importDexWallet(importWords);
        if (!res.ok) {
          setImportError(res.error ?? "Could not import wallet.");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
        setImportError("");
        setStep("done");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } finally { setBusy(false); }
    };
    const handlePaste = (text: string) => {
      const parts = text.trim().split(/\s+/).slice(0, 12);
      const next = Array(12).fill("");
      parts.forEach((w, i) => { next[i] = w.toLowerCase(); });
      setImportWords(next);
    };
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.stepHeader}>
          <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.stepNum, { color: colors.primaryForeground }]}>Import</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Restore Your{"\n"}Wallet</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Enter your 12-word recovery phrase. Word order matters.
          </Text>
        </View>

        <TouchableOpacity
          onPress={async () => {
            const Clipboard = await import("expo-clipboard");
            const txt = await Clipboard.getStringAsync();
            if (txt) handlePaste(txt);
          }}
          style={[styles.warningBox, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}
        >
          <Feather name="clipboard" size={14} color={colors.primary} />
          <Text style={[styles.warningText, { color: colors.primary }]}>
            Tap here to paste your full 12-word phrase from clipboard
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {importWords.map((w, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, minWidth: "30%", flex: 1 }}>
              <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, minWidth: 16 }}>{i + 1}.</Text>
              <TextInput
                value={w}
                onChangeText={(t) => { const next = [...importWords]; next[i] = t.trim().toLowerCase(); setImportWords(next); }}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, padding: 0 }}
                placeholder="word"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          ))}
        </View>

        {importError ? (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15" }]}>
            <Feather name="x-circle" size={14} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{importError}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleImport} activeOpacity={0.85}>
          <Feather name="check" size={18} color={colors.primaryForeground} />
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Import Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setStep("intro")} style={styles.backBtn}>
          <Feather name="arrow-left" size={14} color={colors.mutedForeground} />
          <Text style={[styles.backBtnText, { color: colors.mutedForeground }]}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (step === "generate") {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.stepNum, { color: colors.primaryForeground }]}>1 of 2</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Save Your{"\n"}Seed Phrase</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Write down these 12 words in the exact order shown. Do not screenshot or store digitally.
          </Text>
        </View>

        <View style={[styles.seedContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.seedGrid}>
            {seedPhrase.map((word, i) => (
              <View key={i} style={[styles.seedWordBox, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.seedWordNum, { color: colors.mutedForeground }]}>{i + 1}</Text>
                <Text style={[styles.seedWord, { color: colors.foreground }]}>{word}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.warningBox, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "30" }]}>
          <Feather name="eye-off" size={15} color={colors.destructive} />
          <Text style={[styles.warningText, { color: colors.destructive }]}>
            Never share this phrase. Support staff will never ask for it. Anyone who has it controls your wallet.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => setStep("confirm")}
          activeOpacity={0.85}
        >
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>I've Written It Down</Text>
          <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (step === "confirm") {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.stepNum, { color: colors.primaryForeground }]}>2 of 2</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Verify Your{"\n"}Seed Phrase</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Enter the words at the requested positions to confirm you've saved your seed phrase.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          {confirmIndices.map((idx) => (
            <View key={idx} style={[styles.confirmInput, { backgroundColor: colors.card, borderColor: confirmError && !confirmInputs[idx] ? colors.destructive : colors.border }]}>
              <View style={[styles.confirmNum, { backgroundColor: colors.primary + "18" }]}>
                <Text style={[styles.confirmNumText, { color: colors.primary }]}>#{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>Word {idx + 1}</Text>
                <View>
                  {/* Simple word entry using TouchableOpacity buttons for each potential word */}
                  <View style={styles.wordOptions}>
                    {[seedPhrase[idx], ...seedPhrase.filter((_, i) => i !== idx).slice(0, 3)].sort(() => Math.random() - 0.5).map((word) => (
                      <TouchableOpacity
                        key={word}
                        onPress={() => setConfirmInputs((p) => ({ ...p, [idx]: word }))}
                        style={[
                          styles.wordOption,
                          {
                            backgroundColor: confirmInputs[idx] === word ? colors.primary : colors.secondary,
                            borderColor: confirmInputs[idx] === word ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.wordOptionText, { color: confirmInputs[idx] === word ? colors.primaryForeground : colors.foreground }]}>{word}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        {confirmError ? (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15" }]}>
            <Feather name="x-circle" size={14} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{confirmError}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Verify & Create Wallet</Text>
          <Feather name="check" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setStep("generate")} style={styles.backBtn}>
          <Feather name="arrow-left" size={14} color={colors.mutedForeground} />
          <Text style={[styles.backBtnText, { color: colors.mutedForeground }]}>Show seed phrase again</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.iconWrap}>
        <View style={[styles.iconCircle, { backgroundColor: colors.success + "20", borderColor: colors.success + "40" }]}>
          <Feather name="check-circle" size={48} color={colors.success} />
        </View>
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{walletImported ? "Wallet Imported" : "Wallet Created"}{"\n"}Successfully</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Your self-custody DeFi wallet is ready. You now have full control of your assets.
      </Text>
      <View style={[styles.addressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.addressLabel, { color: colors.mutedForeground }]}>Your Wallet Address</Text>
        <Text style={[styles.addressValue, { color: colors.foreground }]} numberOfLines={2}>{dexAddress}</Text>
        <View style={[styles.networkBadge, { backgroundColor: colors.primary + "18" }]}>
          <View style={[styles.networkDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.networkText, { color: colors.primary }]}>Multi-chain · EVM Compatible</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 20, flexGrow: 1 },
  iconWrap: { alignItems: "center", marginTop: 20 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  stepHeader: { gap: 8 },
  stepBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  stepNum: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", lineHeight: 36, textAlign: "center" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22, textAlign: "center" },
  featureList: { gap: 0, borderRadius: 16, overflow: "hidden" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  featureIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  warningBox: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  warningText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 18 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 18, borderRadius: 14 },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  seedContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  seedGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  seedWordBox: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, minWidth: "30%", flex: 1 },
  seedWordNum: { fontSize: 10, fontFamily: "Inter_500Medium", minWidth: 14 },
  seedWord: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  confirmInput: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  confirmNum: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  confirmNumText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  confirmLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 6 },
  wordOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  wordOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  wordOptionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  errorBox: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 10, alignItems: "center" },
  errorText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  backBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4 },
  backBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  addressCard: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 10 },
  addressLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  addressValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  networkBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  networkDot: { width: 6, height: 6, borderRadius: 3 },
  networkText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
