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
  var FILM_SRC = "assets/hero-film.mp4";
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

  gsap.set(heroBlocks, { autoAlpha: 1, opacity: 0 });
  gsap.set([".hero-copy", ".nav", ".scroll-cue"], { autoAlpha: 0, y: 18 });
  gsap.to(".nav", { autoAlpha: 1, y: 0, duration: 1.4, delay: 0.2 });
  gsap.to(".scroll-cue", { autoAlpha: 1, y: 0, duration: 1.2, delay: 0.9 });
  gsap.to(".hero-copy", { autoAlpha: 1, y: 0, duration: 1.4, delay: 0.5 });

  /* deterministic hard cut, synced to what's actually on screen in the
     film: gate/arrival, then the rooftop lawn, the dining room, the
     hallway leading back outside, and finally the courts through to
     the end. Each caption owns the scroll range that corresponds to
     its moment in the film — no crossfade blending, exactly one
     caption visible at a time, always correct in both directions. */
  var CAPTION_FILM_TIMES = [0, 1.0, 1.55, 2.05, 2.65];

  function captionBreakpoints() {
    var d = filmDuration || 5.085;
    return CAPTION_FILM_TIMES.map(function (t) {
      return Math.min(0.999, 0.92 * t / (d - 0.05));
    });
  }

  var activeIndex = -1;
  function updateCaptions(p) {
    var bp = captionBreakpoints();
    var idx = 0;
    for (var i = bp.length - 1; i >= 0; i--) {
      if (p >= bp[i]) { idx = i; break; }
    }
    if (idx === activeIndex) return;
    activeIndex = idx;
    heroBlocks.forEach(function (block, i) {
      block.style.opacity = i === idx ? 1 : 0;
    });
  }
  updateCaptions(0);

  /* ============ hero pin — scroll drives both the video scrub and
     which of the 5 captions is showing ============ */

  ScrollTrigger.create({
    trigger: "#hero",
    start: "top top",
    end: "+=400%",
    pin: true,
    scrub: 1,
    anticipatePin: 1,
    onUpdate: function (self) {
      if (video) {
        var pv = Math.min(self.progress / 0.92, 1);
        targetTime = pv * (filmDuration ? filmDuration - 0.05 : 0);
      }
      updateCaptions(self.progress);
      if (self.progress > 0.03) gsap.set(".scroll-cue", { autoAlpha: 0 });
    }
  });

  if (video) {
    /* hero-film.mp4 measured at ~47 native fps (237 frames / ~5.04s).
       Stepping in 4-frame increments — rather than seeking on every
       ~0.02s of drift — cuts decoder seeks roughly 4x vs. a per-frame
       seek, while keeping motion visibly smooth. */
    var FILM_FPS = 47;
    var FRAME_STEP = 4;
    var seekEps = FRAME_STEP / FILM_FPS;

    /* seek-gated scrub: never queue a second seek while one is in flight.
       The lerp keeps motion continuous; the gate lets each device run at
       exactly the seek rate it can sustain — no pile-ups, no jitter. This
       is what the un-gated version was missing, and the real source of
       the lag: overlapping seek requests backing up the decoder. */
    var seekPending = false;
    var seekIssuedAt = 0;

    video.addEventListener("seeked", function () { seekPending = false; });

    gsap.ticker.add(function () {
      if (!filmDuration || video.readyState < 2) return;
      smoothTime += (targetTime - smoothTime) * 0.12;
      var now = performance.now();
      if (seekPending && now - seekIssuedAt < 600) return;
      var diff = Math.abs(smoothTime - video.currentTime);
      if (diff > seekEps) {
        seekPending = true;
        seekIssuedAt = now;
        video.currentTime = smoothTime;
      }
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
