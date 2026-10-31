import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { BILLING_ITEMS, billingItemsFor } from "../../layouts/navigation";
import { emiApi } from "./api";
import { anyGrants } from "./permissions";

const BillingContext = createContext(null);
const STORE_KEY = "billing-store";

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
    const can = (perm) => anyGrants(permissions, perm);
    const roles = me?.roles || [];
    const staff = user?.role === "staff";
    return {
      ...state,
      reload: load,
      tenant: me?.tenant || null,
      roles,
      isOwner: Boolean(me?.isOwner),
      isAgent: Boolean(roles.length) && roles.every((r) => r.role === "AGENT"),
      stores,
      allStores: me?.stores || [],
      store,
      setStoreId,
      can,
      // The billing pages this person can open; an owner whose billing isn't
      // open yet (waiting for approval) still gets the overview, which says why
      items: state.error && !staff ? BILLING_ITEMS.filter((i) => i.key === "overview") : billingItemsFor({ staff, roles, can }),
    };
  }, [state, storeId, load, setStoreId, user?.role]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export const useBilling = () => {
  const context = useContext(BillingContext);
  if (!context) throw new Error("useBilling must be used within BillingProvider");
  return context;
};
