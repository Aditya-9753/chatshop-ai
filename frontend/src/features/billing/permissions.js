// Same rules as the server: "x.*", "*.read" and "*" (never super.*)
export const grants = (granted, perm) =>
  granted === perm ||
  (granted === "*" && !perm.startsWith("super.")) ||
  (granted.endsWith(".*") && perm.startsWith(granted.slice(0, -1))) ||
  (granted.startsWith("*.") && perm.endsWith(granted.slice(1)));

export const anyGrants = (granted, perm) => granted.some((g) => grants(g, perm));
