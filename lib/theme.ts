import { createContext, useContext } from "react";

export const lightColors = {
  bg: "#fafafa",
  surface: "#ffffff",
  border: "#e0e0e0",
  borderLight: "#f0f0f0",
  text: "#212121",
  textSub: "#424242",
  textMuted: "#757575",
  textFaint: "#9e9e9e",
  input: "#fafafa",
  placeholder: "#bdbdbd",
  primary: "#212121",
  primaryText: "#ffffff",
};

export const darkColors = {
  bg: "#121212",
  surface: "#1e1e1e",
  border: "#2c2c2c",
  borderLight: "#252525",
  text: "#f0f0f0",
  textSub: "#cccccc",
  textMuted: "#9e9e9e",
  textFaint: "#555555",
  input: "#2a2a2a",
  placeholder: "#555555",
  primary: "#f0f0f0",
  primaryText: "#121212",
};

export type Colors = typeof lightColors;

export const ThemeContext = createContext<{
  isDark: boolean;
  toggle: () => void;
  colors: Colors;
}>({ isDark: false, toggle: () => {}, colors: lightColors });

export function useTheme() {
  return useContext(ThemeContext);
}
