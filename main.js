/* ============================================================
   OFF COURT — carousel edition
   ============================================================ */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ============ member icon reflects mock sign-in state ============ */

  (function () {
    var navProfile = document.getElementById("navProfile");
    if (!navProfile || typeof OC === "undefined") return;
    var member = OC.getMember();
    if (member && member.signedIn) navProfile.classList.add("is-signed-in");
  })();

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
  var filmCanvas = document.getElementById("filmCanvas");
  var FILM_SRC = "assets/hero-film.mp4";
  var FILM_FPS = 24; /* hero-film.mp4 is the original 1080p/24fps source (117 frames / ~5.09s) */
  var filmDuration = 0;
  var targetTime = 0;
  var smoothTime = 0;
  var firstFrameShown = false;
  var isTouch = window.matchMedia("(pointer: coarse)").matches;

  /* hidden clone of the film, used only to scan nearby frames for
     sharpness once scrolling settles - never rendered, so the scan
     itself is invisible; only the final, sharper frame ever shows up
     on the real <video>. This is also the fallback rendering path if
     the WebCodecs cache below never becomes available. */
  var scanVideo = null;

  /* ============ WebCodecs frame cache (progressive enhancement) ============
     The <video>+seek scrub above always works and is the baseline. In
     parallel, if the browser supports WebCodecs, every native frame of
     the film is decoded once, downsampled to a JPEG in memory, and
     cached. Once that finishes, playback swaps from seeking a <video>
     element (which costs a real decoder seek every time) to just
     drawing an already-decoded frame onto a canvas - an instant lookup
     with no seek cost at all, so scrubbing can show every frame with
     no stepping/gating tradeoff. If WebCodecs or the mp4box.js demuxer
     aren't available, this whole section quietly no-ops and the
     <video> path keeps running indefinitely - no user-facing failure
     mode either way. */
  var useCanvas = false;
  var frameCache = [];
  var frameCacheReady = false;
  var bitmapLRU = new Map();
  var LRU_MAX = 8;
  var filmCtx = filmCanvas ? filmCanvas.getContext("2d") : null;
  var drawingIdx = null;
  var pendingDrawIdx = null;
  /* set once the scroll-scrub setup below (only reached when motion
     isn't reduced) is ready; lets swapToCanvas trigger a sharpness
     refine on the very first canvas frame without reaching across a
     strict-mode block scope it isn't part of */
  var triggerInitialCanvasRefine = null;

  function resizeFilmCanvas() {
    if (!filmCanvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = filmCanvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (filmCanvas.width !== w || filmCanvas.height !== h) {
      filmCanvas.width = w;
      filmCanvas.height = h;
      if (drawingIdx !== null) redrawCurrent();
    }
  }

  function drawCover(bitmap) {
    if (!filmCtx || !filmCanvas.width || !filmCanvas.height) return;
    var cw = filmCanvas.width, ch = filmCanvas.height;
    var iw = bitmap.width, ih = bitmap.height;
    var scale = Math.max(cw / iw, ch / ih);
    var sw = cw / scale, sh = ch / scale;
    var sx = (iw - sw) / 2, sy = (ih - sh) / 2;
    filmCtx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, cw, ch);
  }

  function redrawCurrent() {
    if (drawingIdx === null) return;
    getBitmap(drawingIdx).then(function (bmp) { if (bmp) drawCover(bmp); });
  }

  function getBitmap(index) {
    if (bitmapLRU.has(index)) {
      var bmp = bitmapLRU.get(index);
      bitmapLRU.delete(index);
      bitmapLRU.set(index, bmp);
      return Promise.resolve(bmp);
    }
    var entry = frameCache[index];
    if (!entry) return Promise.resolve(null);
    return createImageBitmap(entry.blob).then(function (bmp) {
      bitmapLRU.set(index, bmp);
      if (bitmapLRU.size > LRU_MAX) {
        var oldestKey = bitmapLRU.keys().next().value;
        var oldestBmp = bitmapLRU.get(oldestKey);
        bitmapLRU.delete(oldestKey);
        oldestBmp.close();
      }
      return bmp;
    });
  }

  /* collapses to whichever frame index was most recently requested -
     if several scroll ticks fire while a decode is still in flight,
     only the latest one gets drawn once ready, nothing piles up */
  function requestDraw(index) {
    if (index === drawingIdx) return;
    if (pendingDrawIdx !== null) { pendingDrawIdx = index; return; }
    pendingDrawIdx = index;
    step();
    function step() {
      var idx = pendingDrawIdx;
      getBitmap(idx).then(function (bmp) {
        if (bmp) { drawCover(bmp); drawingIdx = idx; }
        if (pendingDrawIdx !== idx) { step(); /* a newer frame was requested mid-decode */ }
        else { pendingDrawIdx = null; }
      });
    }
  }

  function buildWebCodecsCache(arrayBuffer) {
    /* reduced-motion skips the scrub entirely - decoding the whole
       film into memory would be pure waste for those visitors */
    if (reduced) return;
    if (typeof VideoDecoder === "undefined" || typeof MP4Box === "undefined" || !filmCanvas) return;

    function getDescription(trak) {
      var entries = trak.mdia.minf.stbl.stsd.entries;
      for (var i = 0; i < entries.length; i++) {
        var box = entries[i].avcC || entries[i].hvcC || entries[i].vpcC || entries[i].av1C;
        if (box) {
          var stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
          box.write(stream);
          return new Uint8Array(stream.buffer, 8);
        }
      }
      return undefined;
    }

    var workCanvas = null, workCtx = null;
    var frameQueue = [];
    var processingQueue = false;
    var decodeFinished = false;
    var framesExpected = 0;
    var framesWritten = 0;

    window.__heroFilm = {
      status: "starting",
      framesWritten: function () { return framesWritten; },
      framesExpected: function () { return framesExpected; },
      useCanvas: function () { return useCanvas; }
    };

    function pump() {
      if (processingQueue) return;
      var frame = frameQueue.shift();
      if (!frame) { checkComplete(); return; }
      processingQueue = true;
      if (!workCanvas) {
        workCanvas = document.createElement("canvas");
        workCanvas.width = frame.displayWidth;
        workCanvas.height = frame.displayHeight;
        workCtx = workCanvas.getContext("2d");
      }
      workCtx.drawImage(frame, 0, 0, workCanvas.width, workCanvas.height);
      var ts = frame.timestamp / 1e6;
      frame.close();
      workCanvas.toBlob(function (blob) {
        if (blob) {
          var idx = Math.round(ts * FILM_FPS);
          frameCache[idx] = { t: ts, blob: blob };
        }
        framesWritten++;
        processingQueue = false;
        pump();
      }, "image/jpeg", 0.9);
    }

    function checkComplete() {
      if (decodeFinished && frameQueue.length === 0 && !processingQueue) {
        frameCacheReady = true;
        window.__heroFilm.status = "complete";
        swapToCanvas();
      }
    }

    var decoder = new VideoDecoder({
      output: function (frame) { frameQueue.push(frame); pump(); },
      error: function () { /* WebCodecs failed mid-stream - just stay on the <video> path */ }
    });

    var mp4boxfile = MP4Box.createFile();
    mp4boxfile.onError = function (e) { window.__heroFilm.status = "mp4box-error: " + e; };
    mp4boxfile.onReady = function (info) {
      var track = info.videoTracks[0];
      if (!track) { window.__heroFilm.status = "no-video-track"; return; }
      framesExpected = track.nb_samples;
      window.__heroFilm.status = "configuring (" + track.codec + ")";
      var trak = mp4boxfile.getTrackById(track.id);
      var description = getDescription(trak);
      try {
        decoder.configure({
          codec: track.codec,
          codedWidth: track.video.width,
          codedHeight: track.video.height,
          description: description
        });
      } catch (e) { window.__heroFilm.status = "configure-failed: " + e; return; }
      window.__heroFilm.status = "decoding";
      mp4boxfile.setExtractionOptions(track.id, null, { nbSamples: 100 });
      mp4boxfile.start();
    };
    mp4boxfile.onSamples = function (trackId, ref, samples) {
      samples.forEach(function (sample) {
        decoder.decode(new EncodedVideoChunk({
          type: sample.is_sync ? "key" : "delta",
          timestamp: (sample.cts * 1e6) / sample.timescale,
          duration: (sample.duration * 1e6) / sample.timescale,
          data: sample.data
        }));
      });
    };

    try {
      arrayBuffer.fileStart = 0;
      mp4boxfile.appendBuffer(arrayBuffer);
      mp4boxfile.flush();
      decoder.flush().then(function () {
        decodeFinished = true;
        checkComplete();
      }).catch(function (e) { window.__heroFilm.status = "decoder-flush-failed: " + e; });
    } catch (e) { window.__heroFilm.status = "demux-failed: " + e; }
  }

  function swapToCanvas() {
    if (useCanvas || !filmCanvas) return;
    useCanvas = true;
    resizeFilmCanvas();
    var idx = Math.max(0, Math.min(frameCache.length - 1, Math.round(smoothTime * FILM_FPS)));
    requestDraw(idx);
    if (triggerInitialCanvasRefine) triggerInitialCanvasRefine();
    if (typeof gsap !== "undefined") {
      gsap.to(filmCanvas, { opacity: 1, duration: 0.5, ease: "power1.out" });
      gsap.to(video, { opacity: 0, duration: 0.5, ease: "power1.out" });
    } else {
      filmCanvas.style.opacity = 1;
      video.style.opacity = 0;
    }
  }

  window.addEventListener("resize", function () {
    if (useCanvas) resizeFilmCanvas();
  });

  if (video) {
    scanVideo = document.createElement("video");
    scanVideo.muted = true;
    scanVideo.playsInline = true;
    scanVideo.preload = "auto";
    scanVideo.setAttribute("aria-hidden", "true");
    scanVideo.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:2px;height:2px;opacity:0;pointer-events:none;";
    document.body.appendChild(scanVideo);

    fetch(FILM_SRC)
      .then(function (r) { return r.ok ? r.blob() : Promise.reject(new Error(r.status)); })
      .then(function (blob) {
        var url = URL.createObjectURL(blob);
        video.src = url;
        video.load();
        scanVideo.src = url;
        scanVideo.load();
        blob.arrayBuffer().then(buildWebCodecsCache).catch(function () {});
      })
      .catch(function () {
        video.src = FILM_SRC;
        video.load();
        scanVideo.src = FILM_SRC;
        scanVideo.load();
      });

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
    /* Stepping the legacy <video> path in 4-frame increments — rather
       than seeking on every ~0.01s of drift — cuts decoder seeks
       roughly 4x vs. a per-frame seek, while keeping motion visibly
       smooth. Irrelevant once useCanvas is true, since drawing an
       already-decoded frame has no seek cost to economize on. */
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
      if (!filmDuration) return;
      smoothTime += (targetTime - smoothTime) * 0.12;

      if (useCanvas) {
        var idx = Math.max(0, Math.min(frameCache.length - 1, Math.round(smoothTime * FILM_FPS)));
        requestDraw(idx);
        return;
      }

      if (video.readyState < 2) return;
      var now = performance.now();
      if (seekPending && now - seekIssuedAt < 600) return;
      var diff = Math.abs(smoothTime - video.currentTime);
      if (diff > seekEps) {
        seekPending = true;
        seekIssuedAt = now;
        video.currentTime = smoothTime;
      }
    });

    /* ============ sharpest-frame snap, at rest ============
       Real footage carries per-frame motion blur wherever the camera
       is moving, so whichever exact instant the scrub lands on can be
       one of those blurry frames. Once scrolling actually stops, scan
       the handful of native frames right around the resting point on
       the hidden clone and snap to whichever is sharpest - nothing
       flickers on the visible video, only the final corrected frame
       ever shows. */
    var frameDuration = 1 / FILM_FPS;

    var scanCanvas = document.createElement("canvas");
    scanCanvas.width = 160;
    scanCanvas.height = 90;
    var scanCtx = scanCanvas.getContext("2d", { willReadFrequently: true });

    function seekAndWait(el, t) {
      return new Promise(function (resolve) {
        var done = false;
        function finish() {
          if (done) return;
          done = true;
          el.removeEventListener("seeked", finish);
          resolve();
        }
        el.addEventListener("seeked", finish);
        el.currentTime = t;
        setTimeout(finish, 800); /* safety net if a no-op seek never fires 'seeked' */
      });
    }

    function sharpnessOf(el) {
      scanCtx.drawImage(el, 0, 0, scanCanvas.width, scanCanvas.height);
      var data;
      try {
        data = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height).data;
      } catch (e) {
        return 0;
      }
      var w = scanCanvas.width, h = scanCanvas.height;
      var gray = new Float32Array(w * h);
      for (var i = 0, p = 0; i < data.length; i += 4, p++) {
        gray[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      }
      var energy = 0;
      for (var y = 0; y < h - 1; y++) {
        for (var x = 0; x < w - 1; x++) {
          var idx = y * w + x;
          var dx = gray[idx] - gray[idx + 1];
          var dy = gray[idx] - gray[idx + w];
          energy += dx * dx + dy * dy;
        }
      }
      return energy;
    }

    var settleToken = 0;

    /* same idea as the <video> path below, but the cache makes it
       trivial: every candidate frame is already decoded, so scoring
       them is just a handful of instant lookups - no seeking at all. */
    function refineRestingFrameCanvas(centerTime) {
      var myToken = settleToken;
      var centerIdx = Math.round(centerTime * FILM_FPS);
      var maxIdx = frameCache.length - 1;
      var candidates = [-2, -1, 0, 1, 2]
        .map(function (k) { return centerIdx + k; })
        .filter(function (idx) { return idx >= 0 && idx <= maxIdx && frameCache[idx]; });
      if (!candidates.length) return;

      Promise.all(candidates.map(function (idx) {
        return getBitmap(idx).then(function (bmp) { return { idx: idx, bmp: bmp }; });
      })).then(function (loaded) {
        if (myToken !== settleToken) return;
        var best = null;
        loaded.forEach(function (item) {
          if (!item.bmp) return;
          var score = sharpnessOf(item.bmp);
          if (!best || score > best.score) best = { idx: item.idx, score: score };
        });
        if (!best || best.idx === drawingIdx) return;
        targetTime = best.idx / FILM_FPS;
        smoothTime = targetTime;
        requestDraw(best.idx);
      });
    }

    triggerInitialCanvasRefine = function () { refineRestingFrameCanvas(smoothTime); };

    function refineRestingFrame(centerTime) {
      if (useCanvas) { refineRestingFrameCanvas(centerTime); return; }
      if (!scanVideo || !filmDuration || scanVideo.readyState < 2) return;
      var myToken = settleToken;
      var maxT = filmDuration - 0.05;
      var candidates = [-2, -1, 0, 1, 2]
        .map(function (k) { return centerTime + k * frameDuration; })
        .filter(function (t) { return t >= 0 && t <= maxT; });

      var results = [];
      var chain = Promise.resolve();
      candidates.forEach(function (t) {
        chain = chain.then(function () {
          if (myToken !== settleToken) return;
          return seekAndWait(scanVideo, t).then(function () {
            if (myToken !== settleToken) return;
            results.push({ t: t, score: sharpnessOf(scanVideo) });
          });
        });
      });
      chain.then(function () {
        if (myToken !== settleToken || !results.length) return;
        var best = results[0];
        for (var i = 1; i < results.length; i++) {
          if (results[i].score > best.score) best = results[i];
        }
        if (Math.abs(best.t - video.currentTime) < frameDuration * 0.5) return;
        targetTime = best.t;
        smoothTime = best.t;
        seekPending = true;
        seekIssuedAt = performance.now();
        video.currentTime = best.t;
      });
    }

    var idleTimer = null;
    function scheduleRefine() {
      settleToken++;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () {
        var myToken = settleToken;
        var waited = 0;
        var wait = setInterval(function () {
          waited += 60;
          if (myToken !== settleToken || waited > 1500) { clearInterval(wait); return; }
          if (Math.abs(smoothTime - targetTime) < seekEps) {
            clearInterval(wait);
            refineRestingFrame(targetTime);
          }
        }, 60);
      }, 220);
    }

    window.addEventListener("scroll", scheduleRefine, { passive: true });
    window.addEventListener("wheel", scheduleRefine, { passive: true });
    window.addEventListener("touchmove", scheduleRefine, { passive: true });

    /* also fix the very first resting frame (top of page, before any
       scrolling), in case the film opens on a moving-camera moment */
    scanVideo.addEventListener("loadeddata", function () {
      setTimeout(function () { refineRestingFrame(targetTime); }, 1000);
    }, { once: true });
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
