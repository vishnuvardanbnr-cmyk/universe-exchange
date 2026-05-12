import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function InputField({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  rightElement,
  autoFocus,
}: {
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  rightElement?: React.ReactNode;
  autoFocus?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.inputWrap,
        {
          backgroundColor: colors.secondary,
          borderColor: focused ? colors.primary : colors.border,
          borderWidth: focused ? 1.5 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Feather name={icon as any} size={17} color={focused ? colors.primary : colors.mutedForeground} style={{ marginRight: 10 }} />
      <TextInput
        style={[styles.inputText, { color: colors.foreground, flex: 1, outlineStyle: "none" } as any]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        autoFocus={autoFocus}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {rightElement}
    </View>
  );
}

function DoneChip({
  icon,
  label,
  display,
  onEdit,
}: {
  icon: string;
  label: string;
  display: string;
  onEdit: () => void;
}) {
  const { colors } = useTheme();
  const primary = colors.primary;
  return (
    <TouchableOpacity
      onPress={onEdit}
      activeOpacity={0.7}
      style={[styles.doneChip, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.doneCheckCircle, { backgroundColor: "#00C087" + "1F", borderColor: "#00C087" }]}>
        <Feather name="check" size={14} color="#00C087" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <Feather name={icon as any} size={11} color={colors.mutedForeground} />
          <Text style={[styles.doneChipLabel, { color: colors.mutedForeground }]}>{label}</Text>
        </View>
        <Text style={[styles.doneChipValue, { color: colors.foreground }]} numberOfLines={1}>
          {display || "—"}
        </Text>
      </View>
      <View style={styles.doneEditBtn}>
        <Feather name="edit-2" size={13} color={primary} />
      </View>
    </TouchableOpacity>
  );
}

function LockedChip({ index, icon, label }: { index: number; icon: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.lockedChip, { borderColor: colors.border }]}>
      <Text style={[styles.lockedStepNum, { color: colors.mutedForeground, borderColor: colors.border }]}>
        {index + 1}
      </Text>
      <Feather name={icon as any} size={13} color={colors.mutedForeground} style={{ opacity: 0.6 }} />
      <Text style={[styles.lockedChipLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
        {label}
      </Text>
      <Feather name="lock" size={11} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
    </View>
  );
}

function PasswordStrength({ value }: { value: string }) {
  const { colors } = useTheme();
  const len = value.length;
  const hasUpper = /[A-Z]/.test(value);
  const hasNum = /[0-9]/.test(value);
  const hasSym = /[^A-Za-z0-9]/.test(value);
  let score = 0;
  if (len >= 6) score++;
  if (len >= 10) score++;
  if (hasUpper && hasNum) score++;
  if (hasSym) score++;
  const labels = ["Too short", "Weak", "Fair", "Strong", "Excellent"];
  const palette = ["#6B7280", "#F6465D", "#F0B90B", "#00C087", "#00C087"];
  const idx = Math.min(score, 4);
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i < idx ? palette[idx] : colors.border,
            }}
          />
        ))}
      </View>
      <Text style={{ marginTop: 6, fontSize: 11, fontFamily: "Inter_600SemiBold", color: palette[idx], letterSpacing: 0.3 }}>
        {labels[idx]}
      </Text>
    </View>
  );
}

