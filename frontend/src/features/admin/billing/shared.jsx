import React, { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "../../../components/ui";
import { PAYMENT_TONES } from "../../platformBilling/api";

// Load once and on reload(); `deps` re-run it. Ignores stale responses.
export function useData(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const seq = useRef(0);
  const load = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetcher();
      if (id === seq.current) setState({ data: res.data, error: null, loading: false });
    } catch (error) {
      if (id === seq.current) setState((s) => ({ ...s, loading: false, error: error.message || "Please try again." }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

export function StatusBadge({ status }) {
  const [tone, label] = PAYMENT_TONES[status] || ["neutral", String(status || "").replace(/_/g, " ").toLowerCase()];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

// India calendar date, YYYY-MM-DD
export const istToday = (offsetDays = 0) => new Date(Date.now() + 5.5 * 3600 * 1000 + offsetDays * 86400000).toISOString().slice(0, 10);

// Rupees typed in a form -> paise ("" stays empty)
export const rupeesToPaise = (value) => (value === "" || value === null || value === undefined ? undefined : Math.round(Number(String(value).replace(/,/g, "")) * 100));
export const paiseToRupees = (paise) => (paise === null || paise === undefined ? "" : String(paise / 100));

export const shopName = (m) => m?.name || m?.businessName || "—";
