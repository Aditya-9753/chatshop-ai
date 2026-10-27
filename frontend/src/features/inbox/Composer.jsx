import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Mic, Package, Paperclip, Search, Send, Square, Trash2, Zap } from "lucide-react";
import productService from "../../services/product.service";
import { assetUrl } from "../../config/api.config";
import { toast } from "../../components/Toast";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  EmptyState,
  Modal,
  Skeleton,
  Tooltip,
} from "../../components/ui";
import { formatCurrency } from "../../utils/format";
import { QUICK_REPLIES } from "./quickReplies";
import useVoiceRecorder from "./useVoiceRecorder";

const DAY_MS = 24 * 60 * 60 * 1000;

function ProductPicker({ open, onOpenChange, onPick }) {
  const [products, setProducts] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open || products) return;
    productService
      .getProducts({ limit: 500 })
      .then((res) => setProducts((res.data || []).filter((p) => p.isActive !== false)))
      .catch(() => setProducts([]));
  }, [open, products]);

  const visible = (products || []).filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Send a product" description="Shares the name, price and description in the chat.">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products"
          aria-label="Search products"
          autoFocus
          className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-fg outline-none focus:border-accent focus:ring-3 focus:ring-accent/15"
        />
      </div>
      <div className="max-h-80 overflow-y-auto scrollbar-thin -mx-1">
        {!products ? (
          <div className="space-y-2 p-1">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState icon={Package} title="No products found" description="Add products in Catalog first." />
        ) : (
          visible.map((product) => (
            <button
              key={product._id}
              onClick={() => onPick(product)}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-surface-2 transition-colors"
            >
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-line bg-surface-2">
                {product.images?.[0] && <img src={assetUrl(product.images[0])} alt="" className="h-full w-full object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">{product.name}</span>
                <span className="text-caption text-fg-muted">
                  {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                </span>
              </span>
              <span className="text-sm font-medium tabular-nums text-fg">{formatCurrency(product.price)}</span>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}

export default function Composer({ conversation, lastIncomingAt, disabledReason, onSendText, onSendFile, onSendVoice, onSendProduct }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const fileRef = useRef(null);
  const textRef = useRef(null);
  const recorder = useVoiceRecorder();

  // WhatsApp only allows free-form replies within 24h of the customer's last message
  const outsideWindow =
    conversation.platform === "whatsapp" && lastIncomingAt && Date.now() - new Date(lastIncomingAt).getTime() > DAY_MS;

  useEffect(() => {
    setText("");
    textRef.current?.focus();
  }, [conversation._id]);

  // Grow the textarea with its content, up to ~6 lines
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const run = async (action) => {
    setSending(true);
    try {
      await action();
    } finally {
      setSending(false);
      textRef.current?.focus();
    }
  };

  const send = () => {
    const value = text.trim();
    if (!value || sending) return;
    setText("");
    run(() => onSendText(value));
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const caption = text.trim();
    setText("");
    run(() => onSendFile(file, caption));
  };

  const stopAndSend = async () => {
    const blob = await recorder.stop();
    if (blob) run(() => onSendVoice(blob));
  };

  if (disabledReason) {
    return (
      <div className="border-t border-line bg-surface px-4 py-4 text-center text-caption text-fg-muted">{disabledReason}</div>
    );
  }

  return (
    <div className="shrink-0 border-t border-line bg-surface px-3 pb-3 pt-2 sm:px-4">
      {outsideWindow && (
        <p className="mb-2 flex items-start gap-1.5 text-xs text-warning-fg">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          More than 24 hours since this customer's last message. WhatsApp may reject free-form replies until they
          message again.
        </p>
      )}

      {recorder.recording ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-danger" aria-hidden="true" />
          <span className="flex-1 text-sm tabular-nums text-fg" aria-live="polite">
            Recording {Math.floor(recorder.seconds / 60)}:{String(recorder.seconds % 60).padStart(2, "0")}
          </span>
          <Button variant="ghost" size="sm" icon={Trash2} onClick={recorder.cancel}>
            Discard
          </Button>
          <Button size="sm" icon={Square} onClick={stopAndSend}>
            Send voice note
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-1 rounded-xl border border-line bg-surface px-1.5 py-1.5 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15 transition-colors">
          <DropdownMenu>
            <Tooltip content="Quick replies">
              <DropdownTrigger asChild>
                <Button variant="ghost" size="icon-sm" icon={Zap} aria-label="Quick replies" />
              </DropdownTrigger>
            </Tooltip>
            <DropdownContent align="start" side="top" className="max-h-80 w-80 overflow-y-auto scrollbar-thin">
              {QUICK_REPLIES.map((group, index) => (
                <React.Fragment key={group.category}>
                  {index > 0 && <DropdownSeparator />}
                  <DropdownLabel>{group.category}</DropdownLabel>
                  {group.replies.map((reply) => (
                    <DropdownItem key={reply.title} onSelect={() => setText(reply.text)} className="flex-col items-start gap-0">
                      <span className="text-sm font-medium">{reply.title}</span>
                      <span className="line-clamp-1 text-xs text-fg-muted">{reply.text}</span>
                    </DropdownItem>
                  ))}
                </React.Fragment>
              ))}
            </DropdownContent>
          </DropdownMenu>

          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Write a reply…"
            aria-label="Message. Enter to send, Shift+Enter for a new line"
            className="max-h-40 min-h-[32px] flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm text-fg outline-none placeholder:text-fg-subtle"
          />

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            onChange={onFile}
          />
          <Tooltip content="Attach a file">
            <Button variant="ghost" size="icon-sm" icon={Paperclip} onClick={() => fileRef.current?.click()} aria-label="Attach a file" />
          </Tooltip>
          <Tooltip content="Send a product">
            <Button variant="ghost" size="icon-sm" icon={Package} onClick={() => setProductsOpen(true)} aria-label="Send a product" />
          </Tooltip>
          {text.trim() ? (
            <Button size="icon-sm" icon={Send} onClick={send} loading={sending} aria-label="Send message" />
          ) : (
            <Tooltip content="Record a voice note">
              <Button
                variant="ghost"
                size="icon-sm"
                icon={Mic}
                loading={sending}
                onClick={() =>
                  recorder.start().catch(() => toast.error("Microphone access is blocked. Allow it in your browser settings."))
                }
                aria-label="Record a voice note"
                className={cn(sending && "text-accent")}
              />
            </Tooltip>
          )}
        </div>
      )}

      <ProductPicker
        open={productsOpen}
        onOpenChange={setProductsOpen}
        onPick={(product) => {
          setProductsOpen(false);
          run(() => onSendProduct(product));
        }}
      />
    </div>
  );
}
