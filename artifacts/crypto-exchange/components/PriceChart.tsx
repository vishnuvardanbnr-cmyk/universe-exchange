import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { useTheme } from "@/context/ThemeContext";

interface Candle { t: number; o: number; h: number; l: number; c: number; v: number; }

interface PriceChartProps {
  symbol: string;
  interval: string;
  livePrice?: number;
  height?: number;
}

function getApiBase() {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "http://localhost:8080";
}

function formatDate(ts: number, interval: string): string {
  const d = new Date(ts);
  if (interval === "1D" || interval === "1W") return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function fmt(n: number): string {
  if (n >= 10000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

const REFRESH_INTERVAL: Record<string, number> = {
  "15m": 15_000,
  "1H": 30_000,
  "4H": 60_000,
  "1D": 120_000,
  "1W": 300_000,
};

const PADDING = { top: 12, bottom: 28, left: 0, right: 72 };

export default function PriceChart({ symbol, interval, livePrice, height = 220 }: PriceChartProps) {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get("window").width;
  const width = screenWidth;
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;

  const [baseCandles, setBaseCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [chartType, setChartType] = useState<"line" | "candle">("line");
  const [crosshair, setCrosshair] = useState<{ x: number; candleIdx: number } | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const greenColor = "#0ECB81";
  const redColor = "#F6465D";

  const fetchCandles = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(false); }
    try {
      const res = await fetch(`${getApiBase()}/api/klines/${symbol}?interval=${interval}`);
      if (!res.ok) throw new Error("bad");
      const data = await res.json();
      setBaseCandles(data.candles ?? []);
      setLastRefresh(Date.now());
    } catch {
      if (!silent) setError(true);
    }
    if (!silent) setLoading(false);
  }, [symbol, interval]);

  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  useEffect(() => {
    const ms = REFRESH_INTERVAL[interval] ?? 60_000;
    const id = setInterval(() => fetchCandles(true), ms);
    return () => clearInterval(id);
  }, [fetchCandles, interval]);

  const candles = useMemo(() => {
    if (!baseCandles.length) return baseCandles;
    if (!livePrice || livePrice <= 0) return baseCandles;
    const copy = [...baseCandles];
    const last = { ...copy[copy.length - 1] };
    last.c = livePrice;
    last.h = Math.max(last.h, livePrice);
    last.l = Math.min(last.l, livePrice);
    copy[copy.length - 1] = last;
    return copy;
  }, [baseCandles, livePrice]);

  const { maxPrice, priceRange, candleWidth, candleGap, scaleY, scaleX, pathD, fillD } = useMemo(() => {
    if (!candles.length) return {} as any;
    const mn = Math.min(...candles.map((c) => c.l));
    const mx = Math.max(...candles.map((c) => c.h));
    const pad = (mx - mn) * 0.08;
    const minP = mn - pad, maxP = mx + pad;
    const range = maxP - minP || 1;
    const n = candles.length;
    const cw = Math.max(2, (chartW / n) * 0.6);
    const gap = chartW / n;
    const sy = (p: number) => PADDING.top + ((maxP - p) / range) * chartH;
    const sx = (i: number) => PADDING.left + i * gap + gap / 2;
    const pts = candles.map((c, i) => ({ x: sx(i), y: sy(c.c) }));
    const pd = pts.reduce((acc, pt, i) => {
      if (i === 0) return `M${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
      const prev = pts[i - 1];
      const cpx = ((prev.x + pt.x) / 2).toFixed(2);
      return `${acc} C${cpx},${prev.y.toFixed(2)} ${cpx},${pt.y.toFixed(2)} ${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
    }, "");
    const lx = pts[pts.length - 1]?.x ?? chartW;
    const fd = `${pd} L${lx},${height} L${pts[0].x},${height} Z`;
    return { minPrice: minP, maxPrice: maxP, priceRange: range, candleWidth: cw, candleGap: gap, scaleY: sy, scaleX: sx, pathD: pd, fillD: fd };
  }, [candles, chartW, chartH, height]);

  function handleTouch(e: GestureResponderEvent) {
    if (!candles.length || !scaleX) return;
    const x = e.nativeEvent.locationX - PADDING.left;
    const idx = Math.max(0, Math.min(candles.length - 1, Math.round(x / candleGap)));
    setCrosshair({ x: scaleX(idx), candleIdx: idx });
  }

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => handleTouch(e),
    onPanResponderMove: (e) => handleTouch(e),
    onPanResponderRelease: () => setCrosshair(null),
    onPanResponderTerminate: () => setCrosshair(null),
  }), [candles, scaleX]);

  const activeCandle = crosshair != null ? candles[crosshair.candleIdx] : candles[candles.length - 1];
  const isPositive = !candles.length ? true : candles[candles.length - 1].c >= candles[0].o;
  const lineColor = isPositive ? greenColor : redColor;

  const priceLabels = useMemo(() => {
    if (!priceRange) return [];
    return Array.from({ length: 5 }, (_, i) => {
      const price = maxPrice - (priceRange / 4) * i;
      return { price, y: PADDING.top + ((maxPrice - price) / priceRange) * chartH };
    });
  }, [maxPrice, priceRange, chartH]);

  if (loading) {
    return (
      <View style={[styles.loadingBox, { height, backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading chart…</Text>
      </View>
    );
  }
  if (error || !candles.length) {
    return (
      <View style={[styles.loadingBox, { height, backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Chart unavailable</Text>
        <TouchableOpacity onPress={() => fetchCandles()} style={[styles.retryBtn, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const livePx = livePrice && livePrice > 0 ? livePrice : activeCandle?.c ?? 0;
  const livePxIsPositive = candles.length > 0 && livePx >= candles[0].o;

  return (
    <View style={{ backgroundColor: colors.background }}>
      <View style={styles.chartControls}>
        <View style={styles.priceInfo}>
          {activeCandle && (
            <>
              <Text style={[styles.crosshairPrice, { color: activeCandle.c >= activeCandle.o ? greenColor : redColor }]}>
                ${fmt(crosshair ? activeCandle.c : livePx)}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.crosshairDate, { color: colors.mutedForeground }]}>
                  {crosshair ? formatDate(activeCandle.t, interval) : "Live"}
                </Text>
                {!crosshair && (
                  <View style={styles.liveDot} />
                )}
              </View>
            </>
          )}
        </View>
        <View style={styles.typeToggle}>
          {(["line", "candle"] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setChartType(t)} style={[styles.typeBtn, { backgroundColor: chartType === t ? colors.primary : colors.secondary }]}>
              <Text style={[styles.typeBtnText, { color: chartType === t ? colors.primaryForeground : colors.mutedForeground }]}>
                {t === "line" ? "Line" : "Candles"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeCandle && chartType === "candle" && (
        <View style={styles.ohlcRow}>
          {[
            { label: "O", value: fmt(activeCandle.o) },
            { label: "H", value: fmt(activeCandle.h), color: greenColor },
            { label: "L", value: fmt(activeCandle.l), color: redColor },
            { label: "C", value: fmt(crosshair ? activeCandle.c : livePx) },
          ].map(({ label, value, color }) => (
            <Text key={label} style={[styles.ohlcText, { color: colors.mutedForeground }]}>
              <Text style={styles.ohlcLabel}>{label} </Text>
              <Text style={{ color: color ?? colors.foreground }}>{value}</Text>
            </Text>
          ))}
        </View>
      )}

      <View {...panResponder.panHandlers} style={{ height }}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
              <Stop offset="85%" stopColor={lineColor} stopOpacity="0.05" />
              <Stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {priceLabels.map(({ y }, i) => (
            <Line key={i} x1={PADDING.left} y1={y} x2={width - PADDING.right} y2={y} stroke={colors.border} strokeWidth={StyleSheet.hairlineWidth} strokeDasharray="4,8" />
          ))}

          {chartType === "line" ? (
            <>
              <Path d={fillD} fill="url(#chartGrad)" />
              <Path d={pathD} stroke={lineColor} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {candles.length > 0 && scaleY && scaleX && (
                <Circle cx={scaleX(candles.length - 1)} cy={scaleY(livePx)} r={4} fill={lineColor} stroke={colors.background} strokeWidth={2} />
              )}
            </>
          ) : (
            candles.map((c, i) => {
              const x = scaleX(i);
              const isG = c.c >= c.o;
              const col = isG ? greenColor : redColor;
              const bTop = scaleY(Math.max(c.o, c.c));
              const bBot = scaleY(Math.min(c.o, c.c));
              const bH = Math.max(1, bBot - bTop);
              return (
                <React.Fragment key={i}>
                  <Line x1={x} y1={scaleY(c.h)} x2={x} y2={scaleY(c.l)} stroke={col} strokeWidth={1} />
                  <Rect x={x - candleWidth / 2} y={bTop} width={candleWidth} height={bH} fill={col} opacity={0.9} />
                </React.Fragment>
              );
            })
          )}

          {crosshair && activeCandle && (
            <>
              <Line x1={crosshair.x} y1={PADDING.top} x2={crosshair.x} y2={height - PADDING.bottom} stroke={colors.mutedForeground} strokeWidth={StyleSheet.hairlineWidth} strokeDasharray="3,4" />
              <Line x1={PADDING.left} y1={scaleY(activeCandle.c)} x2={width - PADDING.right} y2={scaleY(activeCandle.c)} stroke={colors.mutedForeground} strokeWidth={StyleSheet.hairlineWidth} strokeDasharray="3,4" />
              <Circle cx={crosshair.x} cy={scaleY(activeCandle.c)} r={5} fill={activeCandle.c >= activeCandle.o ? greenColor : redColor} stroke={colors.background} strokeWidth={2} />
            </>
          )}

          {!crosshair && scaleY && scaleX && livePrice && livePrice > 0 && (
            <Line x1={PADDING.left} y1={scaleY(livePrice)} x2={width - PADDING.right} y2={scaleY(livePrice)} stroke={livePxIsPositive ? greenColor : redColor} strokeWidth={StyleSheet.hairlineWidth} strokeDasharray="6,4" opacity={0.5} />
          )}
        </Svg>

        {priceLabels.map(({ price, y }, i) => (
          <Text key={i} style={[styles.priceLabel, { position: "absolute", right: 4, top: y - 8, color: colors.mutedForeground }]}>
            {fmt(price)}
          </Text>
        ))}

        {!crosshair && scaleY && livePrice && livePrice > 0 && (
          <View style={[styles.livePriceBubble, { top: scaleY(livePrice) - 10, right: 4, backgroundColor: livePxIsPositive ? greenColor : redColor }]}>
            <Text style={styles.livePriceBubbleText}>{fmt(livePrice)}</Text>
          </View>
        )}
      </View>

      <View style={[styles.timeAxis, { borderTopColor: colors.border }]}>
        {[0, Math.floor(candles.length * 0.25), Math.floor(candles.length * 0.5), Math.floor(candles.length * 0.75), candles.length - 1].map((idx) => {
          const c = candles[idx];
          return c ? <Text key={idx} style={[styles.timeLabel, { color: colors.mutedForeground }]}>{formatDate(c.t, interval)}</Text> : null;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingBox: { alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginTop: 4 },
  retryText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  chartControls: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 6 },
  priceInfo: { gap: 2 },
  crosshairPrice: { fontSize: 18, fontFamily: "Inter_700Bold" },
  crosshairDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#0ECB81" },
  typeToggle: { flexDirection: "row", gap: 4 },
  typeBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  typeBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  ohlcRow: { flexDirection: "row", gap: 14, paddingHorizontal: 16, paddingBottom: 6 },
  ohlcText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  ohlcLabel: { fontFamily: "Inter_600SemiBold" },
  priceLabel: { fontSize: 9, fontFamily: "Inter_500Medium" },
  livePriceBubble: { position: "absolute", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  livePriceBubbleText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" },
  timeAxis: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth },
  timeLabel: { fontSize: 9, fontFamily: "Inter_400Regular" },
});
