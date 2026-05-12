import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { useTheme } from "@/context/ThemeContext";

export default function AppSplash() {
  const { colors } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const ringSpin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.timing(ringSpin, { toValue: 1, duration: 4500, easing: Easing.linear, useNativeDriver: true }),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const rotate = ringSpin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={[styles.root, { backgroundColor: "#0B0E11" }]}>
      <Animated.View style={[styles.logoWrap, { opacity: fade, transform: [{ scale }] }]}>
        <Animated.View
          style={[
            styles.pulseRing,
            { borderColor: "#F0B90B", transform: [{ scale: pulseScale }], opacity: pulseOpacity },
          ]}
        />
        <Animated.View style={[styles.outerRing, { borderColor: "#F0B90B40", transform: [{ rotate }] }]}>
          <View style={[styles.tick, { backgroundColor: "#F0B90B", top: -3 }]} />
          <View style={[styles.tick, { backgroundColor: "#F0B90B70", bottom: -3 }]} />
          <View style={[styles.tick, { backgroundColor: "#F0B90B70", left: -3, top: "50%", marginTop: -3 }]} />
          <View style={[styles.tick, { backgroundColor: "#F0B90B70", right: -3, top: "50%", marginTop: -3 }]} />
        </Animated.View>
        <View style={styles.logoCore}>
          <Text style={styles.logoLetter}>X</Text>
        </View>
      </Animated.View>

      <Animated.View style={{ alignItems: "center", marginTop: 28, opacity: fade }}>
        <Text style={styles.brand}>Universe X</Text>
        <Text style={styles.tagline}>Trade. Earn. Hold.</Text>
      </Animated.View>

      <View style={styles.spinnerWrap}>
        <ActivityIndicator color={colors.primary ?? "#F0B90B"} />
      </View>
    </View>
  );
}

const RING = 132;
const CORE = 88;

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoWrap: { width: RING + 30, height: RING + 30, alignItems: "center", justifyContent: "center" },
  pulseRing: {
    position: "absolute",
    width: RING, height: RING, borderRadius: RING / 2,
    borderWidth: 2,
  },
  outerRing: {
    position: "absolute",
    width: RING, height: RING, borderRadius: RING / 2,
    borderWidth: 2,
  },
  tick: { position: "absolute", left: "50%", marginLeft: -3, width: 6, height: 6, borderRadius: 3 },
  logoCore: {
    width: CORE, height: CORE, borderRadius: CORE / 2,
    backgroundColor: "#F0B90B",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#F0B90B", shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  logoLetter: { fontFamily: "Inter_700Bold", fontSize: 44, color: "#0B0E11", lineHeight: 50 },
  brand: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#FFFFFF", letterSpacing: 1.2 },
  tagline: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#848E9C", marginTop: 6, letterSpacing: 2.5, textTransform: "uppercase" },
  spinnerWrap: { position: "absolute", bottom: 64 },
});
