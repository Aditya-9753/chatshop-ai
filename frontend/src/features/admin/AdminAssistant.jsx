import React, { useState } from "react";
import { Activity, AlertTriangle, Bot, CheckCircle2, KeyRound, MessageSquare, RotateCcw, Send, Timer, Zap } from "lucide-react";
import api from "../../services/api.service";
import { Alert, Badge, Button, Card, CardBody, CardHeader, cn, DetailRow, ErrorState, PageHeader, Skeleton, StatCard } from "../../components/ui";
import { ChartCard } from "../../components/charts/Charts";
import { formatDateTime, formatNumber } from "../../utils/format";
import { useData } from "./billing/shared";

const PROVIDERS = { gemini: "Gemini (Google)", claude: "Claude (Anthropic)" };

// What each failure means and what to do about it
const ERRORS = {
  QUOTA: ["Free limit or rate limit reached", "Wait for the limit to reset (Gemini's free tier resets daily), or switch to a paid key. Visitors get built-in answers meanwhile."],
  KEY: ["API key rejected", "Check the key in backend/.env, or create a new one, then restart the server."],
  MODEL: ["Model not available for this key", "Set GEMINI_MODEL in backend/.env to a model your key can use."],
  BUSY: ["AI service busy", "Usually temporary. The next model in the list is tried by itself; visitors get built-in answers if all are busy."],
  NETWORK: ["Couldn't reach the AI service", "Check the server's internet connection."],
  OTHER: ["Unexpected error", "See the message below and the backend terminal."],
};

const seconds = (ms) => (ms === null || ms === undefined ? "—" : `${(ms / 1000).toFixed(1)}s`);
const pct = (part, total) => (total ? `${Math.round((part / total) * 100)}%` : "—");

// Working, problem, or no AI at all, from the last success and failure
function health(s) {
  if (s.switchedOff) return { tone: "neutral", icon: Bot, title: "AI switched off", detail: "Visitors get the built-in answers (ASSISTANT_PROVIDER=off)." };
  if (!s.active) return { tone: "neutral", icon: KeyRound, title: "No AI key: built-in answers", detail: "Add GEMINI_API_KEY or ANTHROPIC_API_KEY in backend/.env and restart the server to turn the AI on." };
  const failedLast = s.lastError && (!s.lastSuccess || new Date(s.lastError.at) > new Date(s.lastSuccess.at));
  if (failedLast) {
    const [title] = ERRORS[s.lastError.code] || ERRORS.OTHER;
    return { tone: "danger", icon: AlertTriangle, title: `Problem: ${title}`, detail: "The last AI call failed, so visitors got built-in answers. Check it with the test chat." };
  }
  if (!s.lastSuccess) return { tone: "warning", icon: Activity, title: "Ready, not used yet", detail: "No visitor has asked anything yet. Send a message in the test chat to check it." };
  return { tone: "success", icon: CheckCircle2, title: "Working", detail: `Last AI answer ${formatDateTime(s.lastSuccess.at)} in ${seconds(s.lastSuccess.ms)}.` };
}

const TONE_BOX = {
  success: "border-success/30 bg-success-soft text-success-fg",
  warning: "border-warning/30 bg-warning-soft text-warning-fg",
  danger: "border-danger/30 bg-danger-soft text-danger-fg",
  neutral: "border-line bg-surface-2 text-fg",
};

