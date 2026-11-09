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

  var LEAVE_MS = 150;

  function makeChip(tag, applied) {
    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tag tag--chip" + (applied ? " is-active" : "");
    if (applied) {
      chip.setAttribute("data-remove-tag", tag);
      var icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("class", "ic ic--sm");
      icon.setAttribute("aria-hidden", "true");
      var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", "#i-x");
      icon.appendChild(use);
      chip.appendChild(icon);
      chip.appendChild(document.createTextNode(tag));
    } else {
      chip.setAttribute("data-add-tag", tag);
      chip.textContent = tag;
    }
    return chip;
  }

  document.querySelectorAll("[data-tag-editor]").forEach(function (editor) {
    var hidden = document.getElementById(editor.getAttribute("data-tag-editor"));
    var applied = editor.querySelector("[data-applied]");
    var pool = editor.querySelector("[data-pool]");
    var empty = editor.querySelector("[data-empty]");
    var input = editor.querySelector(".tag-editor__input");
    if (!hidden || !applied || !pool) {
      return;
    }

    function values() {
      return hidden.value.split(",").map(function (v) { return v.trim().toLowerCase(); }).filter(Boolean);
    }

    function sync() {
      hidden.value = values().join(", ");
      if (empty) {
        empty.hidden = applied.querySelectorAll("[data-remove-tag]").length > 0;
      }
    }

    /** Fades the chip out of its zone, then brings it back in the other one. */
    function move(chip, targetIsApplied, tag) {
      chip.classList.add("is-leaving");
      window.setTimeout(function () {
        chip.remove();
        var next = makeChip(tag, targetIsApplied);
        var host = targetIsApplied ? applied : pool;
        next.classList.add("is-entering");
        host.appendChild(next);
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () { next.classList.remove("is-entering"); });
        });
        sync();
      }, LEAVE_MS);
      sync();
    }

    applied.addEventListener("click", function (event) {
      var chip = event.target.closest("[data-remove-tag]");
      if (!chip) {
        return;
      }
      event.preventDefault();
      var tag = chip.getAttribute("data-remove-tag");
      hidden.value = values().filter(function (value) { return value !== tag; }).join(", ");
      move(chip, false, tag);
    });

    pool.addEventListener("click", function (event) {
      var chip = event.target.closest("[data-add-tag]");
      if (!chip) {
        return;
      }
      event.preventDefault();
      var tag = chip.getAttribute("data-add-tag");
      var current = values();
      if (current.indexOf(tag) < 0 && current.length < 10) {
        current.push(tag);
        hidden.value = current.join(", ");
      }
      move(chip, true, tag);
    });

    input.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      var tag = input.value.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24);
      input.value = "";
      if (!tag) {
        return;
      }
      var current = values();
      if (current.indexOf(tag) >= 0 || current.length >= 10) {
        return;
      }
      current.push(tag);
      hidden.value = current.join(", ");
      var existing = pool.querySelector('[data-add-tag="' + tag + '"]');
      if (existing) {
        move(existing, true, tag);
      } else {
        var chip = makeChip(tag, true);
        chip.classList.add("is-entering");
        applied.appendChild(chip);
        window.requestAnimationFrame(function () { chip.classList.remove("is-entering"); });
        sync();
      }
    });

    sync();
  });

  document.querySelectorAll("[data-tag-palette]").forEach(function (group) {
    var input = document.getElementById(group.getAttribute("data-tag-palette"));
    if (!input) {
      return;
    }
    group.addEventListener("click", function (event) {
      var clearer = event.target.closest("[data-clear]");
      if (clearer) {
        event.preventDefault();
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
        refresh(group, input);
        return;
      }
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
