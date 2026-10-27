// "Open as shop": while the Super Admin has a shop's dashboard open, their
// own session waits here so "Back to Super Admin" can restore it.
const KEY = "superAdminSession";

export function startShopView({ token, user }) {
  localStorage.setItem(KEY, JSON.stringify({ token: localStorage.getItem("token"), user: localStorage.getItem("user") }));
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

// Restore the Super Admin session; false when there is none to go back to
export function endShopView() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    localStorage.removeItem(KEY);
    if (!saved?.token || !saved.user) return false;
    localStorage.setItem("token", saved.token);
    localStorage.setItem("user", saved.user);
    return true;
  } catch {
    localStorage.removeItem(KEY);
    return false;
  }
}

export const clearShopView = () => localStorage.removeItem(KEY);

export const SHOP_VIEW_EXIT_URL = "/admin/dashboard?section=users";
