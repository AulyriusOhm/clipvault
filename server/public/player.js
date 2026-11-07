(function () {
  "use strict";

  var video = document.querySelector(".player__video");
  if (!video) {
    return;
  }

  var play = document.querySelector("[data-play]");
  var big = document.querySelector("[data-big]");
  var volume = document.querySelector("[data-volume]");
  var time = document.querySelector("[data-time]");
  var scrub = document.querySelector("[data-scrub]");
  var fill = document.querySelector("[data-fill]");
  var fullscreen = document.querySelector("[data-fullscreen]");
  var stage = document.querySelector(".player__stage");

  function mmss(value) {
    if (!isFinite(value) || value < 0) {
      return "0:00";
    }
    var total = Math.floor(value);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ":" + (s < 10 ? "0" + s : s);
  }

  function refreshTime() {
    if (time) {
      time.textContent = mmss(video.currentTime) + " / " + mmss(video.duration);
    }
    if (scrub && isFinite(video.duration) && video.duration > 0) {
      var pct = (video.currentTime / video.duration) * 100;
      if (fill) {
        fill.style.width = pct + "%";
      }
      scrub.setAttribute("aria-valuenow", String(Math.round(pct)));
    }
  }

  function refreshIcon() {
    if (!play) {
      return;
    }
    var use = play.querySelector("use");
    if (use) {
      use.setAttribute("href", video.paused ? "#i-play" : "#i-pause");
    }
    play.setAttribute("aria-label", video.paused ? "Lecture" : "Pause");
    if (big) {
      big.hidden = !video.paused;
    }
  }

  function toggle() {
    if (video.paused) {
      video.play().catch(function () {});
    } else {
      video.pause();
    }
  }

  if (play) {
    play.addEventListener("click", toggle);
  }
  if (big) {
    big.addEventListener("click", toggle);
  }

  if (volume) {
    volume.addEventListener("click", function () {
      video.muted = !video.muted;
      var use = volume.querySelector("use");
      if (use) {
        use.setAttribute("href", video.muted ? "#i-x" : "#i-volume");
      }
      volume.setAttribute("aria-label", video.muted ? "Rétablir le son" : "Couper le son");
    });
  }

  function seekTo(event) {
    if (!scrub || !isFinite(video.duration) || video.duration <= 0) {
      return;
    }
    var box = scrub.getBoundingClientRect();
    var ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    video.currentTime = ratio * video.duration;
    refreshTime();
  }

  if (scrub) {
    var dragging = false;
    scrub.addEventListener("pointerdown", function (event) {
      dragging = true;
      scrub.setPointerCapture(event.pointerId);
      seekTo(event);
    });
    scrub.addEventListener("pointermove", function (event) {
      if (dragging) {
        seekTo(event);
      }
    });
    scrub.addEventListener("pointerup", function (event) {
      dragging = false;
      if (scrub.hasPointerCapture(event.pointerId)) {
        scrub.releasePointerCapture(event.pointerId);
      }
    });
    scrub.addEventListener("keydown", function (event) {
      var step = 5;
      if (event.key === "ArrowLeft") {
        video.currentTime = Math.max(0, video.currentTime - step);
      } else if (event.key === "ArrowRight") {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + step);
      } else if (event.key === "Home") {
        video.currentTime = 0;
      } else if (event.key === "End") {
        video.currentTime = video.duration || 0;
      } else {
        return;
      }
      event.preventDefault();
      refreshTime();
    });
  }

  if (fullscreen) {
    fullscreen.addEventListener("click", function () {
      var target = stage || video;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (target.requestFullscreen) {
        target.requestFullscreen();
      }
    });
  }

  video.addEventListener("timeupdate", refreshTime);
  video.addEventListener("loadedmetadata", refreshTime);
  video.addEventListener("play", refreshIcon);
  video.addEventListener("pause", refreshIcon);
  video.addEventListener("ended", refreshIcon);
  video.addEventListener("click", toggle);

  refreshIcon();
  refreshTime();
})();
