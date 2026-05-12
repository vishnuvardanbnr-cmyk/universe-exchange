import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather, FontAwesome, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import AppSplash from "@/components/AppSplash";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { WalletProvider } from "@/context/WalletContext";
import { LivePriceProvider } from "@/context/LivePriceContext";
import { EarnProvider } from "@/context/EarnContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { I18nProvider } from "@/context/I18nContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { BinanceProvider } from "@/context/BinanceContext";
import { KrakenProvider } from "@/context/KrakenContext";
import { ActiveExchangeProvider } from "@/context/ActiveExchangeContext";
import { UserWalletProvider } from "@/context/UserWalletContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

SplashScreen.preventAutoHideAsync();
WebBrowser.maybeCompleteAuthSession();

const queryClient = new QueryClient();

const SPLASH_MIN_MS = 1500;

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);

  // Always show the branded splash for at least SPLASH_MIN_MS on cold launch.
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  // Public routes that an unauthenticated user is allowed to view.
  const publicRoutes = new Set(["auth", "terms", "register"]);
  const currentRoot = (segments[0] as string | undefined) ?? "";
  const onPublicRoute = publicRoutes.has(currentRoot);

  const ready = splashDone && !loading;

  useEffect(() => {
    if (!ready) return;
    if (!user && !onPublicRoute) {
      router.replace("/auth");
    } else if (user && (currentRoot === "auth" || currentRoot === "register")) {
      router.replace("/(tabs)");
    }
  }, [ready, user, onPublicRoute, currentRoot]);

  if (!ready) {
    return <AppSplash />;
  }

  // Hide protected content until redirect lands on /auth.
  if (!user && !onPublicRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }} />
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <AuthGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="support" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="terms" options={{ headerShown: false }} />
      </Stack>
    </AuthGate>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
    ...FontAwesome.font,
    ...Ionicons.font,
    ...MaterialIcons.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <I18nProvider>
            <NotificationsProvider>
              <LivePriceProvider>
                <WalletProvider>
                  <EarnProvider>
                    <BinanceProvider>
                      <KrakenProvider>
                        <ActiveExchangeProvider>
                          <UserWalletProvider>
                          <QueryClientProvider client={queryClient}>
                            <GestureHandlerRootView style={{ flex: 1 }}>
                              <KeyboardProvider>
                                <RootLayoutNav />
                              </KeyboardProvider>
                            </GestureHandlerRootView>
                          </QueryClientProvider>
                          </UserWalletProvider>
                        </ActiveExchangeProvider>
                      </KrakenProvider>
                    </BinanceProvider>
                  </EarnProvider>
                </WalletProvider>
              </LivePriceProvider>
            </NotificationsProvider>
            </I18nProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
