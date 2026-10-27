import React from "react";
import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";
import ProductPreview from "../marketing/ProductPreview";

/**
 * Split-screen auth layout: form on the left, product preview and a
 * customer quote on the right (the right side hides below 1024px).
 */
export default function AuthLayout({ title, description, children, footer }) {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex min-h-screen flex-col px-4 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </header>

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
            {description && <p className="mt-1.5 text-sm text-fg-muted">{description}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-fg-muted">{footer}</div>}
          </div>
        </main>

        <p className="text-center text-xs text-fg-muted">© {new Date().getFullYear()} ChatShop AI</p>
      </div>

      <aside className="hidden lg:flex flex-col justify-center gap-10 border-l border-line bg-surface-2/60 px-12 xl:px-20">
        <ProductPreview className="w-full max-w-[560px]" />
        {/* Placeholder quote: replace with a real customer's words before launch */}
        <figure className="max-w-[560px]">
          <blockquote className="text-lg font-medium leading-relaxed tracking-tight text-fg">
            “We answer every WhatsApp and Instagram message from one screen now. Orders that used to get lost in chats
            are tracked from the first hello to delivery.”
          </blockquote>
          <figcaption className="mt-4 text-sm text-fg-muted">Boutique owner, Jaipur</figcaption>
        </figure>
      </aside>
    </div>
  );
}
