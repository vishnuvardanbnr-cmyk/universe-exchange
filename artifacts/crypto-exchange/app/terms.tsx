import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";

const SECTIONS = [
  { id: "1", icon: "check-circle", color: "#0ECB81", title: "Acceptance of Terms", body: `By accessing or using Universe X Exchange ("the Platform"), you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the Platform.\n\nThese Terms constitute a legally binding agreement between you and Universe X Exchange Ltd. ("Universe X"). These Terms apply to all visitors, users, and others who access or use the Platform.` },
  { id: "2", icon: "user-check", color: "#628EEA", title: "Eligibility", body: `You must be at least 18 years of age to use Universe X. By using the Platform, you represent and warrant that:\n\n• You are at least 18 years old\n• You have the legal capacity to enter into a binding contract\n• You are not prohibited from using financial services under applicable law\n• You are not a resident of a jurisdiction where cryptocurrency trading is prohibited\n• Your use will not violate any applicable laws or regulations` },
  { id: "3", icon: "lock", color: "#9945FF", title: "Account Registration & Security", body: `To use certain features, you must create an account. You agree to:\n\n• Provide accurate, current, and complete information\n• Maintain and promptly update your account information\n• Keep your account credentials secure\n• Notify us immediately of any unauthorized access\n• Accept responsibility for all activities under your account\n\nYou may link multiple authentication methods to your account. You are responsible for all activity regardless of the authentication method used.` },
  { id: "4", icon: "trending-up", color: "#F0B90B", title: "Trading Rules & Risks", body: `Cryptocurrency trading involves significant risk. You acknowledge:\n\n• Cryptocurrency prices are highly volatile and unpredictable\n• You may lose some or all of your invested capital\n• Past performance does not indicate future results\n• Market data is for informational purposes only\n• Order execution depends on market conditions\n\nSpot Trading: Orders execute against real Binance order book liquidity. Execution is not guaranteed.\n\nInstant Swap: Rates may differ slightly from quoted rates due to market movements.` },
  { id: "5", icon: "percent", color: "#F7931A", title: "Earn Products & Staking", body: `By participating in Earn products:\n\n• APY rates are estimates and not guaranteed\n• Rates may change based on market conditions\n• Fixed-term products lock assets for the specified period\n• Early redemption may not be available\n• Liquid staking tokens may trade at a premium or discount\n• Earn product availability may change without notice` },
  { id: "6", icon: "briefcase", color: "#0ECB81", title: "Wallet & Custody", body: `CEX Wallet (Custodial): Assets are held by Universe X on your behalf. We maintain private keys and are responsible for security.\n\nDEX Wallet (Self-Custody): Your private keys are stored locally on your device. Universe X does not have access. You are solely responsible for securing your wallet. Loss of your seed phrase means permanent loss of access.\n\nAlways verify wallet addresses before any transaction. Universe X is not liable for funds sent to incorrect addresses.` },
  { id: "7", icon: "dollar-sign", color: "#628EEA", title: "Fees & Charges", body: `Universe X charges fees for certain services. Fee schedules are available on the Platform and may be updated. By using the Platform, you agree to pay all applicable fees.\n\n• Trading fees: Applied to all completed spot trades\n• Withdrawal fees: Network gas fees plus platform fee\n• Swap fees: Included in the exchange rate\n• Staking fees: Performance fee on staking rewards` },
  { id: "8", icon: "slash", color: "#F6465D", title: "Prohibited Activities", body: `You agree not to engage in:\n\n• Money laundering, terrorist financing, or other illegal activities\n• Market manipulation, wash trading, or artificial price inflation\n• Using the Platform in a prohibited jurisdiction\n• Attempting to bypass security measures or access controls\n• Creating multiple accounts to circumvent limits\n• Using automated bots without written permission\n• Providing false information during KYC/AML verification` },
  { id: "9", icon: "shield", color: "#9945FF", title: "KYC & AML Compliance", body: `Universe X complies with applicable KYC and AML regulations. We may:\n\n• Require identity verification before allowing certain features\n• Request additional documentation at any time\n• Suspend accounts that fail to complete verification\n• Report suspicious activity to relevant authorities\n• Freeze funds pending investigation\n\nFailure to complete KYC may result in restricted access.` },
  { id: "10", icon: "eye-off", color: "#848E9C", title: "Privacy & Data Protection", body: `Our Privacy Policy explains how we collect, use, and protect your personal data. By using the Platform, you consent to data processing as described.\n\nWe use industry-standard encryption and security measures. However, no system is completely secure, and we cannot guarantee absolute security of your information.` },
  { id: "11", icon: "alert-triangle", color: "#F0B90B", title: "Limitation of Liability", body: `To the maximum extent permitted by law, Universe X shall not be liable for:\n\n• Trading losses or missed opportunities\n• Technical failures, outages, or delays\n• Unauthorized account access (if you failed to maintain security)\n• Actions of third-party service providers\n• Regulatory changes affecting your ability to trade\n• Force majeure events\n\nOur total liability shall not exceed fees paid in the 90 days preceding the claim.` },
  { id: "12", icon: "refresh-cw", color: "#F7931A", title: "Changes to Terms", body: `We reserve the right to modify these Terms at any time. Material changes will be notified via in-app notification, email, or prominent notice on the Platform.\n\nContinued use after changes constitutes acceptance of the revised Terms. If you disagree, you must stop using the Platform and close your account.` },
  { id: "13", icon: "globe", color: "#628EEA", title: "Governing Law", body: `These Terms shall be governed by the laws of the jurisdiction in which Universe X Exchange Ltd. is incorporated.\n\nAny disputes shall be subject to the exclusive jurisdiction of the courts of that jurisdiction, unless otherwise required by mandatory law in your country of residence.` },
  { id: "14", icon: "mail", color: "#0ECB81", title: "Contact Information", body: `For questions about these Terms:\n\nEmail: legal@cryptox.exchange\nSupport: Use the in-app Support chat for fastest response\n\nLast updated: January 1, 2025\nEffective date: January 1, 2025` },
];

