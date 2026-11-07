/* ClipVault — bascule de thème (Ember / Tide / Moss / Aurora / Paper).
   Applique le thème avant le premier paint, puis synchronise tous les
   sélecteurs [data-theme-btn] présents sur la page. Persistance localStorage. */
(function () {
  "use strict";

  var THEMES = ["ember", "tide", "moss", "aurora", "paper"];
  var LABELS = {
    ember: "Ember",
    tide: "Tide",
    moss: "Moss",
    aurora: "Aurora",
    paper: "Paper"
  };
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

  function sync() {
    var buttons = document.querySelectorAll("[data-theme-btn]");
    for (var i = 0; i < buttons.length; i += 1) {
      var isActive = buttons[i].getAttribute("data-theme-btn") === current;
      buttons[i].classList.toggle("is-active", isActive);
      buttons[i].setAttribute("aria-pressed", isActive ? "true" : "false");
    }
    var labels = document.querySelectorAll("[data-theme-label]");
    for (var j = 0; j < labels.length; j += 1) {
      labels[j].textContent = LABELS[current];
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

  function init() {
    document.addEventListener("click", onClick);
    sync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
