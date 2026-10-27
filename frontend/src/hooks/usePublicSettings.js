import { useEffect, useState } from "react";
import api from "../services/api.service";

// Platform name and support contact set by the admin (Admin → Settings).
// Fetched once per page load and shared by every caller.
let cached = null;
let pending = null;

export default function usePublicSettings() {
  const [settings, setSettings] = useState(cached);

  useEffect(() => {
    if (cached) return;
    pending =
      pending ||
      api
        .get("/settings/public")
        .then((res) => (cached = res.data))
        .catch(() => (cached = {}));
    pending.then(setSettings);
  }, []);

  return settings || {};
}