export default function TermsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const topPad = Platform.OS === "web" ? 20 : insets.top + 8;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Terms & Conditions</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="file-text" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>Universe X Exchange</Text>
            <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>Terms & Conditions · Privacy Policy</Text>
            <View style={[styles.dateBadge, { backgroundColor: colors.secondary }]}>
              <Feather name="calendar" size={11} color={colors.mutedForeground} />
              <Text style={[styles.dateBadgeText, { color: colors.mutedForeground }]}>Last updated: January 1, 2025</Text>
            </View>
          </View>
        </View>

        <View style={{ padding: 16, gap: 6 }}>
          <Text style={[styles.intro, { color: colors.mutedForeground }]}>
            Please read these Terms carefully before using Universe X Exchange. Tap any section to read the full terms.
          </Text>

          {SECTIONS.map((s) => {
            const isOpen = expanded === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.accordion, { backgroundColor: colors.card, borderColor: isOpen ? s.color + "50" : colors.border }]}
                onPress={() => { setExpanded(isOpen ? null : s.id); Haptics.selectionAsync(); }}
                activeOpacity={0.8}
              >
                <View style={styles.accordionHeader}>
                  <View style={[styles.accIcon, { backgroundColor: s.color + "15" }]}>
                    <Feather name={s.icon as any} size={14} color={s.color} />
                  </View>
                  <Text style={[styles.accordionTitle, { color: colors.foreground }]}>{s.title}</Text>
                  <View style={[styles.chevronWrap, { backgroundColor: isOpen ? s.color + "15" : colors.secondary, transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }]}>
                    <Feather name="chevron-down" size={14} color={isOpen ? s.color : colors.mutedForeground} />
                  </View>
                </View>
                {isOpen && (
                  <View style={[styles.accordionBody, { borderTopColor: colors.border }]}>
                    <Text style={[styles.accordionText, { color: colors.mutedForeground }]}>{s.body}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          <View style={[styles.footer, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="message-circle" size={15} color={colors.primary} />
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              Questions about these terms?{" "}
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }} onPress={() => router.push("/support")}>Contact Support</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  hero: { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  heroSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  dateBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
  dateBadgeText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  intro: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 6 },
  accordion: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  accordionHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  accIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  accordionTitle: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  chevronWrap: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  accordionBody: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth },
  accordionText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, paddingTop: 12 },
  footer: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 6 },
  footerText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
});
