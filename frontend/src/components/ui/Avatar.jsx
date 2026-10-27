import React, { useState } from "react";
import { cn } from "./cn";
import { ChannelIcon } from "./Badge";
import { assetUrl } from "../../config/api.config";

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

export const initialsOf = (name = "") =>
  name
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";

/**
 * Round avatar: image when available, else initials on a neutral tint.
 * `platform` adds a small channel mark in the corner.
 */
export function Avatar({ name, src, size = "md", platform, className }) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-full",
          "bg-surface-3 font-semibold text-fg-muted select-none",
          SIZES[size]
        )}
      >
        {showImage ? (
          <img src={assetUrl(src)} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
        ) : (
          <span aria-hidden="true">{initialsOf(name)}</span>
        )}
      </span>
      {platform && (
        <span className={cn("absolute rounded-full bg-surface", size === "xs" ? "-bottom-1 -right-1 p-px" : "-bottom-0.5 -right-0.5 p-0.5")}>
          <ChannelIcon platform={platform} className={size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} />
        </span>
      )}
    </span>
  );
}
