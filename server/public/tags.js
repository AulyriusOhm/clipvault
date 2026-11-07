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

  document.querySelectorAll("[data-tag-editor]").forEach(function (editor) {
    var hidden = document.getElementById(editor.getAttribute("data-tag-editor"));
    var list = editor.querySelector(".tag-editor__list");
    var input = editor.querySelector(".tag-editor__input");
    if (!hidden || !list || !input) {
      return;
    }

    function values() {
      return hidden.value.split(",").map(function (v) { return v.trim(); }).filter(Boolean);
    }

    function paint() {
      list.innerHTML = "";
      values().forEach(function (tag) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "tag tag--chip is-active";
        chip.setAttribute("data-remove-tag", tag);
        chip.textContent = tag + " ";
        var icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("class", "ic ic--sm");
        icon.setAttribute("aria-hidden", "true");
        var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
        use.setAttribute("href", "#i-x");
        icon.appendChild(use);
        chip.appendChild(icon);
        list.appendChild(chip);
      });
    }

    function commit(next) {
      hidden.value = next.join(", ");
      paint();
    }

    list.addEventListener("click", function (event) {
      var chip = event.target.closest("[data-remove-tag]");
      if (!chip) {
        return;
      }
      event.preventDefault();
      var tag = chip.getAttribute("data-remove-tag").toLowerCase();
      commit(values().filter(function (value) { return value.toLowerCase() !== tag; }));
    });

    input.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      var tag = input.value.trim().toLowerCase().replace(/\s+/g, "-");
      if (!tag) {
        return;
      }
      var current = values();
      if (current.some(function (value) { return value.toLowerCase() === tag; })) {
        input.value = "";
        return;
      }
      current.push(tag);
      commit(current.slice(0, 10));
      input.value = "";
    });

    paint();
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
