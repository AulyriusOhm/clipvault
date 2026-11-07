(function () {
  "use strict";

  var KEY = "clipvault.theme";
  var FALLBACK = "ember";

  var THEMES = [
    { id: "ember",  label: "Ember",  surface: "#191614", accent: "#e08b3c", bg: "#121010" },
    { id: "tide",   label: "Tide",   surface: "#0d1418", accent: "#3ec9d6", bg: "#070b0e" },
    { id: "moss",   label: "Moss",   surface: "#f7faf3", accent: "#4c7a3c", bg: "#e9efe3" },
    { id: "aurora", label: "Aurora", surface: "#fdfcff", accent: "#6a4bd6", bg: "#f4f2fa" },
    { id: "paper",  label: "Paper",  surface: "#f0ece4", accent: "#7b5b3c", bg: "#e3ded4" }
  ];

  var IDS = THEMES.map(function (t) { return t.id; });
  var root = document.documentElement;

  function byId(id) {
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].id === id) return THEMES[i];
    }
    return null;
  }

  function stored() {
    var v = null;
    try { v = window.localStorage.getItem(KEY); } catch (e) { v = null; }
    return IDS.indexOf(v) !== -1 ? v : FALLBACK;
  }

  function paint(id) {
    var theme = byId(id) || byId(FALLBACK);
    root.setAttribute("data-theme", theme.id);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme.bg);

    var buttons = document.querySelectorAll("[data-theme-set]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", buttons[i].getAttribute("data-theme-set") === theme.id ? "true" : "false");
    }
  }

  function set(id) {
    if (IDS.indexOf(id) === -1) return;
    try { window.localStorage.setItem(KEY, id); } catch (e) {}
    paint(id);
  }

  function swatch(theme, index) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.setAttribute("data-theme-set", theme.id);
    b.setAttribute("aria-pressed", "false");
    b.title = theme.label + " (Alt+" + (index + 1) + ")";

    var chip = document.createElement("span");
    chip.className = "swatch-chip";
    chip.style.setProperty("--sw-bg", theme.surface);
    chip.style.setProperty("--sw-accent", theme.accent);

    var label = document.createElement("span");
    label.className = "swatch-label";
    label.textContent = theme.label;

    var key = document.createElement("span");
    key.className = "swatch-key";
    key.textContent = String(index + 1);

    b.appendChild(chip);
    b.appendChild(label);
    b.appendChild(key);
    return b;
  }

  function mount() {
    var hosts = document.querySelectorAll("[data-theme-mount]");
    for (var h = 0; h < hosts.length; h++) {
      var host = hosts[h];
      var variant = host.getAttribute("data-theme-mount");
      host.className = "theme-switch" + (variant === "float" ? " theme-switch--float" : "");
      host.setAttribute("role", "group");
      host.setAttribute("aria-label", "Thème de l'interface");

      if (variant === "float") {
        var head = document.createElement("span");
        head.className = "theme-switch-label";
        head.textContent = "Thème";
        host.appendChild(head);
      }

      for (var i = 0; i < THEMES.length; i++) {
        host.appendChild(swatch(THEMES[i], i));
      }
    }
    paint(stored());
  }

  paint(stored());

  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("[data-theme-set]") : null;
    if (!btn) return;
    set(btn.getAttribute("data-theme-set"));
  });

  document.addEventListener("keydown", function (e) {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    var n = parseInt(e.key, 10);
    if (!n || n < 1 || n > THEMES.length) return;
    e.preventDefault();
    set(THEMES[n - 1].id);
  });

  window.addEventListener("storage", function (e) {
    if (e.key === KEY) paint(stored());
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
