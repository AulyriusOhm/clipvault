(function () {
  "use strict";

  function split(value) {
    return value
      .split(",")
      .map(function (item) { return item.trim(); })
      .filter(Boolean);
  }

  function toggle(input, tag) {
    var current = split(input.value);
    var index = current.findIndex(function (item) { return item.toLowerCase() === tag; });
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(tag);
    }
    input.value = current.join(", ");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }

  function refresh(group, input) {
    var current = split(input.value).map(function (item) { return item.toLowerCase(); });
    group.querySelectorAll("[data-tag]").forEach(function (chip) {
      var active = current.indexOf(chip.getAttribute("data-tag")) >= 0;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  document.querySelectorAll("[data-tag-palette]").forEach(function (group) {
    var input = document.getElementById(group.getAttribute("data-tag-palette"));
    if (!input) {
      return;
    }
    group.addEventListener("click", function (event) {
      var chip = event.target.closest("[data-tag]");
      if (!chip) {
        return;
      }
      event.preventDefault();
      toggle(input, chip.getAttribute("data-tag"));
      refresh(group, input);
    });
    input.addEventListener("input", function () { refresh(group, input); });
    refresh(group, input);
  });
})();
