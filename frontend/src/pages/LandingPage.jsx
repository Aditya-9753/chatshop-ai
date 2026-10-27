import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Menu, Plus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import Chatbot from "../components/Chatbot";
import ProductPreview from "../components/marketing/ProductPreview";
import { InboxVisual, InsightsVisual, OrdersVisual } from "../components/marketing/FeatureVisuals";
import { Badge, Button, ChannelIcon, cn } from "../components/ui";
import { FAQS, PRICING, TRIAL_DAYS } from "../features/marketing/content";
import { formatCurrency } from "../utils/format";
import usePublicSettings from "../hooks/usePublicSettings";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

function Header() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="text-sm text-fg-muted transition-colors hover:text-fg">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <Button as={Link} to="/dashboard" size="md">
              Open dashboard
            </Button>
          ) : (
            <>
              <Button as={Link} to="/login" variant="ghost" className="hidden sm:inline-flex">
                Log in
              </Button>
              <Button as={Link} to="/register" className="hidden sm:inline-flex">
                Start free trial
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" icon={open ? X : Menu} onClick={() => setOpen(!open)} className="md:hidden" aria-label="Menu" aria-expanded={open} />
        </div>
      </div>
      {open && (
        <nav aria-label="Mobile" className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-2 text-base text-fg hover:bg-surface-2">
              {item.label}
            </a>
          ))}
          {!isAuthenticated && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button as={Link} to="/login" variant="secondary">
                Log in
              </Button>
              <Button as={Link} to="/register">
                Start free
              </Button>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* The page's one gradient: a soft glow behind the product */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[32%] h-[520px] w-[900px] max-w-[160vw] -translate-x-1/2 rounded-full bg-accent opacity-[0.12] blur-[120px] dark:opacity-[0.18]"
      />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
        <Badge tone="accent" className="mx-auto">
          WhatsApp · Instagram · Facebook in one inbox
        </Badge>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-fg sm:text-5xl lg:text-6xl">
          Sell on chat without losing a single order
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
          ChatShop puts every customer conversation, order and product in one place, so small shops can reply faster and
          know exactly what's selling.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button as={Link} to="/register" size="lg" iconRight={ArrowRight}>
            Start {TRIAL_DAYS}-day free trial
          </Button>
          <Button as="a" href="#features" size="lg" variant="secondary">
            See how it works
          </Button>
        </div>
        <p className="mt-3 text-sm text-fg-muted">No card needed. Set up in under an hour.</p>
        <div className="mx-auto mt-14 max-w-4xl">
          <ProductPreview className="text-left" />
        </div>
      </div>
    </section>
  );
}

