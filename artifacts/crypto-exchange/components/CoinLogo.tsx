import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

interface CoinLogoProps {
  logo?: string;
  color: string;
  size?: number;
  symbol?: string;
}

const CDN_BASE =
  "https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa/128/color";

const SYMBOL_OVERRIDES: Record<string, string> = {
  MATIC: "matic",
  BNB: "bnb",
  AVAX: "avax",
  USDT: "usdt",
  USDC: "usdc",
  ARB: "eth",
  OP: "eth",
  INJ: "inj",
  APT: "apt",
  SUI: "sui",
};

function cdnUrl(symbol: string): string {
  const slug = SYMBOL_OVERRIDES[symbol] ?? symbol.toLowerCase();
  return `${CDN_BASE}/${slug}.png`;
}

export default function CoinLogo({ logo, color, size = 40, symbol }: CoinLogoProps) {
  const [imgError, setImgError] = useState(false);
  const borderRadius = size / 2;
  const bgColor = color + "22";

  const sym = symbol ?? logo ?? "";
  const showImage = sym && !imgError;

  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius, backgroundColor: bgColor }]}>
      {showImage ? (
        <Image
          source={{ uri: cdnUrl(sym) }}
          style={{ width: size * 0.65, height: size * 0.65, borderRadius: (size * 0.65) / 2 }}
          onError={() => setImgError(true)}
          resizeMode="contain"
        />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.35, color }]} numberOfLines={1}>
          {sym.slice(0, 4)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  text: { fontFamily: "Inter_700Bold" },
});
