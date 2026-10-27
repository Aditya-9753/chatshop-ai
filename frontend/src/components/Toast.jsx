import React from "react";
import { Toaster, toast } from "sonner";
import { useTheme } from "../context/ThemeContext";

// Stacked toasts, bottom-right, styled with the design tokens
export const ToastProvider = ({ children }) => {
  const { isDarkMode } = useTheme();

  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        theme={isDarkMode ? "dark" : "light"}
        closeButton
        toastOptions={{
          classNames: {
            toast: "!bg-surface !border-line !text-fg !rounded-xl !shadow-popover !font-sans",
            description: "!text-fg-muted",
            closeButton: "!bg-surface !border-line !text-fg-muted",
          },
        }}
      />
    </>
  );
};

const api = {
  success: (message, options) => toast.success(message, options),
  error: (message, options) => toast.error(message, options),
  info: (message, options) => toast(message, options),
  warning: (message, options) => toast.warning(message, options),
};

// Same API the pages already use: const toast = useToast(); toast.success("…")
export const useToast = () => api;

export { toast };
