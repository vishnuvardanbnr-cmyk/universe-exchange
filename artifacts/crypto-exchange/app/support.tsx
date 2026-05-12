import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`;
const WS_BASE = `wss://${process.env["EXPO_PUBLIC_DOMAIN"]}`;

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
interface TicketMessage { id: string; ticketId: string; sender: "user" | "support"; senderName: string; body: string; timestamp: number; }
interface Ticket { id: string; userId: string; userName: string; subject: string; status: TicketStatus; priority: string; createdAt: number; updatedAt: number; messages: TicketMessage[]; }

const STATUS_META: Record<TicketStatus, { label: string; color: string; bg: string }> = {
  open: { label: "Open", color: "#F0B90B", bg: "#F0B90B15" },
  in_progress: { label: "In Progress", color: "#628EEA", bg: "#628EEA15" },
  resolved: { label: "Resolved", color: "#0ECB81", bg: "#0ECB8115" },
  closed: { label: "Closed", color: "#848E9C", bg: "#848E9C15" },
};

function formatTime(ts: number): string {
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChatScreen({ ticket, userId, userName, onBack }: { ticket: Ticket; userId: string; userName: string; onBack: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<TicketMessage[]>(ticket.messages);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [input, setInput] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const topPad = Platform.OS === "web" ? 20 : insets.top + 8;

  // WebSocket with auto-reconnect (best-effort, enhances to real-time)
  useEffect(() => {
    let active = true;
    const connect = () => {
      if (!active) return;
      try {
        const socket = new WebSocket(`${WS_BASE}/api/ws/support?ticketId=${ticket.id}&userName=${encodeURIComponent(userName)}`);
        wsRef.current = socket;
        socket.onopen = () => { if (active) setWsConnected(true); };
        socket.onclose = () => {
          wsRef.current = null;
          if (active) { setWsConnected(false); reconnectRef.current = setTimeout(connect, 5000); }
        };
        socket.onerror = () => { socket.close(); };
        socket.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "ticket_state") { setMessages(msg.ticket.messages); setStatus(msg.ticket.status); }
            else if (msg.type === "new_message") { setMessages((p) => { if (p.find((m) => m.id === msg.message.id)) return p; return [...p, msg.message]; }); if (msg.message.sender === "support") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
            else if (msg.type === "status_changed") setStatus(msg.status);
            else if (msg.type === "typing" && msg.sender === "support") { setIsTyping(true); if (typingTimer.current) clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => setIsTyping(false), 3000); }
          } catch {}
        };
      } catch { if (active) reconnectRef.current = setTimeout(connect, 5000); }
    };
    connect();
    return () => { active = false; wsRef.current?.close(); if (reconnectRef.current) clearTimeout(reconnectRef.current); if (typingTimer.current) clearTimeout(typingTimer.current); };
  }, [ticket.id, userName]);

  // REST polling fallback — fetches new messages when WebSocket is not live
  useEffect(() => {
    const poll = async () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      try {
        const res = await fetch(`${API_BASE}/api/support/tickets/${ticket.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.ticket) { setMessages(data.ticket.messages); setStatus(data.ticket.status); }
      } catch {}
    };
    const interval = setInterval(poll, 3500);
    return () => clearInterval(interval);
  }, [ticket.id]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const body = input.trim();
    setInput("");
    setSending(true);
    Haptics.selectionAsync();
    // Optimistic local append
    const tmpId = `tmp-${Date.now()}`;
    const tmpMsg: TicketMessage = { id: tmpId, ticketId: ticket.id, sender: "user", senderName: userName, body, timestamp: Date.now() };
    setMessages((p) => [...p, tmpMsg]);
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Fast path: WebSocket
        wsRef.current.send(JSON.stringify({ type: "send_message", body }));
      } else {
        // Reliable path: REST
        const res = await fetch(`${API_BASE}/api/support/tickets/${ticket.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, userName }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ticket) { setMessages(data.ticket.messages); setStatus(data.ticket.status); }
        }
      }
    } catch {}
    setSending(false);
  };

  const sm = STATUS_META[status];
  const botPad = Platform.OS === "web" ? 16 : insets.bottom + 8;

  const renderMsg = ({ item, index }: { item: TicketMessage; index: number }) => {
    const isUser = item.sender !== "support";
    const prevItem = index > 0 ? messages[index - 1] : null;
    const showAvatar = !prevItem || prevItem.sender !== item.sender;
    return (
      <View style={{ marginBottom: 4 }}>
        {showAvatar && !isUser && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6, marginTop: 8 }}>
            <View style={[styles.supportAvatar, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="headphones" size={12} color={colors.primary} />
            </View>
            <Text style={[styles.senderName, { color: colors.mutedForeground }]}>Universe X Support</Text>
          </View>
        )}
        <View style={{ alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: "78%" }}>
          <View style={[styles.bubble, {
            backgroundColor: isUser ? colors.primary : colors.card,
            borderColor: isUser ? "transparent" : colors.border,
            borderBottomLeftRadius: !isUser && !showAvatar ? 4 : 18,
            borderBottomRightRadius: isUser ? 4 : 18,
          }]}>
            <Text style={[styles.bubbleText, { color: isUser ? colors.primaryForeground : colors.foreground }]}>{item.body}</Text>
          </View>
          <Text style={[styles.msgTime, { color: colors.mutedForeground, alignSelf: isUser ? "flex-end" : "flex-start" }]}>{formatTime(item.timestamp)}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.chatHeader, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.chatBackBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.chatTitle, { color: colors.foreground }]} numberOfLines={1}>{ticket.subject}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
            <View style={[styles.connDot, { backgroundColor: wsConnected ? "#0ECB81" : "#F0B90B" }]} />
            <Text style={[styles.chatSubtitle, { color: colors.mutedForeground }]}>{wsConnected ? "Live" : "Online"}</Text>
            <View style={[styles.statusPill, { backgroundColor: sm.bg }]}>
              <Text style={[styles.statusPillText, { color: sm.color }]}>{sm.label}</Text>
            </View>
          </View>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMsg}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={isTyping ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            <View style={[styles.supportAvatar, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="headphones" size={12} color={colors.primary} />
            </View>
            <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: 12 }]}>
              <View style={{ flexDirection: "row", gap: 5 }}>
                {[0, 1, 2].map((i) => <View key={i} style={[styles.typingDot, { backgroundColor: colors.mutedForeground }]} />)}
              </View>
            </View>
          </View>
        ) : null}
      />

      {status !== "resolved" && status !== "closed" ? (
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: botPad }]}>
          <TextInput
            style={[styles.chatInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={1000}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity onPress={sendMessage} style={[styles.sendBtn, { backgroundColor: (input.trim() && !sending) ? colors.primary : colors.secondary, opacity: sending ? 0.6 : 1 }]} disabled={!input.trim() || sending}>
            <Feather name={sending ? "loader" : "send"} size={17} color={(input.trim() && !sending) ? colors.primaryForeground : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.resolvedBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: botPad }]}>
          <View style={[styles.resolvedIcon, { backgroundColor: "#0ECB8115" }]}>
            <Feather name="check-circle" size={16} color="#0ECB81" />
          </View>
          <Text style={[styles.resolvedText, { color: colors.mutedForeground }]}>
            Ticket {status}. Open a new ticket if you need further help.
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function NewTicketScreen({ onBack, onCreated, userId, userName }: { onBack: () => void; onCreated: (t: Ticket) => void; userId: string; userName: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [subject, setSubject] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const topPad = Platform.OS === "web" ? 20 : insets.top + 8;

  const QUICK_TOPICS = ["Withdrawal issue", "Deposit not received", "Account verification", "Staking question", "API access", "Other"];

  const create = async () => {
    if (!subject.trim()) { Alert.alert("Required", "Please enter a subject."); return; }
    if (!firstMessage.trim()) { Alert.alert("Required", "Please describe your issue."); return; }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/support/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName, subject: subject.trim(), firstMessage: firstMessage.trim() }),
      });
      const data = await res.json();
      if (data.ticket) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onCreated(data.ticket); }
    } catch { Alert.alert("Error", "Failed to create ticket. Please try again."); }
    setCreating(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.pageHeader, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBackBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.pageHeaderTitle, { color: colors.foreground }]}>New Ticket</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.infoStrip, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
          <Feather name="zap" size={15} color={colors.primary} />
          <Text style={[styles.infoStripText, { color: colors.primary }]}>Average first response: under 2 minutes</Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Quick Topics</Text>
          <View style={styles.quickTopicGrid}>
            {QUICK_TOPICS.map((t) => (
              <TouchableOpacity key={t} style={[styles.quickTopic, { backgroundColor: subject === t ? colors.primary : colors.secondary, borderColor: subject === t ? colors.primary : colors.border }]} onPress={() => { setSubject(t); Haptics.selectionAsync(); }}>
                <Text style={[styles.quickTopicText, { color: subject === t ? colors.primaryForeground : colors.mutedForeground }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Subject</Text>
          <TextInput style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: subject.length > 0 ? colors.primary + "60" : colors.border }]} value={subject} onChangeText={setSubject} placeholder="Describe your issue briefly" placeholderTextColor={colors.mutedForeground} maxLength={200} />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Details</Text>
          <TextInput style={[styles.textInput, styles.textArea, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: firstMessage.length > 0 ? colors.primary + "60" : colors.border }]} value={firstMessage} onChangeText={setFirstMessage} placeholder="Please include as much detail as possible — transaction IDs, dates, amounts..." placeholderTextColor={colors.mutedForeground} multiline numberOfLines={5} maxLength={2000} textAlignVertical="top" />
          <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{firstMessage.length}/2000</Text>
        </View>

        <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary, opacity: creating ? 0.8 : 1 }]} onPress={create} disabled={creating} activeOpacity={0.85}>
          {creating ? <ActivityIndicator color={colors.primaryForeground} /> : (
            <>
              <Feather name="message-circle" size={18} color={colors.primaryForeground} />
              <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>Start Live Chat</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function SupportScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [view, setView] = useState<"list" | "new" | "chat">("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const topPad = Platform.OS === "web" ? 20 : insets.top + 8;

  const userId = user?.id ?? "guest";
  const userName = user?.displayName ?? "Guest";

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/support/tickets?userId=${userId}`);
      const data = await res.json();
      setTickets(data.tickets ?? []);
    } catch {}
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => { if (view === "list") fetchTickets(); }, [view]);

  if (view === "new") return <NewTicketScreen onBack={() => setView("list")} onCreated={(t) => { setActiveTicket(t); setView("chat"); }} userId={userId} userName={userName} />;
  if (view === "chat" && activeTicket) return <ChatScreen ticket={activeTicket} userId={userId} userName={userName} onBack={() => setView("list")} />;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.pageHeader, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.pageHeaderTitle, { color: colors.foreground }]}>Support</Text>
        <TouchableOpacity onPress={() => setView("new")} style={[styles.newTicketBtn, { backgroundColor: colors.primary }]}>
          <Feather name="plus" size={15} color={colors.primaryForeground} />
          <Text style={[styles.newTicketBtnText, { color: colors.primaryForeground }]}>New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.heroSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={[styles.heroIcon, { backgroundColor: colors.primary + "15" }]}>
              <Feather name="headphones" size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: colors.foreground }]}>24/7 Live Support</Text>
              <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>Real-time chat via WebSocket connection</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            {[["< 2 min", "Avg Response"], ["24/7", "Availability"], ["99.9%", "Uptime"]].map(([val, lbl]) => (
              <View key={lbl} style={[styles.statItem, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.statVal, { color: colors.primary }]}>{val}</Text>
                <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>{lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : tickets.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="message-square" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No tickets yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Our support team is standing by. Start a live chat to get help instantly.</Text>
            <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary, paddingHorizontal: 32 }]} onPress={() => setView("new")} activeOpacity={0.85}>
              <Feather name="plus" size={18} color={colors.primaryForeground} />
              <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>Open New Ticket</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ padding: 16, gap: 10 }}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>YOUR TICKETS</Text>
            {tickets.map((t) => {
              const sm = STATUS_META[t.status];
              const lastMsg = t.messages[t.messages.length - 1];
              return (
                <TouchableOpacity key={t.id} style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => { setActiveTicket(t); setView("chat"); }} activeOpacity={0.8}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <Text style={[styles.ticketSubject, { color: colors.foreground }]} numberOfLines={1}>{t.subject}</Text>
                    <View style={[styles.statusPill, { backgroundColor: sm.bg }]}>
                      <Text style={[styles.statusPillText, { color: sm.color }]}>{sm.label}</Text>
                    </View>
                  </View>
                  {lastMsg && <Text style={[styles.ticketPreview, { color: colors.mutedForeground }]} numberOfLines={1}>{lastMsg.sender === "support" ? "Support: " : ""}{lastMsg.body}</Text>}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Feather name="message-circle" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.ticketMeta, { color: colors.mutedForeground }]}>{t.messages.length} messages</Text>
                    </View>
                    <Text style={[styles.ticketMeta, { color: colors.mutedForeground }]}>{formatTime(t.updatedAt)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pageHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerBackBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  pageHeaderTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  newTicketBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  newTicketBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  heroSection: { padding: 20, gap: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  heroIcon: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  heroSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10 },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  statVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  centered: { paddingVertical: 80, alignItems: "center" },
  emptyState: { alignItems: "center", padding: 32, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  ticketCard: { padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  ticketSubject: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1, marginRight: 8 },
  ticketPreview: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  ticketMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  infoStrip: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  infoStripText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  quickTopicGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickTopic: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  quickTopicText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  textInput: { fontSize: 14, fontFamily: "Inter_400Regular", padding: 14, borderRadius: 12, borderWidth: 1 },
  textArea: { height: 120, textAlignVertical: "top" },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", alignSelf: "flex-end" },
  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 54, borderRadius: 14, alignSelf: "stretch" },
  createBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  chatHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  chatBackBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  chatTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  chatSubtitle: { fontSize: 11, fontFamily: "Inter_400Regular" },
  connDot: { width: 6, height: 6, borderRadius: 3 },
  supportAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  senderName: { fontSize: 11, fontFamily: "Inter_500Medium" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  msgTime: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 3 },
  typingDot: { width: 7, height: 7, borderRadius: 3.5 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  chatInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, maxHeight: 100, borderWidth: 1 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  resolvedBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  resolvedIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  resolvedText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
