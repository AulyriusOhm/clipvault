(() => {
  const storageKey = "clipvault-theme";
  const themes = ["ember", "tide", "moss", "aurora", "paper"];
  const root = document.documentElement;

  function storedTheme() {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  function applyTheme(theme, persist = false) {
    if (!themes.includes(theme)) return;
    root.dataset.theme = theme;
    document.querySelectorAll("[data-theme-select]").forEach((select) => {
      select.value = theme;
    });
    if (persist) {
      try {
        localStorage.setItem(storageKey, theme);
      } catch {}

    }
  }

  applyTheme(storedTheme() || root.dataset.theme || "ember");

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(root.dataset.theme);
    document.querySelectorAll("[data-theme-select]").forEach((select) => {
      select.addEventListener("change", (event) => applyTheme(event.target.value, true));
    });
  });
})();
