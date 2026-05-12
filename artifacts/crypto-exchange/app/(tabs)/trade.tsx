import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
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
import { useWallet, COIN_PRICES } from "@/context/WalletContext";
import { useUserWallet } from "@/context/UserWalletContext";
import { useAuth } from "@/context/AuthContext";
import { useLivePrice } from "@/context/LivePriceContext";
import { useActiveExchange } from "@/context/ActiveExchangeContext";
import { MARKET_DATA, formatPrice, OrderBookEntry } from "@/data/marketData";
import PriceChart from "@/components/PriceChart";
import CoinLogo from "@/components/CoinLogo";

const ALL_PAIRS = [
  "BTC","ETH","BNB","SOL","XRP","ADA","DOGE","AVAX",
  "TRX","DOT","MATIC","LINK","LTC","ATOM","UNI","NEAR",
  "ARB","OP","APT","SUI","INJ",
];
const TIME_FRAMES = ["15m", "1H", "4H", "1D", "1W"];
const ORDERS_KEY = "cryptox_orders_v1";

type TradeOrder = {
  id: string;
  pair: string;
  side: "Buy" | "Sell";
  type: "Market" | "Limit" | "Stop";
  amount: number;
  price: number;
  total: number;
  fee: number;
  status: "filled" | "open" | "cancelled";
  timestamp: number;
};

function LivePriceBadge({ price, isPositive }: { price: number; isPositive: boolean }) {
  const { colors } = useTheme();
  const flashAnim = useRef(new Animated.Value(0)).current;
  const prevPrice = useRef(price);

  useEffect(() => {
    if (price > 0 && price !== prevPrice.current) {
      prevPrice.current = price;
      flashAnim.setValue(1);
      Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: false }).start();
    }
  }, [price]);

  const color = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isPositive ? "#00C087" : "#FF4B4B", isPositive ? "#00FF99" : "#FF6666"],
  });

  return (
    <Animated.Text style={[styles.bigPrice, { color }]}>
      ${formatPrice(price)}
    </Animated.Text>
  );
}

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "http://localhost:8080";
}

