import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Send, X } from "lucide-react";
import { LogoMark } from "./Logo";
import { cn } from "./ui";
import api from "../services/api.service";

const GREETING = "Namaste! 🙏 Main ChatShop AI hoon. Aap apna naam bata sakte hain, ya poochiye ChatShop aapki dukaan ke liye kya kar sakta hai. (English bhi chalegi.)";
const SUGGESTIONS = ["ChatShop kya hai?", "Isse main kya kya kar sakta hoon?", "Price kitna hai?", "Is there a free trial?"];
const OFFLINE = "Abhi jawab nahi de pa raha. Thodi der baad try kijiye, ya /register par 14 din free try kijiye.";
/**
 * Help widget on the landing page: a 56px floating button that opens a
 * 380 × 560 panel (full width on phones).
 */
export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ from: "bot", text: GREETING }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, typing]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // The server answers (ChatShop AI, or built-in answers without an AI key);
  // it gets the whole chat so it remembers the visitor's name
  const ask = async (question) => {
    const value = question.trim();
    if (!value || typing) return;
    const next = [...messages, { from: "user", text: value }];
    setMessages(next);
    setInput("");
    setTyping(true);
    try {
      const history = next.slice(1).map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text.slice(0, 1000) }));
      const res = await api.post("/assistant/chat", { messages: history.slice(-20) });
      setMessages((list) => [...list, { from: "bot", text: res.data.reply }]);
    } catch (error) {
      setMessages((list) => [...list, { from: "bot", text: error.status === 429 ? error.message : OFFLINE }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="ChatShop AI chat"
          className="fixed inset-x-4 bottom-24 z-50 flex h-[min(560px,calc(100dvh-8rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-popover animate-slide-up sm:inset-x-auto sm:right-6 sm:w-[380px]"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        >
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <LogoMark />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">ChatShop AI</p>
              <p className="text-xs text-fg-muted">Hindi, Hinglish ya English me poochiye</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label="Close help">
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto scrollbar-thin bg-canvas px-4 py-4" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}>
                <p
                  className={cn(
                    "max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    m.from === "user" ? "rounded-br-md bg-accent text-accent-fg" : "rounded-bl-md border border-line bg-surface text-fg"
                  )}
                >
                  {m.text}
                </p>
              </div>
            ))}
            {typing && (
              <div className="flex gap-1 self-start rounded-2xl rounded-bl-md border border-line bg-surface px-3 py-3" aria-label="Typing">
                {[0, 150, 300].map((delay) => (
                  <span key={delay} className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-subtle" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            )}
            {messages.length === 1 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-fg hover:border-line-strong">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-line p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={1000}
                placeholder="Apna sawaal likhiye…"
                aria-label="Your question"
                className="h-10 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
              />
              <button type="submit" disabled={!input.trim()} className="rounded-md p-1.5 text-accent disabled:text-fg-subtle" aria-label="Send">
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-2 text-center text-xs text-fg-muted">
              Ready to try it?{" "}
              <Link to="/register" className="font-medium text-accent hover:underline">
                Start free
              </Link>
            </p>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close help" : "Open help chat"}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-popover transition-colors hover:bg-accent-hover"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
