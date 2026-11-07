(function () {
  "use strict";

  function absolute(value) {
    if (!value) {
      return window.location.href;
    }
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    return window.location.origin + (value.charAt(0) === "/" ? value : "/" + value);
  }

  function feedback(button, text) {
    var original = button.getAttribute("data-label-saved") || button.innerHTML;
    button.setAttribute("data-label-saved", original);
    button.textContent = text;
    button.disabled = true;
    window.setTimeout(function () {
      button.innerHTML = original;
      button.disabled = false;
    }, 1600);
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-copy]");
    if (!button) {
      return;
    }
    event.preventDefault();
    var url = absolute(button.getAttribute("data-copy"));

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(
        function () { feedback(button, "Copié"); },
        function () { feedback(button, url); },
      );
      return;
    }

    var area = document.createElement("textarea");
    area.value = url;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      feedback(button, "Copié");
    } catch (error) {
      window.prompt("Copier ce lien :", url);
    }
    document.body.removeChild(area);
  });
})();
