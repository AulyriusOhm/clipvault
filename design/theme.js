/* ClipVault — bascule de thème (Ember / Tide / Moss / Aurora / Paper).
   Source unique des couleurs : les pastilles du sélecteur sont peintes depuis
   SWATCH, plus aucune valeur n'est dupliquée dans le HTML.
   Applique le thème avant le premier paint, synchronise [data-theme-btn],
   [data-theme-label], <meta name="theme-color">, et raccourcis Alt+1..5. */
(function () {
  "use strict";

  var THEMES = ["ember", "tide", "moss", "aurora", "paper"];

  var LABEL = { ember: "Ember", tide: "Tide", moss: "Moss", aurora: "Aurora", paper: "Paper" };

  /* une seule vérité par thème : accent (pastille), fond (theme-color), schéma */
  var SWATCH = { ember: "#e9a13c", tide: "#35c9e6", moss: "#4c7c39", aurora: "#7150c8", paper: "#7c5c3c" };
  var BG = { ember: "#16110c", tide: "#0b1116", moss: "#edf1e9", aurora: "#f3f1f8", paper: "#e8e5df" };
  var SCHEME = { ember: "dark", tide: "dark", moss: "light", aurora: "light", paper: "light" };

  var KEY = "clipvault.theme";
  var current = "ember";

  try {
    var saved = window.localStorage.getItem(KEY);
    if (saved && THEMES.indexOf(saved) !== -1) {
      current = saved;
    }
  } catch (err) {
    current = "ember";
  }

  document.documentElement.setAttribute("data-theme", current);

  function paintMeta() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", BG[current]);
    }
    document.documentElement.style.colorScheme = SCHEME[current];
  }

  function sync() {
    var buttons = document.querySelectorAll("[data-theme-btn]");
    for (var i = 0; i < buttons.length; i += 1) {
      var name = buttons[i].getAttribute("data-theme-btn");
      if (!name || !LABEL[name]) {
        continue;
      }
      buttons[i].style.setProperty("--sw", SWATCH[name]);
      buttons[i].setAttribute("title", LABEL[name] + " · Alt+" + (THEMES.indexOf(name) + 1));
      var isActive = name === current;
      buttons[i].classList.toggle("is-active", isActive);
      buttons[i].setAttribute("aria-pressed", isActive ? "true" : "false");
    }
    var labels = document.querySelectorAll("[data-theme-label]");
    for (var j = 0; j < labels.length; j += 1) {
      labels[j].textContent = LABEL[current];
    }
  }

  function setTheme(name) {
    if (THEMES.indexOf(name) === -1) {
      return;
    }
    current = name;
    document.documentElement.setAttribute("data-theme", name);
    try {
      window.localStorage.setItem(KEY, name);
    } catch (err) {
      /* stockage indisponible : le thème reste actif pour cette page */
    }
    paintMeta();
    sync();
  }

  function onClick(event) {
    var target = event.target;
    while (target && target !== document) {
      if (target.getAttribute && target.getAttribute("data-theme-btn")) {
        setTheme(target.getAttribute("data-theme-btn"));
        return;
      }
      target = target.parentNode;
    }
  }

  function onKey(event) {
    if (!event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    var n = parseInt(event.key, 10);
    if (n >= 1 && n <= THEMES.length) {
      event.preventDefault();
      setTheme(THEMES[n - 1]);
    }
  }

  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      paintMeta();
      sync();
    });
  } else {
    paintMeta();
    sync();
  }
})();
