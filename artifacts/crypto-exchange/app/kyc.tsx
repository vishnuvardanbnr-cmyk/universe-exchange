import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`;

type KycStatus = "pending" | "under_review" | "approved" | "rejected";
interface KycSubmission {
  id: number; level: number; status: KycStatus;
  first_name?: string; last_name?: string; date_of_birth?: string;
  nationality?: string; country?: string; document_type?: string;
  rejection_reason?: string; created_at: string; updated_at: string;
}
interface KycState { level1: KycSubmission | null; level2: KycSubmission | null; verifiedLevel: number; }

const STATUS_COLOR: Record<KycStatus, string> = {
  pending: "#F0B90B", under_review: "#628EEA", approved: "#0ECB81", rejected: "#F6465D",
};
const STATUS_LABEL: Record<KycStatus, string> = {
  pending: "Pending", under_review: "Under Review", approved: "Verified", rejected: "Rejected",
};
const DOC_TYPES = [
  { id: "national_id", label: "National ID Card", icon: "credit-card", hasBack: true },
  { id: "passport", label: "Passport", icon: "book", hasBack: false },
  { id: "drivers_license", label: "Driver's License", icon: "truck", hasBack: true },
];
const COUNTRIES = [
  "India","United States","United Kingdom","Canada","Australia","Germany","France","Japan","China",
  "Singapore","UAE","Saudi Arabia","Brazil","Mexico","South Korea","Indonesia","Thailand","Malaysia",
  "Philippines","Bangladesh","Pakistan","Nigeria","South Africa","Kenya","Egypt","Turkey","Russia","Other",
];
const NATIONALITIES = [
  "Indian","American","British","Canadian","Australian","German","French","Japanese","Chinese",
  "Singaporean","Emirati","Saudi","Brazilian","Mexican","Korean","Indonesian","Thai","Malaysian",
  "Filipino","Bangladeshi","Pakistani","Nigerian","South African","Kenyan","Egyptian","Turkish","Russian","Other",
];

function StatusBadge({ status, small }: { status: KycStatus; small?: boolean }) {
  const c = STATUS_COLOR[status];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c + "18", paddingHorizontal: small ? 6 : 8, paddingVertical: small ? 2 : 4, borderRadius: 6 }}>
      <Feather name={status === "approved" ? "check-circle" : status === "rejected" ? "x-circle" : "clock"} size={small ? 10 : 12} color={c} />
      <Text style={{ fontSize: small ? 10 : 11, fontFamily: "Inter_600SemiBold", color: c }}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

function ImageUploadBox({ label, imageUri, onPick, disabled }: { label: string; imageUri?: string; onPick: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPick}
      activeOpacity={disabled ? 1 : 0.8}
      style={{
        flex: 1, borderRadius: 12, borderWidth: 1.5, borderStyle: imageUri ? "solid" : "dashed",
        borderColor: imageUri ? "#0ECB81" : colors.border, backgroundColor: colors.card,
        alignItems: "center", justifyContent: "center", minHeight: 130, overflow: "hidden",
      }}
    >
      {imageUri ? (
        <>
          <Image source={{ uri: imageUri }} style={{ width: "100%", height: 130 }} resizeMode="cover" />
          <View style={{ position: "absolute", bottom: 6, right: 6, backgroundColor: "#0ECB81", borderRadius: 12, padding: 4 }}>
            <Feather name="check" size={12} color="#fff" />
          </View>
        </>
      ) : (
        <View style={{ alignItems: "center", gap: 8, padding: 16 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center" }}>
            <Feather name="camera" size={18} color={colors.primary} />
          </View>
          <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center" }}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function KycScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [kycState, setKycState] = useState<KycState | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"status" | "l1" | "l2">("status");
  const topPad = Platform.OS === "web" ? 20 : insets.top + 8;

  const fetchKyc = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/kyc/status`, { headers: { "x-user-id": user.id } });
      const data = await res.json();
      setKycState(data);
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchKyc(); }, [fetchKyc]);

  if (!user) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Identity Verification</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Feather name="lock" size={40} color={colors.mutedForeground} />
          <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Sign in required</Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Please sign in to start verification</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Identity Verification</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={view !== "status" ? () => setView("status") : () => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {view === "l1" ? "Basic Verification" : view === "l2" ? "Advanced Verification" : "Identity Verification"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {view === "status" && (
        <StatusView
          kycState={kycState!}
          colors={colors}
          onStartL1={() => setView("l1")}
          onStartL2={() => setView("l2")}
        />
      )}
      {view === "l1" && (
        <Level1Wizard
          userId={user.id}
          existing={kycState?.level1}
          colors={colors}
          onSuccess={() => { fetchKyc(); setView("status"); }}
        />
      )}
      {view === "l2" && (
        <Level2Wizard
          userId={user.id}
          existing={kycState?.level2}
          colors={colors}
          onSuccess={() => { fetchKyc(); setView("status"); }}
        />
      )}
    </View>
  );
}

