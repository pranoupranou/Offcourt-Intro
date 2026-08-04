/* ============================================================
   OFF COURT — carousel edition
   ============================================================ */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ============ ticker — clone the item set until the track is always
     at least 2x the viewport wide, so the -50% loop never runs dry ============ */

  (function () {
    var track = document.getElementById("amTrack");
    if (!track) return;
    var base = track.innerHTML;

    function fill() {
      track.innerHTML = base;
      var guard = 0;
      while (track.scrollWidth < window.innerWidth * 2 && guard < 25) {
        track.innerHTML += base;
        guard++;
      }
      track.innerHTML += track.innerHTML; /* mirror once more for the seamless -50% loop */
    }

    fill();

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fill, 200);
    });
  })();

  /* ============ background music — attempts autoplay, falls back to
     starting on first user gesture if the browser blocks it ============ */

  (function () {
    var audio = document.getElementById("bgMusic");
    var toggle = document.getElementById("musicToggle");
    if (!audio || !toggle) return;

    function reflect() {
      var muted = audio.muted || audio.paused;
      toggle.setAttribute("aria-pressed", muted ? "true" : "false");
      toggle.setAttribute("aria-label", muted ? "Play music" : "Mute music");
    }

    function tryPlay() {
      var p = audio.play();
      if (p && p.catch) p.catch(function () { /* blocked until a gesture arrives */ });
    }

    tryPlay();
    audio.addEventListener("play", reflect);
    audio.addEventListener("pause", reflect);
    audio.addEventListener("volumechange", reflect);
    reflect();

    function primeOnGesture() {
      if (!audio.paused) return;
      tryPlay();
    }
    ["pointerdown", "keydown", "touchstart"].forEach(function (evt) {
      document.addEventListener(evt, primeOnGesture, { once: true, passive: true });
    });

    toggle.addEventListener("click", function () {
      if (audio.paused) {
        audio.muted = false;
        tryPlay();
      } else {
        audio.muted = !audio.muted;
        reflect();
      }
    });
  })();

  /* ============ hero video — buffer, fade in, then scrub with scroll
     while the hero is pinned ============ */

  var video = document.getElementById("film");
  var FILM_SRC = "assets/launch-hero.mp4";
  var filmDuration = 0;
  var targetTime = 0;
  var smoothTime = 0;
  var firstFrameShown = false;
  var isTouch = window.matchMedia("(pointer: coarse)").matches;

  if (video) {
    fetch(FILM_SRC)
      .then(function (r) { return r.ok ? r.blob() : Promise.reject(new Error(r.status)); })
      .then(function (blob) { video.src = URL.createObjectURL(blob); video.load(); })
      .catch(function () { video.src = FILM_SRC; video.load(); });

    video.addEventListener("loadedmetadata", function () {
      if (video.duration && isFinite(video.duration)) {
        filmDuration = video.duration;
        if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
      }
    });

    function revealFilm() {
      if (firstFrameShown) return;
      firstFrameShown = true;
      gsap.to(video, { opacity: 1, duration: 0.8, ease: "power1.out" });
    }

    if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
      video.requestVideoFrameCallback(function () { revealFilm(); });
    }
    video.addEventListener("loadeddata", function () {
      setTimeout(revealFilm, 900);
    }, { once: true });

    if (isTouch) {
      window.addEventListener("touchstart", function () {
        if (firstFrameShown) return;
        var p = video.play();
        if (p && p.then) {
          p.then(function () { video.pause(); try { video.currentTime = 0.01; } catch (e) {} })
            .catch(function () {});
        }
      }, { once: true, passive: true });
    }
  }

  /* ---------- reduced motion / no GSAP: skip the rest ---------- */
  if (reduced || typeof gsap === "undefined") {
    document.body.classList.add("reduced");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: "power2.out" });
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ============ hero chrome entrance ============ */

  var heroBlocks = gsap.utils.toArray(".hero-copy-block");
  var n = heroBlocks.length;

  gsap.set(heroBlocks, { autoAlpha: 0, y: 18 });
  gsap.set([".nav", ".scroll-cue"], { autoAlpha: 0, y: 18 });
  gsap.to(".nav", { autoAlpha: 1, y: 0, duration: 1.4, delay: 0.2 });
  gsap.to(".scroll-cue", { autoAlpha: 1, y: 0, duration: 1.2, delay: 0.9 });
  gsap.to(heroBlocks[0], { autoAlpha: 1, y: 0, duration: 1.4, delay: 0.5 });

  /* ============ hero pin — scroll drives both the video scrub and
     which of the 4 captions is showing ============ */

  var heroTl = gsap.timeline({
    scrollTrigger: {
      trigger: "#hero",
      start: "top top",
      end: "+=320%",
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      onUpdate: function (self) {
        if (!video) return;
        var p = Math.min(self.progress / 0.92, 1);
        targetTime = p * (filmDuration ? filmDuration - 0.05 : 0);
      }
    }
  });

  var transitions = n - 1;
  var stageDur = 10 / transitions;
  for (var i = 1; i < n; i++) {
    var start = (i - 1) * stageDur;
    heroTl.to(heroBlocks[i - 1], { autoAlpha: 0, y: -22, duration: stageDur * 0.4, ease: "power2.in" }, start);
    heroTl.to(heroBlocks[i], { autoAlpha: 1, y: 0, duration: stageDur * 0.4, ease: "power2.out" }, start + stageDur * 0.15);
  }
  heroTl.to(heroBlocks[n - 1], { autoAlpha: 0, y: -22, duration: stageDur * 0.4, ease: "power2.in" }, 10 - stageDur * 0.4);
  heroTl.to(".scroll-cue", { autoAlpha: 0, duration: 0.5 }, 0.4);

  if (video) {
    video.addEventListener("seeked", function () {});
    gsap.ticker.add(function () {
      if (!filmDuration || video.readyState < 2) return;
      smoothTime += (targetTime - smoothTime) * 0.12;
      var diff = Math.abs(smoothTime - video.currentTime);
      var seekEps = isTouch ? 0.04 : 0.02;
      if (diff > seekEps) video.currentTime = smoothTime;
    });
  }

  /* ============ ticker ============ */

  gsap.from(".am-ticker", {
    autoAlpha: 0,
    y: 20,
    duration: 1.3,
    scrollTrigger: { trigger: "#amenities", start: "top 82%", once: true }
  });

  /* ============ enroll ============ */

  gsap.utils.toArray(".ob-el").forEach(function (el, i) {
    gsap.from(el, {
      autoAlpha: 0,
      y: 32,
      duration: 1.5,
      delay: (i % 3) * 0.08,
      scrollTrigger: { trigger: el, start: "top 90%", once: true }
    });
  });

  /* ============ footer ============ */

  gsap.from("footer > *", {
    autoAlpha: 0,
    y: 18,
    duration: 1.1,
    stagger: 0.12,
    scrollTrigger: { trigger: "footer", start: "top 94%", once: true }
  });

  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }

})();

/* ============ enroll form — quiet success ============ */

(function () {
  var form = document.getElementById("ob-form");
  var success = document.getElementById("ob-success");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = document.getElementById("f-name");
    var email = document.getElementById("f-email");
    if (!name.value.trim() || !email.value.trim() || email.validity.typeMismatch) {
      (!name.value.trim() ? name : email).focus();
      return;
    }

    if (typeof gsap !== "undefined" && !document.body.classList.contains("reduced")) {
      gsap.to(form, {
        autoAlpha: 0,
        y: -20,
        duration: 0.8,
        ease: "power2.inOut",
        onComplete: function () {
          form.hidden = true;
          success.hidden = false;
          gsap.fromTo(success, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 1.4, ease: "power2.out" });
        }
      });
    } else {
      form.hidden = true;
      success.hidden = false;
    }
  });
})();
