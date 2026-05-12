import { Feather, FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/context/ThemeContext";
import { useAuth, AuthMethod, TwoFactorRequiredError, LoginData } from "@/context/AuthContext";

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const API_BASE = process.env.EXPO_PUBLIC_API_BASE
  ? process.env.EXPO_PUBLIC_API_BASE
  : `https://${process.env["EXPO_PUBLIC_DOMAIN"] ?? "localhost:8080"}`;

const APPLE_IDENTITY_KEY = "cryptox_sim_apple_identity_v1";

type SimIdentity = { token: string; email: string; displayName: string };

async function getOrCreateSimIdentity(key: string, provider: "apple"): Promise<SimIdentity> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as SimIdentity;
      if (parsed?.token && parsed?.email) return parsed;
    }
  } catch {}
  const rand = Math.random().toString(36).slice(2, 10);
  const identity: SimIdentity = {
    token: `${provider}_${Date.now()}_${rand}`,
    email: `${provider}user_${rand}@icloud.com`,
    displayName: "Apple User",
  };
  await AsyncStorage.setItem(key, JSON.stringify(identity));
  return identity;
}

type GoogleProfile = { sub: string; email: string; name?: string; picture?: string };

async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo failed (${res.status})`);
  const data = await res.json();
  if (!data?.sub) throw new Error("Google did not return a user id");
  return { sub: data.sub, email: data.email ?? "", name: data.name, picture: data.picture };
}

type Step = "main" | "phone_entry" | "phone_otp" | "forgot" | "twofa";

const DEMO_OTP = "123456";

function InputField({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  maxLength,
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
  maxLength?: number;
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
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {rightElement}
    </View>
  );
}

function GoogleGlyph() {
  return (
    <View style={styles.googleGlyph}>
      <Text style={[styles.googleGlyphLetter, { color: "#4285F4" }]}>G</Text>
    </View>
  );
}

export default function AuthScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, register, completeLoginWithTwoFactor, isLoggedIn, checkEmailExists, linkGoogleToEmailAccount } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<Step>("main");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorError, setTwoFactorError] = useState("");
  const [pendingLogin, setPendingLogin] = useState<{ method: AuthMethod; data: LoginData } | null>(null);

  const slideAnim = useRef(new Animated.Value(isLogin ? 0 : 1)).current;

  useEffect(() => {
    if (isLoggedIn) router.replace("/(tabs)");
  }, [isLoggedIn, router]);

  // Handle Google OAuth callback (web only). Server redirects back with
  // #google_profile=<base64url(json)> or #google_error=<msg>
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    if (!hash.includes("google_profile=") && !hash.includes("google_error=")) return;

    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const profileEncoded = params.get("google_profile");
    const errorParam = params.get("google_error");

    // Recover the tab the user came from (login vs register), set in handleGoogle().
    let intent: "login" | "register" = "login";
    try {
      const stored = window.localStorage.getItem("cryptox_google_intent");
      if (stored === "register" || stored === "login") intent = stored;
      window.localStorage.removeItem("cryptox_google_intent");
    } catch {}
    setIsLogin(intent === "login");

    // Clear hash so refresh doesn't retrigger
    try { window.history.replaceState(null, "", window.location.pathname); } catch {}

    if (errorParam) {
      Alert.alert("Google Sign-In Failed", errorParam);
      return;
    }
    if (!profileEncoded) return;

    let profile: { sub: string; email?: string; name?: string };
    try {
      const json = atob(profileEncoded.replace(/-/g, "+").replace(/_/g, "/"));
      profile = JSON.parse(json);
      if (!profile.sub) throw new Error("Missing sub");
    } catch {
      Alert.alert("Google Sign-In Failed", "Could not parse profile data.");
      return;
    }

    const displayName = profile.name || (profile.email ? profile.email.split("@")[0] : "Google User");

    const promptPasswordToLink = (): Promise<string | null> => {
      return new Promise((resolve) => {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const pw = window.prompt(
            `An account already exists for ${profile.email}.\n\nEnter your password to link Google to that account:`,
          );
          resolve(pw && pw.length > 0 ? pw : null);
          return;
        }
        if (typeof (Alert as any).prompt === "function") {
          (Alert as any).prompt(
            "Link Google to your account",
            `An account already exists for ${profile.email}. Enter your password to link Google sign-in to it.`,
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
              { text: "Link", onPress: (pw: string) => resolve(pw && pw.length > 0 ? pw : null) },
            ],
            "secure-text",
          );
          return;
        }
        resolve(null);
      });
    };

    const doLinkExisting = async () => {
      const pw = await promptPasswordToLink();
      if (!pw) return;
      setLoading(true);
      try {
        await linkGoogleToEmailAccount(profile.email!, pw, profile.sub, displayName);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)");
      } catch (err: any) {
        Alert.alert("Couldn't Link Google", err?.message ?? "Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const doRegister = async () => {
      setLoading(true);
      try {
        await register("google", { displayName, email: profile.email, googleToken: profile.sub });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)");
      } catch (err: any) {
        const msg = String(err?.message ?? "");
        // Email already exists for an email/password account → offer to link Google to it.
        if (profile.email && /already exists|already linked/i.test(msg)) {
          setLoading(false);
          const exists = await checkEmailExists(profile.email).catch(() => true);
          if (exists) {
            Alert.alert(
              "Account Already Exists",
              `An account for ${profile.email} already exists. Link Google to it?`,
              [
                { text: "Cancel", style: "cancel" },
                { text: "Link Google", onPress: () => { void doLinkExisting(); } },
              ],
            );
            return;
          }
        }
        Alert.alert("Google Sign-Up Failed", msg || "Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const doLogin = async () => {
      setLoading(true);
      try {
        await login("google", { googleToken: profile.sub });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)");
      } catch (err: any) {
        if (err instanceof TwoFactorRequiredError) {
          startTwoFactorChallenge("google", { googleToken: profile.sub });
          return;
        }
        // No account linked → prompt to create one.
        Alert.alert(
          "No Account Found",
          `There is no Universe X account linked to ${profile.email || "this Google account"}. Would you like to create one now?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Create Account", onPress: () => { setIsLogin(false); void doRegister(); } },
          ],
        );
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    (async () => {
      // Probe whether an account already exists for this Google identity.
      try {
        await login("google", { googleToken: profile.sub });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)");
        return;
      } catch (err: any) {
        if (err instanceof TwoFactorRequiredError) {
          startTwoFactorChallenge("google", { googleToken: profile.sub });
          return;
        }
        const accountMissing = /No account/i.test(err?.message ?? "");
        setLoading(false);
        if (intent === "register") {
          if (!accountMissing) {
            // Account already exists — don't silently log them in from the register tab.
            Alert.alert(
              "Account Already Exists",
              `A Universe X account is already linked to ${profile.email || "this Google account"}. Sign in instead?`,
              [
                { text: "Cancel", style: "cancel" },
                { text: "Sign In", onPress: () => { setIsLogin(true); void doLogin(); } },
              ],
            );
            return;
          }
          // No account yet, register flow → just create it.
          void doRegister();
        } else {
          // Login intent + no account → confirm before creating.
          if (accountMissing) {
            Alert.alert(
              "No Account Found",
              `There is no Universe X account linked to ${profile.email || "this Google account"}. Would you like to create one now?`,
              [
                { text: "Cancel", style: "cancel" },
                { text: "Create Account", onPress: () => { setIsLogin(false); void doRegister(); } },
              ],
            );
          } else {
            Alert.alert("Google Sign-In Failed", err?.message ?? "Please try again.");
          }
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoggedIn) return null;

  const switchTab = (toLogin: boolean) => {
    setIsLogin(toLogin);
    Animated.spring(slideAnim, { toValue: toLogin ? 0 : 1, useNativeDriver: false, tension: 200, friction: 20 }).start();
    Haptics.selectionAsync();
  };

  const startTwoFactorChallenge = (method: AuthMethod, data: LoginData) => {
    setPendingLogin({ method, data });
    setTwoFactorCode("");
    setTwoFactorError("");
    setStep("twofa");
  };

  const handleEmailAuth = async () => {
    if (!email.trim()) { Alert.alert("Required", "Please enter your email address."); return; }
    if (!password) { Alert.alert("Required", "Please enter your password."); return; }

    setLoading(true);
    try {
      await login("email", { email: email.trim(), password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: any) {
      if (err instanceof TwoFactorRequiredError) {
        startTwoFactorChallenge("email", { email: email.trim(), password });
        return;
      }
      Alert.alert("Authentication Failed", err?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      Alert.alert("Google Sign-In Unavailable", "Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.");
      return;
    }
    if (Platform.OS !== "web") {
      Alert.alert("Coming Soon", "Google Sign-In on native is not enabled in this build. Use the web version for now.");
      return;
    }
    try {
      // Persist whether this came from the Login or Register tab so the OAuth
      // callback (after a full-page redirect) can surface the right confirmation.
      try { window.localStorage.setItem("cryptox_google_intent", isLogin ? "login" : "register"); } catch {}
      const returnUrl = `${window.location.origin}/auth`;
      const url = `${API_BASE}/api/auth/google/start?return=${encodeURIComponent(returnUrl)}`;
      window.location.assign(url);
    } catch (err: any) {
      Alert.alert("Google Sign-In Failed", err?.message ?? "Please try again.");
    }
  };

  const handleApple = async () => {
    setLoading(true);
    try {
      const id = await getOrCreateSimIdentity(APPLE_IDENTITY_KEY, "apple");
      try {
        await login("apple", { appleToken: id.token });
      } catch (err: any) {
        if (err instanceof TwoFactorRequiredError) {
          startTwoFactorChallenge("apple", { appleToken: id.token });
          return;
        }
        await register("apple", { displayName: id.displayName, email: id.email, appleToken: id.token });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Apple Auth Failed", err?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async () => {
    if (!pendingLogin) { setStep("main"); return; }
    const cleaned = twoFactorCode.trim();
    if (cleaned.length < 6) { setTwoFactorError("Enter the 6-digit code or a backup code."); return; }
    setLoading(true);
    setTwoFactorError("");
    try {
      await completeLoginWithTwoFactor(pendingLogin.method, pendingLogin.data, cleaned);
      setPendingLogin(null);
      setTwoFactorCode("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: any) {
      setTwoFactorError(err?.message ?? "Invalid code.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const cancelTwoFactor = () => {
    setPendingLogin(null);
    setTwoFactorCode("");
    setTwoFactorError("");
    setStep("main");
  };

  const handlePhoneSend = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) { Alert.alert("Invalid Number", "Please enter a valid phone number."); return; }
    Alert.alert("Code Sent", `A verification code has been sent to ${phone}.\n\n🔑 Demo code: ${DEMO_OTP}`, [{ text: "OK", onPress: () => setStep("phone_otp") }]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleOtpVerify = async () => {
    if (otp.length < 6) { Alert.alert("Invalid Code", "Please enter the 6-digit code."); return; }
    if (otp !== DEMO_OTP) { Alert.alert("Wrong Code", "The code you entered is incorrect. Try: " + DEMO_OTP); return; }
    setLoading(true);
    try {
      if (isLogin) {
        try { await login("phone", { phone }); }
        catch { await register("phone", { phone, displayName: `User_${phone.slice(-4)}` }); }
      } else {
        await register("phone", { phone, displayName: `User_${phone.slice(-4)}` });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Verification Failed", err?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = () => {
    if (!forgotEmail.trim()) { Alert.alert("Required", "Please enter your email."); return; }
    Alert.alert("Reset Link Sent", `A password reset link has been sent to ${forgotEmail}.\n\n(Demo — no actual email sent)`, [{ text: "Back to Sign In", onPress: () => setStep("main") }]);
  };

  const primary = colors.primary;
  const topPad = Platform.OS === "web" ? 20 : insets.top + 8;
  const botPad = insets.bottom + 24;

  if (step === "twofa") {
    return (
      <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingTop: topPad, paddingHorizontal: 24, paddingBottom: botPad, flex: 1 }}>
          <TouchableOpacity onPress={cancelTwoFactor} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.stepIcon}>
            <View style={[styles.bigIconCircle, { backgroundColor: "#628EEA15" }]}>
              <Feather name="shield" size={36} color="#628EEA" />
            </View>
          </View>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Two-Factor Authentication</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            Open your authenticator app and enter the 6-digit code for Universe X, or use a backup code.
          </Text>
          <View style={[styles.otpContainer, { backgroundColor: colors.secondary, borderColor: twoFactorError ? "#F6465D" : colors.border, marginTop: 24 }]}>
            <TextInput
              style={[styles.otpInput, { color: colors.foreground, letterSpacing: 4 }]}
              value={twoFactorCode}
              onChangeText={(t) => { setTwoFactorCode(t.replace(/[^0-9a-zA-Z-]/g, "").slice(0, 12)); setTwoFactorError(""); }}
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={12}
              placeholder="000000"
              placeholderTextColor={colors.mutedForeground}
              textAlign="center"
              autoFocus
            />
          </View>
          {twoFactorError ? (
            <Text style={{ color: "#F6465D", textAlign: "center", fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 10 }}>{twoFactorError}</Text>
          ) : null}
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: primary, marginTop: 24, opacity: loading ? 0.6 : 1 }]} onPress={handleTwoFactorSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Verify & Sign In</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: "center", marginTop: 18 }} onPress={cancelTwoFactor}>
            <Text style={[styles.linkText, { color: primary }]}>Use a different account</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (step === "phone_entry") {
    return (
      <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingTop: topPad, paddingHorizontal: 24, paddingBottom: botPad, flex: 1 }}>
          <TouchableOpacity onPress={() => setStep("main")} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.stepIcon}>
            <View style={[styles.bigIconCircle, { backgroundColor: primary + "15" }]}>
              <Feather name="smartphone" size={36} color={primary} />
            </View>
          </View>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Phone Number</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            We'll send a 6-digit verification code to your number.
          </Text>
          <View style={{ marginTop: 28, gap: 14 }}>
            <InputField icon="phone" placeholder="+1 (555) 000-0000" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" autoFocus />
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: primary }]} onPress={handlePhoneSend} activeOpacity={0.85}>
              <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Send Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (step === "phone_otp") {
    return (
      <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingTop: topPad, paddingHorizontal: 24, paddingBottom: botPad, flex: 1 }}>
          <TouchableOpacity onPress={() => setStep("phone_entry")} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.stepIcon}>
            <View style={[styles.bigIconCircle, { backgroundColor: "#00C087" + "15" }]}>
              <Feather name="message-square" size={36} color="#00C087" />
            </View>
          </View>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Enter Code</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            Enter the 6-digit code sent to{"\n"}<Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>{phone}</Text>
          </Text>
          <View style={[styles.otpContainer, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <TextInput
              style={[styles.otpInput, { color: colors.foreground }]}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="• • • • • •"
              placeholderTextColor={colors.mutedForeground}
              textAlign="center"
              autoFocus
            />
          </View>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: primary, marginTop: 24 }]} onPress={handleOtpVerify} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Verify & Continue</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: "center", marginTop: 18 }} onPress={() => { Alert.alert("Code Resent", `Demo OTP: ${DEMO_OTP}`); }}>
            <Text style={[styles.linkText, { color: primary }]}>Resend code</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (step === "forgot") {
    return (
      <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingTop: topPad, paddingHorizontal: 24, paddingBottom: botPad, flex: 1 }}>
          <TouchableOpacity onPress={() => setStep("main")} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.stepIcon}>
            <View style={[styles.bigIconCircle, { backgroundColor: "#628EEA" + "15" }]}>
              <Feather name="lock" size={36} color="#628EEA" />
            </View>
          </View>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Reset Password</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            Enter the email address associated with your account and we'll send a reset link.
          </Text>
          <View style={{ marginTop: 28, gap: 14 }}>
            <InputField icon="mail" placeholder="Email address" value={forgotEmail} onChangeText={setForgotEmail} keyboardType="email-address" autoCapitalize="none" autoFocus />
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: primary }]} onPress={handleForgotSubmit} activeOpacity={0.85}>
              <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Send Reset Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  const tabX = slideAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "50%"] });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{ paddingBottom: botPad + 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={20}
        extraKeyboardSpace={20}
        style={{ flex: 1 }}
      >
        {/* Branded gradient hero */}
        <LinearGradient
          colors={[primary + "26", primary + "08", "transparent"]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: topPad + 14 }]}
        >
          <View style={styles.brandRow}>
            <View style={[styles.brandLogo, { backgroundColor: primary }]}>
              <Text style={styles.brandLogoText}>UX</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.brandName, { color: colors.foreground }]}>Universe X</Text>
              <Text style={[styles.brandTagline, { color: colors.mutedForeground }]}>Professional Exchange</Text>
            </View>
            <View style={[styles.verifiedBadge, { borderColor: primary + "55", backgroundColor: primary + "1A" }]}>
              <Feather name="shield" size={11} color={primary} />
              <Text style={[styles.verifiedText, { color: primary }]}>Verified</Text>
            </View>
          </View>

          <Text style={[styles.pageTitle, { color: colors.foreground }]}>
            {isLogin ? "Welcome back" : "Create your account"}
          </Text>
          <Text style={[styles.pageSub, { color: colors.mutedForeground }]}>
            {isLogin
              ? "Sign in securely to access your portfolio, markets, and trading tools."
              : "Join millions of traders. Trade 500+ assets with institutional-grade security."}
          </Text>

        </LinearGradient>

        <View style={{ paddingHorizontal: 24, marginTop: 4 }}>
          <View style={[styles.tabContainer, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Animated.View style={[styles.tabIndicator, { backgroundColor: colors.card, left: tabX, borderColor: colors.border }]} />
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab(true)} activeOpacity={0.8}>
              <Text style={[styles.tabText, { color: isLogin ? colors.foreground : colors.mutedForeground }]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab(false)} activeOpacity={0.8}>
              <Text style={[styles.tabText, { color: !isLogin ? colors.foreground : colors.mutedForeground }]}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24 }}>

        {isLogin ? (
          <View style={{ gap: 14, marginTop: 8 }}>
            <View style={{ gap: 6 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Email Address</Text>
              <InputField icon="mail" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Password</Text>
              <InputField
                icon="lock"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                rightElement={
                  <TouchableOpacity onPress={() => setShowPw(!showPw)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name={showPw ? "eye-off" : "eye"} size={17} color={colors.mutedForeground} />
                  </TouchableOpacity>
                }
              />
            </View>

            <TouchableOpacity onPress={() => setStep("forgot")} style={{ alignSelf: "flex-end" }}>
              <Text style={[styles.linkText, { color: primary }]}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: primary, marginTop: 4 }]} onPress={handleEmailAuth} disabled={loading} activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {!isLogin && (
          <View style={{ gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              style={[styles.socialBtn, { backgroundColor: primary, borderColor: primary }]}
              onPress={() => router.push("/register")}
              activeOpacity={0.85}
            >
              <View style={[styles.socialIconBox, { backgroundColor: "rgba(0,0,0,0.2)" }]}>
                <Feather name="mail" size={16} color={colors.primaryForeground} />
              </View>
              <Text style={[styles.socialBtnText, { color: colors.primaryForeground }]}>Continue with Email</Text>
              <Feather name="arrow-right" size={16} color={colors.primaryForeground} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.socialBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handleGoogle} activeOpacity={0.85}>
              <GoogleGlyph />
              <Text style={[styles.socialBtnText, { color: colors.foreground }]}>Continue with Google</Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.socialBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setStep("phone_entry")} activeOpacity={0.85}>
              <View style={[styles.socialIconBox, { backgroundColor: primary + "15" }]}>
                <Feather name="phone" size={16} color={primary} />
              </View>
              <Text style={[styles.socialBtnText, { color: colors.foreground }]}>Continue with Phone</Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

        {isLogin && (
          <>
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.mutedForeground }]}>or continue with</Text>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            </View>

            <View style={{ gap: 10 }}>
              <TouchableOpacity style={[styles.socialBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handleGoogle} activeOpacity={0.85}>
                <GoogleGlyph />
                <Text style={[styles.socialBtnText, { color: colors.foreground }]}>Continue with Google</Text>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>

              {Platform.OS === "ios" && (
                <TouchableOpacity style={[styles.socialBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handleApple} activeOpacity={0.85}>
                  <View style={[styles.socialIconBox, { backgroundColor: colors.foreground }]}>
                    <FontAwesome name="apple" size={16} color={colors.background} />
                  </View>
                  <Text style={[styles.socialBtnText, { color: colors.foreground }]}>Continue with Apple</Text>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[styles.socialBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setStep("phone_entry")} activeOpacity={0.85}>
                <View style={[styles.socialIconBox, { backgroundColor: primary + "15" }]}>
                  <Feather name="phone" size={16} color={primary} />
                </View>
                <Text style={[styles.socialBtnText, { color: colors.foreground }]}>Continue with Phone</Text>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={[styles.secureFooter, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
          <Feather name="shield" size={13} color="#00C087" />
          <Text style={[styles.secureFooterText, { color: colors.mutedForeground }]}>
            Protected by 256-bit encryption · 2FA available
          </Text>
        </View>

        <Text style={[styles.termsText, { color: colors.mutedForeground }]}>
          By {isLogin ? "signing in" : "registering"} you agree to our{" "}
          <Text style={{ color: primary, fontFamily: "Inter_600SemiBold" }} onPress={() => router.push("/terms")}>Terms of Service</Text>
          {" "}and{" "}
          <Text style={{ color: primary, fontFamily: "Inter_600SemiBold" }} onPress={() => router.push("/terms")}>Privacy Policy</Text>.
        </Text>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  hero: { paddingHorizontal: 24, paddingBottom: 24 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 },
  brandLogo: {
    width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center",
    shadowColor: "#F0B90B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  brandLogoText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0B0E11", letterSpacing: 0.5 },
  brandName: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  brandTagline: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  verifiedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
  },
  verifiedText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5, textTransform: "uppercase" },
  pageTitle: { fontSize: 30, fontFamily: "Inter_700Bold", marginBottom: 8, letterSpacing: -0.5, lineHeight: 36 },
  pageSub: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 18, lineHeight: 21 },
  tabContainer: {
    flexDirection: "row", borderRadius: 14, padding: 4, position: "relative",
    marginTop: 8, marginBottom: 22, borderWidth: StyleSheet.hairlineWidth,
  },
  tabIndicator: {
    position: "absolute", top: 4, bottom: 4, width: "50%", borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
  },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center", zIndex: 1 },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginLeft: 4, letterSpacing: 0.3, textTransform: "uppercase" },
  inputWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, borderRadius: 13 },
  inputText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  primaryBtn: {
    height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center",
    shadowColor: "#F0B90B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  linkText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 24 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  orText: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.5, textTransform: "uppercase" },
  socialBtn: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  googleGlyph: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 1,
  },
  googleGlyphLetter: { fontSize: 17, fontFamily: "Inter_700Bold" },
  socialIconBox: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  socialBtnText: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  secureFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 22, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  secureFooterText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  termsText: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 14, lineHeight: 18 },
  stepIcon: { alignItems: "center", marginTop: 24, marginBottom: 24 },
  bigIconCircle: { width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  stepTitle: { fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 8 },
  stepSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21, marginBottom: 4 },
  otpContainer: { marginTop: 28, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", paddingVertical: 8 },
  otpInput: { fontSize: 36, fontFamily: "Inter_700Bold", letterSpacing: 16, paddingVertical: 12, textAlign: "center", width: "100%" },
});
