import React, { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import api from "../../services/api.service";

const DISMISSED_KEY = "dismissed-announcements";

const readDismissed = () => {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
  } catch {
    return [];
  }
};

// The newest message from the platform admin that this browser hasn't dismissed
export default function AnnouncementBanner() {
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    api
      .get("/users/announcements")
      .then((res) => setItems(res.data || []))
      .catch(() => setItems([]));
  }, []);

  const current = items.find((a) => !dismissed.includes(a._id));
  if (!current) return null;

  const dismiss = () => {
    const next = [...dismissed, current._id].slice(-50);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // Private mode: the banner simply comes back next visit
    }
  };

  return (
    <div role="status" className="flex items-start gap-3 border-b border-accent/20 bg-accent-soft px-4 py-2.5 text-caption text-accent-soft-fg lg:px-8">
      <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{current.title}</p>
        <p className="whitespace-pre-line">{current.message}</p>
      </div>
      <button onClick={dismiss} className="rounded-md p-1 hover:bg-accent/10" aria-label="Dismiss message">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
