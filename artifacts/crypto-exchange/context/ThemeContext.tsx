import React, { createContext, useContext, useState } from "react";
import colors from "@/constants/colors";

type ColorScheme = "light" | "dark";
type ThemeColors = typeof colors.light & { radius: number };

interface ThemeContextType {
  scheme: ColorScheme;
  colors: ThemeColors;
  toggleScheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  scheme: "dark",
  colors: { ...colors.dark, radius: colors.radius },
  toggleScheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setScheme] = useState<ColorScheme>("dark");
  const palette = scheme === "dark" ? colors.dark : colors.light;
  const value: ThemeContextType = {
    scheme,
    colors: { ...palette, radius: colors.radius },
    toggleScheme: () => setScheme((s) => (s === "dark" ? "light" : "dark")),
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
