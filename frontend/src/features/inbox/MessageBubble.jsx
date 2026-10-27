import React, { useState } from "react";
import { AlertCircle, Check, CheckCheck, Clock, Copy, FileText, MapPin, MoreHorizontal, Package, Pencil, RotateCw, Sparkles, Trash2 } from "lucide-react";
import { assetUrl } from "../../config/api.config";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  Tooltip,
} from "../../components/ui";
import { formatTime } from "../../utils/format";

const EDIT_WINDOW_MS = 3 * 60 * 1000;

const formatSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Delivery ticks: queued (clock), sent (one), delivered (two), read (two, bright)
function StatusTicks({ status }) {
  const label = { queued: "Sending", sent: "Sent", delivered: "Delivered", read: "Read" }[status];
  if (!label) return null;
  const Icon = status === "queued" ? Clock : status === "sent" ? Check : CheckCheck;
  return (
    <Tooltip content={label}>
      <span className={cn("inline-flex", status === "read" ? "opacity-100" : "opacity-70")} aria-label={label}>
        <Icon className="h-3.5 w-3.5" strokeWidth={status === "read" ? 2.75 : 2} />
      </span>
    </Tooltip>
  );
}

function MediaContent({ message, outgoing }) {
  const { type, content = {} } = message;
  const url = assetUrl(content.mediaUrl);

  if ((type === "image" || type === "sticker") && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={content.caption || content.fileName || "Image"}
          className={cn("rounded-lg object-cover", type === "sticker" ? "h-28 w-28" : "max-h-72 w-full")}
          loading="lazy"
        />
      </a>
    );
  }
  if (type === "video" && url) {
    return <video src={url} controls className="max-h-72 w-full rounded-lg" preload="metadata" />;
  }
  if (type === "audio" && url) {
    return <audio src={url} controls className="h-10 w-60 max-w-full" preload="metadata" />;
  }
  if (type === "document" && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "flex items-center gap-3 rounded-lg border p-2.5",
          outgoing ? "border-white/20 bg-white/10" : "border-line bg-surface"
        )}
      >
        <FileText className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{content.fileName || "Document"}</span>
          <span className="text-xs opacity-75">{formatSize(content.fileSize)}</span>
        </span>
      </a>
    );
  }
  if (type === "location" && content.location?.latitude != null) {
    const { latitude, longitude, name, address } = content.location;
    return (
      <a
        href={`https://maps.google.com/?q=${latitude},${longitude}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 underline-offset-2 hover:underline"
      >
        <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
        {name || address || "Open location"}
      </a>
    );
  }
  if (["image", "video", "audio", "document", "sticker"].includes(type)) {
    return <span className="italic opacity-75">[{type} unavailable]</span>;
  }
  return null;
}

export default function MessageBubble({ message, grouped, onRetry, onEdit, onDelete }) {
  const outgoing = message.direction === "outgoing";
  const failed = message.status === "failed";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content?.text || "");
  const [retrying, setRetrying] = useState(false);

  const text = message.content?.text || message.content?.caption;
  const canEdit =
    outgoing && message.type === "text" && !failed && Date.now() - new Date(message.createdAt).getTime() < EDIT_WINDOW_MS;

  const saveEdit = async () => {
    if (!draft.trim()) return;
    await onEdit(message, draft.trim());
    setEditing(false);
  };

  const retry = async () => {
    setRetrying(true);
    try {
      await onRetry(message);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className={cn("group flex flex-col", outgoing ? "items-end" : "items-start", grouped ? "mt-0.5" : "mt-3")}>
      <div className={cn("flex max-w-[85%] items-center gap-1 sm:max-w-[70%]", outgoing && "flex-row-reverse")}>
        <div
          className={cn(
            "min-w-0 rounded-2xl px-3 py-2 text-sm leading-relaxed",
            outgoing ? "bg-accent text-accent-fg" : "bg-surface border border-line text-fg",
            outgoing ? (grouped ? "rounded-tr-md" : "rounded-br-md") : grouped ? "rounded-tl-md" : "rounded-bl-md",
            failed && "opacity-80 ring-1 ring-danger"
          )}
        >
          {message.type === "product" && (
            <span className={cn("mb-1 flex items-center gap-1.5 text-xs font-medium", outgoing ? "opacity-80" : "text-fg-muted")}>
              <Package className="h-3.5 w-3.5" aria-hidden="true" /> Product
            </span>
          )}
          <MediaContent message={message} outgoing={outgoing} />

          {editing ? (
            <div className="flex min-w-[220px] flex-col gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                autoFocus
                aria-label="Edit message"
                className="w-full resize-none rounded-md bg-white/15 px-2 py-1 text-sm text-inherit outline-none"
              />
              <div className="flex justify-end gap-1.5">
                <button className="rounded px-2 py-0.5 text-xs hover:bg-white/15" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button className="rounded bg-white/20 px-2 py-0.5 text-xs font-medium hover:bg-white/30" onClick={saveEdit}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            text && (
              <p className={cn("whitespace-pre-wrap break-words", message.content?.mediaUrl && "mt-1.5")}>{text}</p>
            )
          )}

          <span
            className={cn(
              "mt-1 flex items-center justify-end gap-1 text-[11px] tabular-nums",
              outgoing ? "text-accent-fg/80" : "text-fg-muted"
            )}
          >
            {message.isAIGenerated && (
              <span className="inline-flex items-center gap-0.5" title="Written by AI">
                <Sparkles className="h-3 w-3" aria-hidden="true" /> AI
              </span>
            )}
            {message.isEdited && <span>edited</span>}
            {formatTime(message.createdAt)}
            {outgoing && <StatusTicks status={message.status} />}
          </span>
        </div>

        <DropdownMenu>
          <DropdownTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              icon={MoreHorizontal}
              aria-label="Message actions"
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            />
          </DropdownTrigger>
          <DropdownContent align={outgoing ? "end" : "start"}>
            {text && (
              <DropdownItem icon={Copy} onSelect={() => navigator.clipboard?.writeText(text)}>
                Copy text
              </DropdownItem>
            )}
            {canEdit && (
              <DropdownItem icon={Pencil} onSelect={() => setEditing(true)}>
                Edit
              </DropdownItem>
            )}
            <DropdownItem icon={Trash2} danger onSelect={() => onDelete(message)}>
              Delete for me
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>

      {failed && (
        <div className="mt-1 flex max-w-[85%] items-start gap-1.5 text-xs text-danger-fg sm:max-w-[70%]" role="alert">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0">
            <span className="font-medium">Not delivered</span>
            {message.errorDetails?.message && <span className="text-fg-muted"> · {message.errorDetails.message}</span>}
            {" · "}
            <button onClick={retry} disabled={retrying} className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline disabled:opacity-60">
              <RotateCw className={cn("h-3 w-3", retrying && "animate-spin")} aria-hidden="true" />
              {retrying ? "Retrying…" : "Retry"}
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