function ChannelStrip() {
  return (
    <section aria-label="Works with" className="border-y border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-center sm:gap-10 sm:px-6">
        <span className="text-sm text-fg-muted">Works with</span>
        {[
          ["whatsapp", "WhatsApp Business"],
          ["instagram", "Instagram Direct"],
          ["facebook", "Facebook Messenger"],
        ].map(([platform, label]) => (
          <span key={platform} className="flex items-center gap-2 text-base font-medium text-fg">
            <ChannelIcon platform={platform} className="h-5 w-5" /> {label}
          </span>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  {
    eyebrow: "Inbox",
    title: "Every chat, every channel, one screen",
    body: "Messages from WhatsApp, Instagram and Facebook arrive the moment they're sent. Reply with saved answers, attachments, voice notes or a product card, and watch each message go from sent to delivered to read.",
    points: ["Real-time, no refreshing", "Delivery ticks and one-click retry", "Customer details, tags and notes beside the chat"],
    visual: InboxVisual,
  },
  {
    eyebrow: "Orders",
    title: "Turn a conversation into an order",
    body: "Create an order straight from the chat, track it from pending to delivered, and print a clean invoice with your GSTIN. Filter by status and update many orders at once.",
    points: ["Pending, paid, shipped and delivered at a glance", "Printable invoices", "Low-stock warnings before you oversell"],
    visual: OrdersVisual,
  },
  {
    eyebrow: "Insights",
    title: "Know what's working this week",
    body: "Revenue, orders, new customers and how fast you reply, each compared with the period before. See which channel and which products bring in the money.",
    points: ["Week-over-week comparisons", "Median response time", "Top products and customers"],
    visual: InsightsVisual,
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="flex flex-col gap-20 sm:gap-28">
        {FEATURES.map((feature, i) => (
          <div key={feature.title} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className={cn(i % 2 === 1 && "lg:order-2")}>
              <p className="text-sm font-medium text-accent">{feature.eyebrow}</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg">{feature.title}</h2>
              <p className="mt-4 text-base leading-relaxed text-fg-muted">{feature.body}</p>
              <ul className="mt-6 flex flex-col gap-2.5">
                {feature.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-base text-fg">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-line bg-surface-2/60 p-4 sm:p-8">
              <feature.visual />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-fg">Simple pricing</h2>
          <p className="mt-3 text-base text-fg-muted">
            Prices in INR, excluding GST. Every workspace starts with a {TRIAL_DAYS}-day free trial.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRICING.map((plan) => (
            <div
              key={plan.key}
              className={cn("relative flex flex-col rounded-2xl border p-6", plan.popular ? "border-accent bg-accent-soft/30" : "border-line bg-canvas")}
            >
              {plan.popular && (
                <Badge tone="accent" className="absolute -top-2.5 left-6">
                  Most popular
                </Badge>
              )}
              <h3 className="text-base font-semibold text-fg">{plan.name}</h3>
              <p className="mt-1 text-sm text-fg-muted">{plan.blurb}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tabular-nums tracking-tight text-fg">{formatCurrency(plan.price)}</span>
                <span className="text-sm text-fg-muted">{plan.oneTime ? "one time" : "/month"}</span>
              </p>
              <p className="text-sm tabular-nums text-fg-muted line-through">{formatCurrency(plan.originalPrice)}</p>
              <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-fg">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button as={Link} to="/register" variant={plan.popular ? "primary" : "secondary"} className="mt-8 w-full">
                {plan.oneTime ? "Get started" : "Start free trial"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <h2 className="text-center text-3xl font-semibold tracking-tight text-fg">Questions, answered</h2>
      <div className="mt-10 divide-y divide-line border-y border-line">
        {FAQS.map((faq) => (
          <details key={faq.q} className="group py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 text-base font-medium text-fg [&::-webkit-details-marker]:hidden">
              {faq.q}
              <Plus className="h-4 w-4 shrink-0 text-fg-muted transition-transform duration-200 group-open:rotate-45" aria-hidden="true" />
            </summary>
            <p className="pb-5 pr-8 text-base leading-relaxed text-fg-muted">{faq.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-fg">Your customers are already messaging. Be ready.</h2>
        <Button as={Link} to="/register" size="lg" iconRight={ArrowRight}>
          Start free trial
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  const { supportEmail, contactPhone } = usePublicSettings();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-fg-muted">The inbox for shops that sell on chat.</p>
          {(supportEmail || contactPhone) && (
            <p className="mt-1 text-sm text-fg-muted">
              {supportEmail && (
                <a href={`mailto:${supportEmail}`} className="hover:text-fg">
                  {supportEmail}
                </a>
              )}
              {supportEmail && contactPhone && " · "}
              {contactPhone && (
                <a href={`tel:${contactPhone}`} className="hover:text-fg">
                  {contactPhone}
                </a>
              )}
            </p>
          )}
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg-muted">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-fg">
              {item.label}
            </a>
          ))}
          <Link to="/login" className="hover:text-fg">
            Log in
          </Link>
          <Link to="/admin/login" className="hover:text-fg">
            Admin
          </Link>
        </nav>
        <p className="text-sm text-fg-muted">© {new Date().getFullYear()} ChatShop AI</p>
      </div>
    </footer>
  );
}

const LandingPage = () => (
  <div className="min-h-screen bg-canvas text-base">
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
      Skip to content
    </a>
    <Header />
    <main id="main">
      <Hero />
      <ChannelStrip />
      <Features />
      <Pricing />
      <FAQ />
      <FinalCta />
    </main>
    <Footer />
    <Chatbot />
  </div>
);

export default LandingPage;