function StatusView({ kycState, colors, onStartL1, onStartL2 }: { kycState: KycState; colors: any; onStartL1: () => void; onStartL2: () => void }) {
  const l1 = kycState.level1;
  const l2 = kycState.level2;
  const vl = kycState.verifiedLevel;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      {/* Verified banner */}
      <View style={{ borderRadius: 16, padding: 20, backgroundColor: vl >= 2 ? "#0ECB8115" : vl === 1 ? "#F0B90B15" : colors.card, borderWidth: 1, borderColor: vl >= 2 ? "#0ECB8130" : vl === 1 ? "#F0B90B30" : colors.border, alignItems: "center", gap: 8 }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: (vl >= 2 ? "#0ECB81" : vl === 1 ? "#F0B90B" : colors.mutedForeground) + "20", alignItems: "center", justifyContent: "center" }}>
          <Feather name={vl >= 2 ? "shield" : vl === 1 ? "user-check" : "user"} size={26} color={vl >= 2 ? "#0ECB81" : vl === 1 ? "#F0B90B" : colors.mutedForeground} />
        </View>
        <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground }}>
          {vl >= 2 ? "Fully Verified" : vl === 1 ? "Basic Verified" : "Not Verified"}
        </Text>
        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" }}>
          {vl >= 2 ? "You have full access to all Universe X features and limits."
           : vl === 1 ? "Complete Advanced Verification to unlock higher limits."
           : "Complete verification to unlock trading features."}
        </Text>
      </View>

      {/* Level 1 Card */}
      <LevelCard
        level={1}
        title="Basic Verification"
        desc="Verify your personal information"
        features={["Crypto purchases up to ₹2L/day", "P2P trading enabled", "Withdrawal up to ₹1L/day"]}
        submission={l1}
        colors={colors}
        canStart={!l1 || l1.status === "rejected"}
        onStart={onStartL1}
      />

      {/* Level 2 Card */}
      <LevelCard
        level={2}
        title="Advanced Verification"
        desc="Verify your identity with a government ID"
        features={["Unlimited crypto purchases", "Higher withdrawal limits", "Full P2P access", "Priority support"]}
        submission={l2}
        colors={colors}
        locked={!l1 || l1.status !== "approved"}
        lockedMsg={!l1 ? "Complete Basic Verification first" : l1.status === "pending" ? "Awaiting Basic Verification approval" : "Basic Verification must be approved"}
        canStart={!!l1 && l1.status === "approved" && (!l2 || l2.status === "rejected")}
        onStart={onStartL2}
      />

      {/* Info card */}
      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 10 }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.5 }}>WHY VERIFY?</Text>
        {[
          { icon: "shield", text: "Protect your account and funds" },
          { icon: "trending-up", text: "Higher trading and withdrawal limits" },
          { icon: "check-circle", text: "Comply with financial regulations" },
          { icon: "lock", text: "Your data is encrypted and secure" },
        ].map((item) => (
          <View key={item.text} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Feather name={item.icon as any} size={14} color={colors.primary} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 }}>{item.text}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function LevelCard({ level, title, desc, features, submission, colors, locked, lockedMsg, canStart, onStart }: any) {
  const approved = submission?.status === "approved";
  const pending = submission?.status === "pending" || submission?.status === "under_review";
  const rejected = submission?.status === "rejected";

  return (
    <View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: approved ? "#0ECB8130" : pending ? "#628EEA30" : rejected ? "#F6465D30" : colors.border, backgroundColor: colors.card, overflow: "hidden" }}>
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: approved ? "#0ECB8120" : pending ? "#628EEA20" : rejected ? "#F6465D20" : colors.primary + "15", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: approved ? "#0ECB81" : pending ? "#628EEA" : rejected ? "#F6465D" : colors.primary }}>L{level}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>{title}</Text>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{desc}</Text>
            </View>
          </View>
          {submission && <StatusBadge status={submission.status} small />}
        </View>

        <View style={{ gap: 6 }}>
          {features.map((f: string) => (
            <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="check" size={12} color={approved ? "#0ECB81" : colors.primary} />
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{f}</Text>
            </View>
          ))}
        </View>

        {rejected && submission?.rejection_reason && (
          <View style={{ borderRadius: 8, backgroundColor: "#F6465D10", padding: 10, flexDirection: "row", gap: 8 }}>
            <Feather name="alert-circle" size={13} color="#F6465D" style={{ marginTop: 1 }} />
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#F6465D", flex: 1 }}>Rejected: {submission.rejection_reason}</Text>
          </View>
        )}

        {pending && (
          <View style={{ borderRadius: 8, backgroundColor: "#628EEA10", padding: 10, flexDirection: "row", gap: 8 }}>
            <Feather name="clock" size={13} color="#628EEA" style={{ marginTop: 1 }} />
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#628EEA", flex: 1 }}>Your submission is under review. Usually takes 1-3 business days.</Text>
          </View>
        )}

        {locked && !submission && (
          <View style={{ borderRadius: 8, backgroundColor: colors.secondary, padding: 10, flexDirection: "row", gap: 8 }}>
            <Feather name="lock" size={13} color={colors.mutedForeground} style={{ marginTop: 1 }} />
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 }}>{lockedMsg}</Text>
          </View>
        )}

        {canStart && (
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); onStart(); }}
            style={{ borderRadius: 10, paddingVertical: 12, alignItems: "center", backgroundColor: rejected ? "#F6465D15" : colors.primary }}
            activeOpacity={0.85}
          >
            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: rejected ? "#F6465D" : colors.primaryForeground }}>
              {rejected ? "Resubmit Verification" : "Start Verification"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Level1Wizard({ userId, existing, colors, onSuccess }: { userId: string; existing: KycSubmission | null; colors: any; onSuccess: () => void }) {
  const [firstName, setFirstName] = useState(existing?.first_name ?? "");
  const [lastName, setLastName] = useState(existing?.last_name ?? "");
  const [dob, setDob] = useState(existing?.date_of_birth ?? "");
  const [nationality, setNationality] = useState(existing?.nationality ?? "");
  const [country, setCountry] = useState(existing?.country ?? "");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [natOpen, setNatOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);

  const formatDob = (v: string) => {
    const digits = v.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return digits.slice(0, 2) + "/" + digits.slice(2);
    return digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4, 8);
  };

  const canSubmit = firstName.trim() && lastName.trim() && dob.length === 10 && nationality && country;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    Haptics.selectionAsync();
    try {
      const res = await fetch(`${API_BASE}/api/kyc/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, level: 1, firstName: firstName.trim(), lastName: lastName.trim(), dateOfBirth: dob, nationality, country, address: address.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Submission failed. Try again.");
    }
    setSubmitting(false);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
      <InfoBox colors={colors} text="Enter your legal name exactly as it appears on your government-issued ID." />

      <View style={{ gap: 10 }}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PERSONAL INFORMATION</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Field label="First Name" value={firstName} onChange={setFirstName} placeholder="As on ID" flex={1} colors={colors} />
          <Field label="Last Name" value={lastName} onChange={setLastName} placeholder="As on ID" flex={1} colors={colors} />
        </View>
        <Field label="Date of Birth" value={dob} onChange={(v) => setDob(formatDob(v))} placeholder="DD/MM/YYYY" keyboardType="numeric" colors={colors} maxLength={10} />
      </View>

      <View style={{ gap: 10 }}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ADDRESS</Text>
        <DropdownField label="Nationality" value={nationality} options={NATIONALITIES} open={natOpen} onOpen={() => { setNatOpen(true); setCountryOpen(false); }} onSelect={(v) => { setNationality(v); setNatOpen(false); }} colors={colors} />
        <DropdownField label="Country of Residence" value={country} options={COUNTRIES} open={countryOpen} onOpen={() => { setCountryOpen(true); setNatOpen(false); }} onSelect={(v) => { setCountry(v); setCountryOpen(false); }} colors={colors} />
        <Field label="Residential Address (optional)" value={address} onChange={setAddress} placeholder="Street, City, Postal Code" multiline colors={colors} />
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!canSubmit || submitting}
        style={[styles.submitBtn, { backgroundColor: canSubmit ? colors.primary : colors.secondary, opacity: submitting ? 0.7 : 1 }]}
        activeOpacity={0.85}
      >
        {submitting ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : (
          <Text style={[styles.submitBtnText, { color: canSubmit ? colors.primaryForeground : colors.mutedForeground }]}>Submit for Review</Text>
        )}
      </TouchableOpacity>

      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", lineHeight: 16 }}>
        By submitting, you confirm this information is accurate and consent to identity verification in accordance with our Privacy Policy.
      </Text>
    </ScrollView>
  );
}

function Level2Wizard({ userId, existing, colors, onSuccess }: { userId: string; existing: KycSubmission | null; colors: any; onSuccess: () => void }) {
  const [step, setStep] = useState<"doctype" | "upload" | "selfie" | "review">("doctype");
  const [docType, setDocType] = useState<string>("");
  const [frontUri, setFrontUri] = useState<string>("");
  const [frontB64, setFrontB64] = useState<string>("");
  const [backUri, setBackUri] = useState<string>("");
  const [backB64, setBackB64] = useState<string>("");
  const [selfieUri, setSelfieUri] = useState<string>("");
  const [selfieB64, setSelfieB64] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const selectedDoc = DOC_TYPES.find((d) => d.id === docType);

  const pickImage = async (onDone: (uri: string, b64: string) => void) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        onDone(asset.uri, `data:image/jpeg;base64,${asset.base64}`);
        Haptics.selectionAsync();
      }
    } catch {
      Alert.alert("Error", "Could not open image picker.");
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    Haptics.selectionAsync();
    try {
      const res = await fetch(`${API_BASE}/api/kyc/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId, level: 2,
          documentType: docType,
          documentFront: frontB64,
          documentBack: selectedDoc?.hasBack ? backB64 : null,
          selfie: selfieB64,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Submission failed. Try again.");
    }
    setSubmitting(false);
  };

  if (step === "doctype") {
    return (
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <InfoBox colors={colors} text="Select a government-issued ID. Make sure it is valid and not expired." />
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SELECT DOCUMENT TYPE</Text>
        <View style={{ gap: 10 }}>
          {DOC_TYPES.map((doc) => (
            <TouchableOpacity
              key={doc.id}
              onPress={() => { setDocType(doc.id); Haptics.selectionAsync(); }}
              activeOpacity={0.8}
              style={{
                borderRadius: 14, borderWidth: 1.5, borderColor: docType === doc.id ? colors.primary : colors.border,
                backgroundColor: docType === doc.id ? colors.primary + "0D" : colors.card,
                padding: 16, flexDirection: "row", alignItems: "center", gap: 14,
              }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: docType === doc.id ? colors.primary + "20" : colors.secondary, alignItems: "center", justifyContent: "center" }}>
                <Feather name={doc.icon as any} size={20} color={docType === doc.id ? colors.primary : colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: docType === doc.id ? colors.primary : colors.foreground }}>{doc.label}</Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                  {doc.hasBack ? "Front & back required" : "Photo page required"}
                </Text>
              </View>
              {docType === doc.id && <Feather name="check-circle" size={18} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          onPress={() => { if (docType) setStep("upload"); }}
          disabled={!docType}
          style={[styles.submitBtn, { backgroundColor: docType ? colors.primary : colors.secondary }]}
          activeOpacity={0.85}
        >
          <Text style={[styles.submitBtnText, { color: docType ? colors.primaryForeground : colors.mutedForeground }]}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (step === "upload") {
    const needBack = selectedDoc?.hasBack ?? false;
    const canContinue = frontUri && (!needBack || backUri);
    return (
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <InfoBox colors={colors} text={`Upload clear photos of your ${selectedDoc?.label}. Make sure all text is readable and corners are visible.`} />
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DOCUMENT PHOTOS</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <ImageUploadBox label={needBack ? "Front side" : "Photo page"} imageUri={frontUri} onPick={() => pickImage((uri, b64) => { setFrontUri(uri); setFrontB64(b64); })} />
          {needBack && <ImageUploadBox label="Back side" imageUri={backUri} onPick={() => pickImage((uri, b64) => { setBackUri(uri); setBackB64(b64); })} />}
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity onPress={() => setStep("doctype")} style={[styles.outlineBtn, { borderColor: colors.border }]}>
            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { if (canContinue) setStep("selfie"); }} disabled={!canContinue} style={[styles.submitBtn, { flex: 1, backgroundColor: canContinue ? colors.primary : colors.secondary }]} activeOpacity={0.85}>
            <Text style={[styles.submitBtnText, { color: canContinue ? colors.primaryForeground : colors.mutedForeground }]}>Continue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (step === "selfie") {
    return (
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <InfoBox colors={colors} text="Take or upload a selfie photo. Make sure your face is clearly visible, well-lit, and matches your ID." />
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SELFIE PHOTO</Text>
        <View style={{ alignItems: "center" }}>
          <View style={{ width: "80%", maxWidth: 280 }}>
            <ImageUploadBox label={"Tap to take or upload a selfie"} imageUri={selfieUri} onPick={() => pickImage((uri, b64) => { setSelfieUri(uri); setSelfieB64(b64); })} />
          </View>
        </View>
        {selfieUri && (
          <View style={{ borderRadius: 10, backgroundColor: "#0ECB8110", padding: 12, flexDirection: "row", gap: 8 }}>
            <Feather name="check-circle" size={14} color="#0ECB81" style={{ marginTop: 1 }} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#0ECB81", flex: 1 }}>Selfie uploaded. Make sure your face is clearly visible.</Text>
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity onPress={() => setStep("upload")} style={[styles.outlineBtn, { borderColor: colors.border }]}>
            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { if (selfieUri) setStep("review"); }} disabled={!selfieUri} style={[styles.submitBtn, { flex: 1, backgroundColor: selfieUri ? colors.primary : colors.secondary }]} activeOpacity={0.85}>
            <Text style={[styles.submitBtnText, { color: selfieUri ? colors.primaryForeground : colors.mutedForeground }]}>Continue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (step === "review") {
    return (
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 16, gap: 12 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>Review Submission</Text>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Feather name="file-text" size={13} color={colors.mutedForeground} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Document: {selectedDoc?.label}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {frontUri && <Image source={{ uri: frontUri }} style={{ flex: 1, height: 90, borderRadius: 8 }} resizeMode="cover" />}
            {backUri && <Image source={{ uri: backUri }} style={{ flex: 1, height: 90, borderRadius: 8 }} resizeMode="cover" />}
          </View>
          {selfieUri && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Image source={{ uri: selfieUri }} style={{ width: 60, height: 60, borderRadius: 30 }} resizeMode="cover" />
              <View>
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Selfie</Text>
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Ready to submit</Text>
              </View>
            </View>
          )}
        </View>

        <InfoBox colors={colors} text="By submitting, you confirm all documents are genuine and belong to you." icon="shield" />

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity onPress={() => setStep("selfie")} style={[styles.outlineBtn, { borderColor: colors.border }]}>
            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={[styles.submitBtn, { flex: 1, backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]} activeOpacity={0.85}>
            {submitting ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : (
              <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>Submit Verification</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return null;
}

function Field({ label, value, onChange, placeholder, flex, multiline, keyboardType, maxLength, colors }: any) {
  return (
    <View style={[styles.fieldWrap, { flex, backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
      <TextInput
        style={[styles.fieldInput, { color: colors.foreground }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        keyboardType={keyboardType ?? "default"}
        maxLength={maxLength}
        autoCapitalize="words"
        autoCorrect={false}
      />
    </View>
  );
}

function DropdownField({ label, value, options, open, onOpen, onSelect, colors }: any) {
  return (
    <View style={{ gap: 0 }}>
      <TouchableOpacity
        onPress={onOpen}
        style={[styles.fieldWrap, { backgroundColor: colors.card, borderColor: open ? colors.primary : colors.border }]}
        activeOpacity={0.8}
      >
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[styles.fieldInput, { color: value ? colors.foreground : colors.mutedForeground }]}>{value || `Select ${label}`}</Text>
          <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>
      {open && (
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, maxHeight: 200, overflow: "hidden", zIndex: 10 }}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {options.map((opt: string) => (
              <TouchableOpacity key={opt} onPress={() => onSelect(opt)} style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground }}>{opt}</Text>
                {value === opt && <Feather name="check" size={13} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function InfoBox({ colors, text, icon = "info" }: { colors: any; text: string; icon?: string }) {
  return (
    <View style={{ borderRadius: 10, backgroundColor: colors.primary + "10", padding: 12, flexDirection: "row", gap: 10 }}>
      <Feather name={icon as any} size={14} color={colors.primary} style={{ marginTop: 1 }} />
      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1, lineHeight: 17 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  fieldWrap: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10 },
  fieldLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6, marginBottom: 3 },
  fieldInput: { fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 2 },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  submitBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  outlineBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, borderWidth: 1 },
});