export default function TradeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ symbol?: string }>();
  const { cexBalances, buyCoin, sellCoin } = useWallet();
  const { balances: serverBalances } = useUserWallet();
  const { user } = useAuth();
  const { getTicker, connected } = useLivePrice();
  const { isConnected: binanceConnected, placeOrder: binancePlaceOrder, meta: exchangeMeta } = useActiveExchange();
  const [tradingLive, setTradingLive] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const initialBase = params.symbol ?? "BTC";
  const [selectedBase, setSelectedBase] = useState(initialBase);
  const [timeFrame, setTimeFrame] = useState("1D");
  const [side, setSide] = useState<"Buy" | "Sell">("Buy");
  const [orderType, setOrderType] = useState<"Market" | "Limit" | "Stop">("Market");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [chartTab, setChartTab] = useState<"chart" | "book" | "info">("chart");
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairSearch, setPairSearch] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (params.symbol && params.symbol !== selectedBase) {
      setSelectedBase(params.symbol);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [params.symbol]);

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [orderTab, setOrderTab] = useState<"open" | "history">("open");
  const [orderBook, setOrderBook] = useState<{ bids: OrderBookEntry[]; asks: OrderBookEntry[]; source?: string }>({ bids: [], asks: [] });
  const obIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const staticCoin = MARKET_DATA.find((c) => c.symbol === selectedBase) ?? MARKET_DATA[0];
  const liveTicker = getTicker(selectedBase);
  const marketPrice = liveTicker ? liveTicker.price : staticCoin.price;
  const change24h = liveTicker ? liveTicker.change24h : staticCoin.change24h;
  const high24h = liveTicker ? liveTicker.high24h : staticCoin.high24h;
  const low24h = liveTicker ? liveTicker.low24h : staticCoin.low24h;
  const volume24h = liveTicker ? liveTicker.quoteVolume24h : staticCoin.volume24h;

  useEffect(() => {
    AsyncStorage.getItem(ORDERS_KEY).then((raw) => {
      if (raw) setOrders(JSON.parse(raw));
    });
  }, []);

  const saveOrders = useCallback(async (updated: TradeOrder[]) => {
    setOrders(updated);
    await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
  }, []);

  const cancelOrder = useCallback((id: string) => {
    setOrders((prev) => {
      const updated = prev.map((o) => o.id === id ? { ...o, status: "cancelled" as const } : o);
      AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      return updated;
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const fetchOrderBook = useCallback(async (symbol: string) => {
    try {
      const res = await fetch(`${getApiBase()}/api/orderbook/${symbol}`);
      if (!res.ok) return;
      const data = await res.json();
      setOrderBook({ bids: data.bids ?? [], asks: data.asks ?? [], source: data.source });
    } catch { }
  }, []);

  useEffect(() => {
    setOrderBook({ bids: [], asks: [] });
    fetchOrderBook(selectedBase);
    if (obIntervalRef.current) clearInterval(obIntervalRef.current);
    if (chartTab === "book") {
      obIntervalRef.current = setInterval(() => fetchOrderBook(selectedBase), 2500);
    }
    return () => { if (obIntervalRef.current) clearInterval(obIntervalRef.current); };
  }, [selectedBase, chartTab, fetchOrderBook]);


  const isPositive = change24h >= 0;
  const getServerBal = (sym: string) => {
    const b = serverBalances.find(b => b.coin === sym);
    return b ? b.available + b.locked : 0;
  };
  const getLocalBal = (sym: string) => cexBalances.find(c => c.symbol === sym)?.balance ?? 0;
  const usdtBalance = user ? getServerBal("USDT") : getLocalBal("USDT");
  const baseBalance = user ? getServerBal(selectedBase) : getLocalBal(selectedBase);
  const usdt = { balance: usdtBalance };
  const baseCoin = { balance: baseBalance };

  const numAmount = parseFloat(amount) || 0;
  const execPrice = orderType === "Market" ? marketPrice : parseFloat(limitPrice) || marketPrice;
  const usdTotal = numAmount * execPrice;
  const fee = usdTotal * 0.001;

  const handleTrade = async () => {
    if (numAmount <= 0) { Alert.alert("Enter Amount"); return; }
    const isMarket = orderType === "Market";

    if (binanceConnected) {
      setTradingLive(true);
      try {
        const binanceType = orderType === "Stop" ? "STOP_LOSS_LIMIT" : orderType.toUpperCase() as "MARKET" | "LIMIT";
        const params: Parameters<typeof binancePlaceOrder>[0] = {
          symbol: `${selectedBase}USDT`,
          side: side === "Buy" ? "BUY" : "SELL",
          type: binanceType,
          quantity: numAmount.toFixed(6),
        };
        if (orderType === "Limit" || orderType === "Stop") {
          params.price = execPrice.toFixed(2);
          params.timeInForce = "GTC";
        }
        if (orderType === "Stop") {
          params.stopPrice = (parseFloat(limitPrice) * 0.995).toFixed(2);
        }
        const result = await binancePlaceOrder(params);
        setTradingLive(false);
        if ("error" in result) {
          Alert.alert("Order Failed", result.error);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
        const newOrder: TradeOrder = {
          id: String(result.orderId),
          pair: `${selectedBase}/USDT`,
          side,
          type: orderType,
          amount: numAmount,
          price: execPrice,
          total: usdTotal,
          fee,
          status: result.status === "FILLED" ? "filled" : "open",
          timestamp: result.transactTime ?? Date.now(),
        };
        saveOrders([newOrder, ...orders]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          result.status === "FILLED" ? "Order Filled (Live)" : "Order Placed (Live)",
          `${side} ${numAmount} ${selectedBase} at $${formatPrice(execPrice)}\n\nOrder ID: ${result.orderId}`
        );
        setAmount("");
        setLimitPrice("");
        if (result.status !== "FILLED") setOrderTab("open");
        return;
      } catch (err) {
        setTradingLive(false);
        Alert.alert("Error", String(err));
        return;
      }
    }

    if (isMarket) {
      if (side === "Buy") {
        if (!usdt || usdt.balance < usdTotal + fee) { Alert.alert("Insufficient USDT", `Need $${(usdTotal + fee).toFixed(2)} USDT.`); return; }
        buyCoin(selectedBase, usdTotal, execPrice);
      } else {
        if (!baseCoin || baseCoin.balance < numAmount) { Alert.alert(`Insufficient ${selectedBase}`); return; }
        sellCoin(selectedBase, usdTotal, execPrice);
      }
    }
    const newOrder: TradeOrder = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pair: `${selectedBase}/USDT`,
      side,
      type: orderType,
      amount: numAmount,
      price: execPrice,
      total: usdTotal,
      fee,
      status: isMarket ? "filled" : "open",
      timestamp: Date.now(),
    };
    saveOrders([newOrder, ...orders]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      isMarket ? "Order Filled" : "Order Placed",
      `${side} ${numAmount} ${selectedBase} at $${formatPrice(execPrice)}`
    );
    setAmount("");
    setLimitPrice("");
    if (!isMarket) setOrderTab("open");
  };

  const filteredPairs = ALL_PAIRS.filter((s) =>
    s.toLowerCase().includes(pairSearch.toLowerCase())
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Pair Selector Modal */}
      <Modal visible={showPairModal} animationType="slide" onRequestClose={() => setShowPairModal(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background, paddingTop: topPad }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Pair</Text>
            <TouchableOpacity onPress={() => { setShowPairModal(false); setPairSearch(""); }}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={[styles.modalSearch, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.modalSearchInput, { color: colors.foreground }]}
              placeholder="Search coin..."
              placeholderTextColor={colors.mutedForeground}
              value={pairSearch}
              onChangeText={setPairSearch}
              autoCorrect={false}
              autoCapitalize="characters"
            />
            {pairSearch.length > 0 && (
              <TouchableOpacity onPress={() => setPairSearch("")}>
                <Feather name="x-circle" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.modalColHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalColText, { color: colors.mutedForeground }]}>Pair</Text>
            <Text style={[styles.modalColText, { color: colors.mutedForeground, textAlign: "right" }]}>Price / 24h Change</Text>
          </View>
          <FlatList
            data={filteredPairs}
            keyExtractor={(s) => s}
            renderItem={({ item: sym }) => {
              const coin = MARKET_DATA.find((c) => c.symbol === sym);
              const ticker = getTicker(sym);
              const price = ticker ? ticker.price : coin?.price ?? 0;
              const chg = ticker ? ticker.change24h : coin?.change24h ?? 0;
              const isUp = chg >= 0;
              return (
                <TouchableOpacity
                  style={[styles.modalPairRow, { borderBottomColor: colors.border }, selectedBase === sym && { backgroundColor: colors.secondary }]}
                  onPress={() => {
                    setSelectedBase(sym);
                    setShowPairModal(false);
                    setPairSearch("");
                    Haptics.selectionAsync();
                  }}
                >
                  <View style={styles.modalPairLeft}>
                    <CoinLogo logo={coin?.logo} symbol={sym} color={coin?.color ?? "#888"} size={36} />
                    <View>
                      <Text style={[styles.modalPairSymbol, { color: colors.foreground }]}>{sym}/USDT</Text>
                      <Text style={[styles.modalPairName, { color: colors.mutedForeground }]}>{coin?.name ?? sym}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.modalPairPrice, { color: colors.foreground }]}>${formatPrice(price)}</Text>
                    <Text style={[styles.modalPairChg, { color: isUp ? "#00C087" : "#FF4B4B" }]}>
                      {isUp ? "+" : ""}{chg.toFixed(2)}%
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>

      <View style={{ paddingTop: topPad }} />
      <View style={[styles.priceHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.priceHeaderLeft} onPress={() => setShowPairModal(true)} activeOpacity={0.7}>
          <CoinLogo logo={staticCoin.logo} symbol={staticCoin.symbol} color={staticCoin.color} size={32} />
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={[styles.pricePair, { color: colors.foreground }]}>{selectedBase}/USDT</Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </View>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, { backgroundColor: connected ? "#00C087" : "#888" }]} />
              <Text style={[styles.liveLabel, { color: colors.mutedForeground }]}>
                {connected ? "Live · 0.10% fee" : "Connecting..."}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <LivePriceBadge price={marketPrice} isPositive={isPositive} />
          <View style={[styles.changeTag, { backgroundColor: isPositive ? "#00C08718" : "#FF4B4B18" }]}>
            <Feather name={isPositive ? "arrow-up-right" : "arrow-down-right"} size={11} color={isPositive ? "#00C087" : "#FF4B4B"} />
            <Text style={[styles.changeTagText, { color: isPositive ? "#00C087" : "#FF4B4B" }]}>
              {isPositive ? "+" : ""}{change24h.toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.statsScroll, { borderBottomColor: colors.border }]}>
          {[
            { label: "24h High", value: `$${formatPrice(high24h)}`, color: "#00C087" },
            { label: "24h Low", value: `$${formatPrice(low24h)}`, color: "#FF4B4B" },
            { label: "24h Vol (USDT)", value: `$${(volume24h / 1e9).toFixed(2)}B`, color: colors.foreground },
            { label: "24h Vol", value: `${(volume24h / marketPrice / 1e6).toFixed(2)}M ${selectedBase}`, color: colors.foreground },
          ].map((s) => (
            <View key={s.label} style={styles.statBlock}>
              <Text style={[styles.statBlockLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
              <Text style={[styles.statBlockValue, { color: s.color }]}>{s.value}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {(["chart", "book", "info"] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setChartTab(t)} style={[styles.tabBarBtn, { borderBottomColor: chartTab === t ? colors.primary : "transparent" }]}>
              <Text style={[styles.tabBarText, { color: chartTab === t ? colors.primary : colors.mutedForeground }]}>
                {t === "chart" ? "Chart" : t === "book" ? "Order Book" : "Info"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {chartTab === "chart" ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tfScroll}>
              {TIME_FRAMES.map((tf) => (
                <TouchableOpacity
                  key={tf}
                  onPress={() => setTimeFrame(tf)}
                  style={[styles.tfBtn, { backgroundColor: timeFrame === tf ? colors.primary : colors.secondary }]}
                >
                  <Text style={[styles.tfText, { color: timeFrame === tf ? colors.primaryForeground : colors.mutedForeground }]}>{tf}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <PriceChart symbol={selectedBase} interval={timeFrame} livePrice={marketPrice} height={240} />
          </>
        ) : chartTab === "book" ? (
          <View style={styles.orderBook}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingBottom: 4 }}>
              <Text style={[styles.obColText, { color: colors.mutedForeground }]}>Order Book</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={[styles.liveDot, { backgroundColor: orderBook.source === "binance" ? "#00C087" : "#F0B90B" }]} />
                <Text style={[{ fontSize: 10, fontFamily: "Inter_500Medium", color: orderBook.source === "binance" ? "#00C087" : "#F0B90B" }]}>
                  {orderBook.source === "binance" ? "Binance Liquidity" : orderBook.source === "simulated" ? "Simulated" : "Loading..."}
                </Text>
              </View>
            </View>
            <View style={[styles.obColHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.obColText, { color: colors.mutedForeground }]}>Price (USDT)</Text>
              <Text style={[styles.obColText, { color: colors.mutedForeground, textAlign: "center" }]}>Amount ({selectedBase})</Text>
              <Text style={[styles.obColText, { color: colors.mutedForeground, textAlign: "right" }]}>Total</Text>
            </View>
            {orderBook.asks.length === 0 ? (
              <View style={{ alignItems: "center", padding: 20 }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <>
                {orderBook.asks.slice(0, 7).reverse().map((a, i) => (
                  <View key={`a${i}`} style={styles.obRow}>
                    <View style={[styles.obDepth, { width: `${Math.min(a.total / (orderBook.asks[6]?.total ?? 1) * 100, 100)}%`, backgroundColor: "#FF4B4B18" }]} />
                    <Text style={[styles.obPrice, { color: "#FF4B4B" }]}>{formatPrice(a.price)}</Text>
                    <Text style={[styles.obAmt, { color: colors.foreground }]}>{a.amount.toFixed(4)}</Text>
                    <Text style={[styles.obTotal, { color: colors.mutedForeground }]}>{a.total.toFixed(3)}</Text>
                  </View>
                ))}
                <View style={[styles.obMid, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.obMidPrice, { color: isPositive ? "#00C087" : "#FF4B4B" }]}>${formatPrice(marketPrice)}</Text>
                  <Feather name={isPositive ? "arrow-up" : "arrow-down"} size={13} color={isPositive ? "#00C087" : "#FF4B4B"} />
                  <View style={[styles.liveDot, { backgroundColor: connected ? "#00C087" : "#888" }]} />
                </View>
                {orderBook.bids.slice(0, 7).map((b, i) => (
                  <View key={`b${i}`} style={styles.obRow}>
                    <View style={[styles.obDepth, { width: `${Math.min(b.total / (orderBook.bids[6]?.total ?? 1) * 100, 100)}%`, backgroundColor: "#00C08718" }]} />
                    <Text style={[styles.obPrice, { color: "#00C087" }]}>{formatPrice(b.price)}</Text>
                    <Text style={[styles.obAmt, { color: colors.foreground }]}>{b.amount.toFixed(4)}</Text>
                    <Text style={[styles.obTotal, { color: colors.mutedForeground }]}>{b.total.toFixed(3)}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        ) : (
          <View style={{ padding: 16, gap: 0 }}>
            {[
              { label: "Coin", value: staticCoin.name },
              { label: "Symbol", value: staticCoin.symbol },
              { label: "Current Price", value: `$${formatPrice(marketPrice)}`, highlight: true },
              { label: "24h Change", value: `${isPositive ? "+" : ""}${change24h.toFixed(2)}%`, color: isPositive ? "#00C087" : "#FF4B4B" },
              { label: "24h High", value: `$${formatPrice(high24h)}`, color: "#00C087" },
              { label: "24h Low", value: `$${formatPrice(low24h)}`, color: "#FF4B4B" },
              { label: "24h Volume", value: `$${(volume24h / 1e9).toFixed(2)}B` },
              { label: "Market Cap", value: `$${(staticCoin.marketCap / 1e9).toFixed(2)}B` },
            ].map((item, i) => (
              <View key={item.label} style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                <Text style={[styles.infoValue, { color: (item as any).color ?? colors.foreground, fontFamily: (item as any).highlight ? "Inter_700Bold" : "Inter_600SemiBold" }]}>{item.value}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.tradePanel, { backgroundColor: colors.card, margin: 12, borderRadius: 18 }]}>
          <View style={styles.sideBtns}>
            {(["Buy", "Sell"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSide(s)}
                style={[styles.sideBtn, { backgroundColor: side === s ? (s === "Buy" ? "#00C087" : "#FF4B4B") : colors.secondary }]}
              >
                <Text style={[styles.sideBtnText, { color: side === s ? "#fff" : colors.mutedForeground }]}>{s} {selectedBase}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orderTypes}>
            {(["Market", "Limit", "Stop"] as const).map((ot) => (
              <TouchableOpacity
                key={ot}
                onPress={() => setOrderType(ot)}
                style={[styles.orderTypeBtn, { borderBottomColor: orderType === ot ? (side === "Buy" ? "#00C087" : "#FF4B4B") : "transparent" }]}
              >
                <Text style={[styles.orderTypeText, { color: orderType === ot ? colors.foreground : colors.mutedForeground }]}>{ot}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {orderType === "Limit" && (
            <View style={[styles.inputBox, { borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Limit Price (USDT)</Text>
              <TextInput
                style={[styles.inputField, { color: colors.foreground }]}
                placeholder={formatPrice(marketPrice)}
                placeholderTextColor={colors.mutedForeground}
                value={limitPrice}
                onChangeText={setLimitPrice}
                keyboardType="decimal-pad"
              />
            </View>
          )}

          <View style={[styles.inputBox, { borderColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Amount ({selectedBase})</Text>
            <TextInput
              style={[styles.inputField, { color: colors.foreground }]}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.pctRow}>
            {["25%", "50%", "75%", "100%"].map((pct) => (
              <TouchableOpacity
                key={pct}
                style={[styles.pctBtn, { backgroundColor: colors.secondary }]}
                onPress={() => {
                  const avail = side === "Buy" ? (usdt?.balance ?? 0) / execPrice : (baseCoin?.balance ?? 0);
                  setAmount((avail * parseInt(pct) / 100).toFixed(6));
                }}
              >
                <Text style={[styles.pctText, { color: colors.mutedForeground }]}>{pct}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {numAmount > 0 && (
            <View style={[styles.summary, { backgroundColor: colors.secondary, borderRadius: 10 }]}>
              {[
                { label: "Est. Price", value: `$${formatPrice(execPrice)}` },
                { label: "Total", value: `$${usdTotal.toFixed(2)}` },
                { label: "Fee (0.1%)", value: `$${fee.toFixed(4)}` },
                { label: "You receive", value: side === "Buy" ? `${numAmount.toFixed(6)} ${selectedBase}` : `$${(usdTotal - fee).toFixed(2)}` },
              ].map((r) => (
                <View key={r.label} style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{r.label}</Text>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>{r.value}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.balanceInfo}>
            <Text style={[styles.balInfoText, { color: colors.mutedForeground }]}>USDT: ${(usdt?.balance ?? 0).toFixed(2)}</Text>
            <Text style={[styles.balInfoText, { color: colors.mutedForeground }]}>{selectedBase}: {(baseCoin?.balance ?? 0).toFixed(6)}</Text>
          </View>

          {binanceConnected && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: exchangeMeta.color + "12", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8, alignSelf: "stretch" }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#0ECB81" }} />
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: exchangeMeta.color }}>Live {exchangeMeta.name} Trading</Text>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginLeft: 2 }}>· Orders execute on your account</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.tradeBtn, { backgroundColor: side === "Buy" ? "#00C087" : "#FF4B4B", opacity: tradingLive ? 0.7 : 1 }]}
            onPress={handleTrade}
            activeOpacity={0.88}
            disabled={tradingLive}
          >
            {tradingLive
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.tradeBtnText}>{side} {selectedBase}{binanceConnected ? ` (${exchangeMeta.name})` : ""}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Orders Section */}
        <View style={[styles.ordersPanel, { backgroundColor: colors.card, margin: 12, borderRadius: 18 }]}>
          <View style={[styles.ordersPanelHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.ordersPanelTitle, { color: colors.foreground }]}>My Orders</Text>
            <View style={styles.ordersTabRow}>
              {(["open", "history"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setOrderTab(t)}
                  style={[styles.ordersTabBtn, { borderBottomColor: orderTab === t ? colors.primary : "transparent" }]}
                >
                  <Text style={[styles.ordersTabText, { color: orderTab === t ? colors.primary : colors.mutedForeground }]}>
                    {t === "open" ? `Open (${orders.filter((o) => o.status === "open").length})` : "History"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {(() => {
            const filtered = orders.filter((o) =>
              orderTab === "open" ? o.status === "open" : o.status !== "open"
            );
            if (filtered.length === 0) {
              return (
                <View style={styles.ordersEmpty}>
                  <Feather name="file-text" size={32} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
                  <Text style={[styles.ordersEmptyText, { color: colors.mutedForeground }]}>
                    {orderTab === "open" ? "No open orders" : "No order history yet"}
                  </Text>
                </View>
              );
            }
            return filtered.map((o) => (
              <View key={o.id} style={[styles.orderRow, { borderBottomColor: colors.border }]}>
                <View style={styles.orderRowLeft}>
                  <View style={[styles.orderSideBadge, { backgroundColor: o.side === "Buy" ? "#00C08722" : "#FF4B4B22" }]}>
                    <Text style={[styles.orderSideText, { color: o.side === "Buy" ? "#00C087" : "#FF4B4B" }]}>{o.side}</Text>
                  </View>
                  <View>
                    <Text style={[styles.orderPair, { color: colors.foreground }]}>{o.pair}</Text>
                    <Text style={[styles.orderMeta, { color: colors.mutedForeground }]}>
                      {o.type} · {new Date(o.timestamp).toLocaleString()}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={[styles.orderAmt, { color: colors.foreground }]}>
                    {o.amount.toFixed(6)} @ ${formatPrice(o.price)}
                  </Text>
                  {o.status === "open" ? (
                    <TouchableOpacity
                      onPress={() => cancelOrder(o.id)}
                      style={[styles.cancelBtn, { borderColor: "#FF4B4B" }]}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.statusBadge, {
                      backgroundColor: o.status === "filled" ? "#00C08722" : "#88888822"
                    }]}>
                      <Text style={[styles.statusText, { color: o.status === "filled" ? "#00C087" : "#888" }]}>
                        {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ));
          })()}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  modalSearch: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  modalSearchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", padding: 0 },
  modalColHeader: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  modalColText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  modalPairRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  modalPairLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  modalPairSymbol: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalPairName: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  modalPairPrice: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalPairChg: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  priceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  priceHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  pricePair: { fontSize: 17, fontFamily: "Inter_700Bold" },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  bigPrice: { fontSize: 24, fontFamily: "Inter_700Bold" },
  changeTag: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  changeTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statsScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 24, borderBottomWidth: StyleSheet.hairlineWidth },
  statBlock: { gap: 2 },
  statBlockLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  statBlockValue: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tabBar: { flexDirection: "row", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  tabBarBtn: { paddingVertical: 10, marginRight: 20, borderBottomWidth: 2 },
  tabBarText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tfScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tfBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  tfText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  orderBook: { paddingHorizontal: 12 },
  obColHeader: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  obColText: { flex: 1, fontSize: 10, fontFamily: "Inter_500Medium" },
  obRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, position: "relative" },
  obDepth: { position: "absolute", top: 0, bottom: 0, left: 0 },
  obPrice: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  obAmt: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  obTotal: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "right" },
  obMid: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 7, borderRadius: 8, marginVertical: 4 },
  obMidPrice: { fontSize: 15, fontFamily: "Inter_700Bold" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  infoLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 13 },
  tradePanel: { padding: 16, gap: 12 },
  sideBtns: { flexDirection: "row", gap: 8 },
  sideBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  sideBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  orderTypes: { gap: 0, paddingVertical: 2 },
  orderTypeBtn: { paddingVertical: 8, marginRight: 20, borderBottomWidth: 2 },
  orderTypeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inputBox: { borderWidth: 1, borderRadius: 10, padding: 12 },
  inputLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 5 },
  inputField: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  pctRow: { flexDirection: "row", gap: 8 },
  pctBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  pctText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  summary: { padding: 12, gap: 6 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  summaryValue: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  balanceInfo: { flexDirection: "row", justifyContent: "space-between" },
  balInfoText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  tradeBtn: { paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  tradeBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  ordersPanel: { overflow: "hidden" },
  ordersPanelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  ordersPanelTitle: { fontSize: 15, fontFamily: "Inter_700Bold", paddingBottom: 14 },
  ordersTabRow: { flexDirection: "row", gap: 4 },
  ordersTabBtn: { paddingHorizontal: 2, paddingBottom: 14, marginLeft: 12, borderBottomWidth: 2 },
  ordersTabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  ordersEmpty: { alignItems: "center", justifyContent: "center", paddingVertical: 36, gap: 10 },
  ordersEmptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  orderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  orderRowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  orderSideBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  orderSideText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  orderPair: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  orderMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  orderAmt: { fontSize: 12, fontFamily: "Inter_500Medium" },
  cancelBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  cancelBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#FF4B4B" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontFamily: "Inter_500Medium" },
});
