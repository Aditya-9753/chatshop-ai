import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Send, X } from "lucide-react";
import { LogoMark } from "./Logo";
import { cn } from "./ui";
import { API_CONFIG } from "../config/api.config";

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
  const requestRef = useRef(null);
  const activeRequestIdRef = useRef(null);

  useEffect(() => () => {
    const id = activeRequestIdRef.current;
    if (id) fetch(`${API_CONFIG.BASE_URL}/assistant/requests/${id}`, { method: "DELETE", keepalive: true }).catch(() => {});
    requestRef.current?.abort();
  }, []);

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
    setMessages([...next, { from: "bot", text: "" }]);
    setTyping(true);
    const controller = new AbortController();
    requestRef.current = controller;
    let requestId = null;
    let completed = false;
    try {
      const history = next.slice(1).map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text.slice(0, 1000) }));
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_CONFIG.BASE_URL}/assistant/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ messages: history.slice(-20) }),
        signal: controller.signal,
      });
      requestId = response.headers.get("X-Request-Id");
      activeRequestIdRef.current = requestId;
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        requestId = data.requestId || null;
        throw { status: response.status, message: data.message, requestId };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const applyEvent = (frame) => {
        const event = frame.match(/^event: (.+)$/m)?.[1];
        const dataLine = frame.match(/^data: (.+)$/m)?.[1];
        if (!event || !dataLine) return;
        const data = JSON.parse(dataLine);
        if (event === "request.accepted") {
          requestId = data.requestId;
          activeRequestIdRef.current = data.requestId;
        } else if (event === "answer.delta") {
          setMessages((list) => list.map((message, index) => index === list.length - 1 && message.from === "bot" ? { ...message, text: message.text + data.text } : message));
        } else if (event === "answer.replace") {
          setMessages((list) => list.map((message, index) => index === list.length - 1 && message.from === "bot" ? { ...message, text: data.text } : message));
        } else if (event === "request.completed") {
          completed = true;
          setMessages((list) => list.map((message, index) => index === list.length - 1 && message.from === "bot" ? { ...message, text: data.reply } : message));
        } else if (event === "request.failed") {
          throw new Error("The assistant could not answer right now.");
        }
      };
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() || "";
        frames.forEach(applyEvent);
        if (done) break;
      }
      if (!completed) throw new Error("The assistant stream ended before completing the answer.");
    } catch (error) {
      if (error.name !== "AbortError") {
        let recoveredReply = null;
        const serverRequestId = error.requestId || requestId;
        if (serverRequestId && !controller.signal.aborted) {
          const token = localStorage.getItem("token");
          const deadline = Date.now() + 24000;
          while (Date.now() < deadline && !controller.signal.aborted) {
            try {
              const statusResponse = await fetch(`${API_CONFIG.BASE_URL}/assistant/requests/${serverRequestId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal,
              });
              if (statusResponse.ok) {
                const status = (await statusResponse.json()).data;
                if (status.status === "completed") { recoveredReply = status.reply; break; }
                if (["failed", "cancelled"].includes(status.status)) break;
              } else if (statusResponse.status === 404) break;
            } catch { break; }
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
        const message = recoveredReply || (error.status >= 400 && error.status < 500 ? error.message : OFFLINE);
        setMessages((list) => list.map((item, index) => index === list.length - 1 && item.from === "bot" ? { ...item, text: message } : item));
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (activeRequestIdRef.current === requestId) activeRequestIdRef.current = null;
      setTyping(false);
    }
  };

  const stopAnswer = () => {
    const requestId = activeRequestIdRef.current;
    if (requestId) fetch(`${API_CONFIG.BASE_URL}/assistant/requests/${requestId}`, { method: "DELETE", keepalive: true }).catch(() => {});
    const controller = requestRef.current;
    requestRef.current = null;
    activeRequestIdRef.current = null;
    controller?.abort();
    setMessages((list) => list.map((message, index) => index === list.length - 1 && message.from === "bot" && !message.text ? { ...message, text: "Response stopped." } : message));
    setTyping(false);
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
              <div className="flex items-center gap-3 self-start rounded-2xl rounded-bl-md border border-line bg-surface px-3 py-2" aria-label="Typing">
                <div className="flex gap-1" aria-hidden="true">
                  {[0, 150, 300].map((delay) => (
                    <span key={delay} className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-subtle" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
                <button type="button" onClick={stopAnswer} className="text-xs text-fg-muted hover:text-fg">Stop</button>
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