function StatusCard({ s }) {
  const h = health(s);
  return (
    <Card>
      <CardHeader title="Status" description="Settings come from backend/.env; keys are never shown here." />
      <CardBody className="flex flex-col gap-4">
        <div className={cn("flex items-start gap-3 rounded-lg border p-3", TONE_BOX[h.tone])}>
          <h.icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{h.title}</p>
            <p className="text-caption opacity-90">{h.detail}</p>
          </div>
        </div>
        <dl className="divide-y divide-line">
          <DetailRow label="AI in use">{s.active ? <Badge tone="accent">{PROVIDERS[s.active]}</Badge> : <Badge>Built-in answers</Badge>}</DetailRow>
          <DetailRow label="Setting">
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">ASSISTANT_PROVIDER={s.setting || "(auto)"}</code>
          </DetailRow>
          <DetailRow label="Gemini key">{s.keys.gemini ? <Badge tone="success" dot>Set</Badge> : <Badge dot>Not set</Badge>}</DetailRow>
          <DetailRow label="Claude key">{s.keys.claude ? <Badge tone="success" dot>Set</Badge> : <Badge dot>Not set</Badge>}</DetailRow>
          <DetailRow label="Models">
            {s.active === "claude" ? s.models.claude : s.active === "gemini" ? s.models.gemini.join(" → ") : "—"}
          </DetailRow>
          <DetailRow label="Limit per visitor">{s.rateLimitPerMinute} messages a minute</DetailRow>
          <DetailRow label="Last AI answer">
            {s.lastSuccess ? `${formatDateTime(s.lastSuccess.at)} · ${s.lastSuccess.model || s.lastSuccess.provider} · ${seconds(s.lastSuccess.ms)}` : "Never"}
          </DetailRow>
        </dl>
        {s.lastError && (
          <div className="rounded-lg border border-line p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Last error · {formatDateTime(s.lastError.at)}</p>
            <p className="mt-1 text-sm font-medium text-fg">
              {(ERRORS[s.lastError.code] || ERRORS.OTHER)[0]}
              {s.lastError.status ? <span className="font-normal text-fg-muted"> (HTTP {s.lastError.status}, {PROVIDERS[s.lastError.provider] || s.lastError.provider})</span> : null}
            </p>
            <p className="mt-1 text-caption text-fg-muted">{(ERRORS[s.lastError.code] || ERRORS.OTHER)[1]}</p>
            <p className="mt-2 break-words rounded bg-surface-2 px-2 py-1.5 font-mono text-xs text-fg-muted">{s.lastError.message}</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// Ask the assistant from the admin panel; these messages aren't counted
function TestChat({ onDone }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const send = async (text) => {
    const value = text.trim();
    if (!value || busy) return;
    const next = [...messages, { role: "user", content: value }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await api.post("/admin/assistant/test", { messages: next.map(({ role, content }) => ({ role, content: content.slice(0, 1000) })).slice(-20) });
      setMessages([...next, { role: "assistant", content: res.data.reply, meta: res.data }]);
      onDone();
    } catch (e) {
      setError(e.message);
      setMessages(messages);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Test chat"
        description="Ask what a visitor would. Each answer shows who replied and how long it took. Not counted in the numbers."
        action={
          messages.length > 0 && (
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setMessages([])}>
              Clear
            </Button>
          )
        }
      />
      <CardBody className="flex flex-col gap-3">
        <div className="flex max-h-96 min-h-[160px] flex-col gap-2 overflow-y-auto rounded-lg bg-canvas p-3 scrollbar-thin">
          {messages.length === 0 && (
            <div className="m-auto flex flex-wrap justify-center gap-1.5">
              {["mera naam Aditya hai", "ChatShop kya hai?", "Isse kya kya kar sakta hoon?", "What does it cost?"].map((q) => (
                <button key={q} onClick={() => send(q)} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-fg hover:border-line-strong">
                  {q}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
              <p
                className={cn(
                  "max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm",
                  m.role === "user" ? "rounded-br-md bg-accent text-accent-fg" : "rounded-bl-md border border-line bg-surface text-fg"
                )}
              >
                {m.content}
              </p>
              {m.meta && (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
                  {m.meta.source === "ai" ? (
                    <Badge tone="success">AI · {m.meta.model || m.meta.provider}</Badge>
                  ) : (
                    <Badge tone={m.meta.error || m.meta.declined ? "warning" : "neutral"}>Built-in answer</Badge>
                  )}
                  <span>{seconds(m.meta.ms)}</span>
                  {m.meta.error && <span>· AI failed: {(ERRORS[m.meta.error.code] || ERRORS.OTHER)[0]}</span>}
                  {m.meta.declined && <span>· AI's safety filter declined</span>}
                </p>
              )}
            </div>
          ))}
          {busy && <p className="text-xs text-fg-muted">Thinking…</p>}
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
            placeholder="Type a question…"
            aria-label="Test question"
            className="h-9 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-fg outline-none focus:border-accent"
          />
          <Button type="submit" icon={Send} loading={busy} disabled={!input.trim()}>
            Send
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

// Super Admin: the website's ChatShop AI chat, is it working and how well
export default function AdminAssistant() {
  const { data: s, error, reload } = useData(() => api.get("/admin/assistant/status"), []);

  if (error) return <ErrorState title="Couldn't load the AI assistant" description={error} onRetry={reload} />;
  return (
    <div>
      <PageHeader
        title="AI Assistant"
        description="The ChatShop AI chat on the website: which AI answers and how it's doing. Visitors' messages aren't stored, only counts."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Questions today" icon={MessageSquare} loading={!s} value={formatNumber(s?.today.total)} deltaNote={s && `${formatNumber(s.period.total)} in ${s.period.days} days`} />
        <StatCard label="Answered by AI" icon={Bot} loading={!s} value={formatNumber(s?.today.ai)} deltaNote={s && `${pct(s.today.ai, s.today.total)} of today`} />
        <StatCard label="Built-in answers" icon={Zap} loading={!s} value={formatNumber(s?.today.rules)} deltaNote="When there's no AI or it fails" />
        <StatCard label="AI failures" icon={AlertTriangle} loading={!s} value={formatNumber(s?.today.failures)} deltaNote={s && (s.today.declined ? `${s.today.declined} declined by safety filter` : `${formatNumber(s.period.failures)} in ${s.period.days} days`)} />
        <StatCard label="AI reply time" icon={Timer} loading={!s} value={seconds(s?.today.avgMs ?? s?.period.avgMs)} deltaNote={s && `Average, ${s.today.avgMs !== null ? "today" : `last ${s.period.days} days`}`} />
      </div>

      {!s ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-6">
            <StatusCard s={s} />
            <ChartCard
              title="Questions per day"
              description={`Last ${s.period.days} days: answered by the AI vs built-in answers`}
              data={s.series}
              series={[
                { key: "ai", label: "AI", color: "var(--chart-1)" },
                { key: "rules", label: "Built-in", color: "var(--chart-2)" },
              ]}
              stacked
            />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <TestChat onDone={reload} />
            <Card>
              <CardHeader title="How it works" />
              <CardBody>
                <ol className="list-decimal space-y-1.5 pl-4 text-caption text-fg">
                  <li>A visitor asks in the chat on the landing page.</li>
                  <li>The AI set in backend/.env (Gemini or Claude) answers from ChatShop's real features and live plan prices, in the visitor's language, and greets them by name.</li>
                  <li>If a Gemini model is busy, the next one in the list is tried.</li>
                  <li>With no key, or if the AI fails or declines, the built-in answers reply, so the chat never stops working.</li>
                  <li>Each visitor can ask {s.rateLimitPerMinute} questions a minute, which keeps AI costs down.</li>
                </ol>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
