import React from "react";
import { useTheme } from "../context/ThemeContext";

const Input = ({
  label,
  type = "text",
  name,
  value,
  onChange,
  placeholder,
  required = false,
  error,
  icon: Icon,
  disabled = false,
  className = "",
}) => {
  const { isDarkMode } = useTheme();

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          className={`block text-sm font-semibold mb-2 ${
            isDarkMode ? "text-gray-300" : "text-gray-700"
          }`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div
            className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
              isDarkMode ? "text-gray-500" : "text-gray-400"
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`w-full ${
            Icon ? "pl-10" : "pl-4"
          } pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all ${
            error
              ? "border-red-500"
              : isDarkMode
              ? "border-gray-600"
              : "border-gray-300"
          } ${
            isDarkMode
              ? "bg-gray-700 text-white placeholder-gray-400"
              : "bg-white text-gray-900 placeholder-gray-400"
          } ${
            disabled
              ? isDarkMode
                ? "opacity-50 cursor-not-allowed"
                : "bg-gray-100 cursor-not-allowed"
              : ""
          }`}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default Input;
