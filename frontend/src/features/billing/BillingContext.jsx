import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { emiApi } from "./api";

const BillingContext = createContext(null);
const STORE_KEY = "billing-store";

// Same rules as the server: "x.*", "*.read" and "*" (never super.*)
const grants = (granted, perm) =>
  granted === perm ||
  (granted === "*" && !perm.startsWith("super.")) ||
  (granted.endsWith(".*") && perm.startsWith(granted.slice(0, -1))) ||
  (granted.startsWith("*.") && perm.endsWith(granted.slice(1)));

/**
 * Who the signed-in person is in EMI & billing: the shop, their roles,
 * permissions and stores, plus the store they are working at right now.
 * Menus hide what a role cannot do; the server still checks every call.
 */
export function BillingProvider({ children }) {
  const { user } = useAuth();
  const enabled = Boolean(user) && user.role !== "admin";
  const [state, setState] = useState({ loading: enabled, me: null, error: null });
  const [storeId, setStoreIdState] = useState(() => {
    try {
      return localStorage.getItem(STORE_KEY);
    } catch {
      return null;
    }
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await emiApi.get("/me");
      setState({ loading: false, me: res.data, error: null });
    } catch (error) {
      setState({ loading: false, me: null, error });
    }
  }, []);

  useEffect(() => {
    if (enabled) load();
    else setState({ loading: false, me: null, error: null });
  }, [enabled, user?.id, load]);

  const setStoreId = useCallback((id) => {
    setStoreIdState(id);
    try {
      localStorage.setItem(STORE_KEY, id);
    } catch {
      // Remembering the store is a convenience only
    }
  }, []);

  const value = useMemo(() => {
    const me = state.me;
    const stores = (me?.stores || []).filter((s) => s.active !== false);
    const store = stores.find((s) => s._id === storeId) || stores[0] || null;
    const permissions = me?.permissions || [];
    return {
      ...state,
      reload: load,
      tenant: me?.tenant || null,
      roles: me?.roles || [],
      isOwner: Boolean(me?.isOwner),
      isAgent: Boolean(me?.roles?.length) && me.roles.every((r) => r.role === "AGENT"),
      stores,
      allStores: me?.stores || [],
      store,
      setStoreId,
      can: (perm) => permissions.some((g) => grants(g, perm)),
    };
  }, [state, storeId, load, setStoreId]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export const useBilling = () => {
  const context = useContext(BillingContext);
  if (!context) throw new Error("useBilling must be used within BillingProvider");
  return context;
};