export default function RegisterScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { register, isLoggedIn, checkEmailExists } = useAuth();
  const primary = colors.primary;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [regStep, setRegStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Live email-availability check
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");

  useEffect(() => {
    if (isLoggedIn) router.replace("/(tabs)");
  }, [isLoggedIn, router]);

  useEffect(() => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailStatus("idle");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setEmailStatus("invalid");
      return;
    }
    setEmailStatus("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const exists = await checkEmailExists(trimmed);
        if (cancelled) return;
        setEmailStatus(exists ? "taken" : "available");
      } catch {
        if (!cancelled) setEmailStatus("idle");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [email, checkEmailExists]);

  const animateRegStep = (next: number) => {
    if (Platform.OS !== "web") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setRegStep(next);
    Haptics.selectionAsync().catch(() => {});
  };

  const FIELDS = [
    { key: "name", label: "Full Name", icon: "user", placeholder: "Your full name", value: name, set: setName, autoCap: "words" as const, kbd: "default" as const, secure: false, display: name, helper: "We'll use this on your profile" },
    { key: "email", label: "Email Address", icon: "mail", placeholder: "you@example.com", value: email, set: setEmail, autoCap: "none" as const, kbd: "email-address" as const, secure: false, display: email, helper: "Used for sign-in & notifications" },
    { key: "password", label: "Password", icon: "lock", placeholder: "Minimum 6 characters", value: password, set: setPassword, autoCap: "none" as const, kbd: "default" as const, secure: true, display: "•".repeat(password.length), helper: "Make it strong — at least 6 characters" },
    { key: "confirm", label: "Confirm Password", icon: "check-circle", placeholder: "Re-enter password", value: confirmPw, set: setConfirmPw, autoCap: "none" as const, kbd: "default" as const, secure: true, display: "•".repeat(confirmPw.length), helper: "Type your password again to confirm" },
  ];

  const validateRegStep = (i: number): { ok: boolean; msg?: string } => {
    if (i === 0) {
      if (name.trim().length < 2) return { ok: false, msg: "Please enter your full name." };
    } else if (i === 1) {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return { ok: false, msg: "Please enter a valid email address." };
      if (emailStatus === "checking") return { ok: false, msg: "Checking email availability…" };
      if (emailStatus === "taken") return { ok: false, msg: "An account with this email already exists. Please sign in instead." };
    } else if (i === 2) {
      if (password.length < 6) return { ok: false, msg: "Password must be at least 6 characters." };
    } else if (i === 3) {
      if (confirmPw !== password) return { ok: false, msg: "Passwords do not match." };
      if (confirmPw.length < 6) return { ok: false, msg: "Password must be at least 6 characters." };
    }
    return { ok: true };
  };

  const handleCreate = async () => {
    for (let i = 0; i < FIELDS.length; i++) {
      const v = validateRegStep(i);
      if (!v.ok) {
        Alert.alert("Check your details", v.msg ?? "Invalid input.");
        animateRegStep(i);
        return;
      }
    }
    setLoading(true);
    try {
      await register("email", { displayName: name.trim(), email: email.trim(), password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Registration failed", e?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filledCount = regStep;
  const progress = filledCount / FIELDS.length;
  const topPad = Math.max(insets.top, 12);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={20}
        extraKeyboardSpace={20}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={[primary + "22", colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: topPad + 10 }]}
        >
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]} activeOpacity={0.7}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>

          <View style={styles.brandRow}>
            <View style={[styles.brandLogo, { backgroundColor: primary }]}>
              <Text style={styles.brandLogoText}>UX</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.brandName, { color: colors.foreground }]}>Create your account</Text>
              <Text style={[styles.brandTagline, { color: colors.mutedForeground }]}>Join millions of traders worldwide</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 24, marginTop: 4, gap: 12 }}>
          <View style={[styles.regHeader, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={[styles.regHeaderLabel, { color: colors.foreground }]}>
                  {regStep >= FIELDS.length ? "All set!" : `Step ${regStep + 1} of ${FIELDS.length}`}
                </Text>
                <Text style={[styles.regHeaderHint, { color: colors.mutedForeground }]}>
                  {regStep >= FIELDS.length ? "Review & create" : FIELDS[regStep].label}
                </Text>
              </View>
              <View style={[styles.regProgressTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.regProgressFill, { width: `${progress * 100}%`, backgroundColor: primary }]} />
              </View>
            </View>
          </View>

          {FIELDS.map((f, i) => {
            if (i < regStep) {
              return (
                <DoneChip
                  key={f.key}
                  icon={f.icon}
                  label={f.label}
                  display={f.display}
                  onEdit={() => animateRegStep(i)}
                />
              );
            }
            if (i === regStep) {
              const isLast = i === FIELDS.length - 1;
              const v = validateRegStep(i);
              return (
                <View key={`active-${i}`} style={[styles.regActiveCard, { backgroundColor: colors.card, borderColor: primary + "55" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <View style={[styles.regStepDot, { backgroundColor: primary }]}>
                      <Text style={styles.regStepDotText}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: colors.foreground, marginLeft: 0 }]}>{f.label}</Text>
                      <Text style={[styles.regHelperText, { color: colors.mutedForeground }]}>{f.helper}</Text>
                    </View>
                  </View>
                  <InputField
                    icon={f.icon}
                    placeholder={f.placeholder}
                    value={f.value}
                    onChangeText={f.set}
                    autoCapitalize={f.autoCap}
                    keyboardType={f.kbd}
                    secureTextEntry={f.secure && !showPw}
                    autoFocus
                    rightElement={
                      f.secure ? (
                        <TouchableOpacity onPress={() => setShowPw(!showPw)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Feather name={showPw ? "eye-off" : "eye"} size={17} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      ) : undefined
                    }
                  />
                  {f.key === "email" && email.trim().length > 0 && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginLeft: 4 }}>
                      {emailStatus === "checking" && (
                        <>
                          <ActivityIndicator size="small" color={colors.mutedForeground} />
                          <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                            Checking availability…
                          </Text>
                        </>
                      )}
                      {emailStatus === "available" && (
                        <>
                          <Feather name="check-circle" size={14} color="#00C087" />
                          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#00C087" }}>
                            Email is available
                          </Text>
                        </>
                      )}
                      {emailStatus === "taken" && (
                        <>
                          <Feather name="alert-circle" size={14} color="#F6465D" />
                          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#F6465D", flex: 1 }}>
                            Already registered.{" "}
                            <Text style={{ color: primary, textDecorationLine: "underline" }} onPress={() => router.replace("/auth")}>
                              Sign in instead
                            </Text>
                          </Text>
                        </>
                      )}
                      {emailStatus === "invalid" && (
                        <>
                          <Feather name="alert-circle" size={14} color="#F0B90B" />
                          <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: "#F0B90B" }}>
                            Enter a valid email address
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                  {i === 2 && password.length > 0 && <PasswordStrength value={password} />}
                  <TouchableOpacity
                    style={[
                      styles.regContinueBtn,
                      { backgroundColor: v.ok ? primary : colors.border, opacity: v.ok ? 1 : 0.7 },
                    ]}
                    onPress={() => {
                      const r = validateRegStep(i);
                      if (!r.ok) {
                        Alert.alert("Check this field", r.msg ?? "Invalid input.");
                        return;
                      }
                      animateRegStep(i + 1);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.regContinueText, { color: v.ok ? colors.primaryForeground : colors.mutedForeground }]}>
                      {isLast ? "Review" : "Continue"}
                    </Text>
                    <Feather name="arrow-right" size={16} color={v.ok ? colors.primaryForeground : colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              );
            }
            return <LockedChip key={f.key} index={i} icon={f.icon} label={f.label} />;
          })}

          {regStep >= FIELDS.length && (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: primary, marginTop: 4, flexDirection: "row", gap: 8 }]}
              onPress={handleCreate}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="check-circle" size={18} color={colors.primaryForeground} />
                  <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Create Account</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <Text style={[styles.termsText, { color: colors.mutedForeground }]}>
            By registering you agree to our{" "}
            <Text style={{ color: primary, fontFamily: "Inter_600SemiBold" }} onPress={() => router.push("/terms")}>Terms of Service</Text>
            {" "}and{" "}
            <Text style={{ color: primary, fontFamily: "Inter_600SemiBold" }} onPress={() => router.push("/terms")}>Privacy Policy</Text>.
          </Text>

          <TouchableOpacity onPress={() => router.replace("/auth")} activeOpacity={0.7} style={{ alignSelf: "center", marginTop: 6 }}>
            <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
              Already have an account? <Text style={{ color: primary }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { paddingHorizontal: 24, paddingBottom: 18 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    marginBottom: 16, borderWidth: StyleSheet.hairlineWidth,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  brandLogo: {
    width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center",
    shadowColor: "#F0B90B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  brandLogoText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0B0E11", letterSpacing: 0.5 },
  brandName: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  brandTagline: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginLeft: 4, letterSpacing: 0.3, textTransform: "uppercase" },
  inputWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, borderRadius: 13 },
  inputText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  primaryBtn: {
    height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center",
    shadowColor: "#F0B90B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  linkText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  termsText: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 14, lineHeight: 18 },
  trustFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 22, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  trustFooterText: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2 },
  benefitsRow: {
    flexDirection: "row", gap: 10, marginTop: 14,
  },
  benefitItem: {
    flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 6,
  },
  benefitIconBox: {
    width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  benefitTitle: { fontSize: 12, fontFamily: "Inter_700Bold", textAlign: "center" },
  benefitSub: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 2 },
  copyrightText: {
    fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center",
    marginTop: 18, marginBottom: 8, letterSpacing: 0.3,
  },
  regHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  regHeaderLabel: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  regHeaderHint: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.2 },
  regProgressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  regProgressFill: { height: "100%", borderRadius: 3 },
  doneChip: {
    flexDirection: "row", alignItems: "center", gap: 16,
    paddingHorizontal: 18, paddingVertical: 18, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
  },
  doneCheckCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  doneChipLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase" },
  doneChipValue: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  doneEditBtn: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  lockedChip: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed", opacity: 0.7,
  },
  lockedStepNum: {
    width: 22, height: 22, borderRadius: 11, textAlign: "center", lineHeight: 20,
    fontSize: 11, fontFamily: "Inter_700Bold", borderWidth: StyleSheet.hairlineWidth,
  },
  lockedChipLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  regActiveCard: {
    padding: 16, borderRadius: 16, borderWidth: 1,
    shadowColor: "#F0B90B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 14, elevation: 4,
  },
  regStepDot: {
    width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
    shadowColor: "#F0B90B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 3,
  },
  regStepDotText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0B0E11" },
  regHelperText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  regContinueBtn: {
    marginTop: 14, height: 46, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  regContinueText: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
});
