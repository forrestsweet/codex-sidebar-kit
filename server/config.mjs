const ID_PATTERN = /^[a-z][a-z0-9-]{1,47}$/;
const ALLOWED_CAPABILITIES = new Set([
  "context",
  "native-task",
  "open-thread",
  "automation",
]);

export function publicConfig(input) {
  if (!input || typeof input !== "object") throw new Error("sidebar.config.mjs must export an object");
  if (!ID_PATTERN.test(input.appId || "")) throw new Error("appId must be a lowercase kebab-case identifier");
  if (!Array.isArray(input.menus) || input.menus.length === 0) throw new Error("At least one menu is required");

  const ids = new Set();
  const menus = input.menus.map((menu) => {
    if (!ID_PATTERN.test(menu?.id || "")) throw new Error(`Invalid menu id: ${menu?.id ?? ""}`);
    if (ids.has(menu.id)) throw new Error(`Duplicate menu id: ${menu.id}`);
    ids.add(menu.id);
    if (typeof menu.label !== "string" || !menu.label.trim()) throw new Error(`Menu '${menu.id}' needs a label`);
    if (typeof menu.path !== "string" || !menu.path.startsWith("/app/")) {
      throw new Error(`Menu '${menu.id}' path must start with /app/`);
    }
    const capabilities = Array.isArray(menu.capabilities) ? menu.capabilities : [];
    for (const capability of capabilities) {
      if (!ALLOWED_CAPABILITIES.has(capability)) {
        throw new Error(`Menu '${menu.id}' has unsupported capability '${capability}'`);
      }
    }
    return {
      id: menu.id,
      label: menu.label.trim(),
      description: typeof menu.description === "string" ? menu.description.trim() : "",
      icon: typeof menu.icon === "string" ? menu.icon : "panel-left",
      path: menu.path,
      capabilities: [...new Set(capabilities)],
    };
  });

  return {
    appId: input.appId,
    name: typeof input.name === "string" && input.name.trim() ? input.name.trim() : input.appId,
    sectionLabel: typeof input.sectionLabel === "string" && input.sectionLabel.trim()
      ? input.sectionLabel.trim()
      : "Apps",
    repositoryUrl: typeof input.repositoryUrl === "string" ? input.repositoryUrl : "",
    menus,
  };
}
