import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import Button from "./ui/Button";

export default function ThemeToggle({ className }) {
  const { isDarkMode, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      icon={isDarkMode ? Sun : Moon}
      onClick={toggleTheme}
      aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      className={className}
    />
  );
}
