/* ============================================================
   OFF COURT — carousel edition
   ============================================================ */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ============ hero carousel — runs regardless of motion prefs;
     reduced motion just removes the slide transition + autoplay ============ */

  var track = document.getElementById("carouselTrack");
  var carousel = document.getElementById("carousel");
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var dots = Array.prototype.slice.call(document.querySelectorAll(".dot"));
  var total = slides.length;
  var current = 0;
  var autoplayTimer = null;
  var AUTOPLAY_MS = 6500;

  function render() {
    track.style.transform = "translateX(-" + (current * (100 / total)) + "%)";
    slides.forEach(function (s, i) { s.classList.toggle("is-active", i === current); });
    dots.forEach(function (d, i) {
      d.classList.toggle("is-active", i === current);
      d.setAttribute("aria-selected", i === current ? "true" : "false");
    });
  }

  function goTo(index) {
    current = ((index % total) + total) % total;
    render();
  }

  function next() { goTo(current + 1); }

  function stopAutoplay() {
    if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
  }

  function startAutoplay() {
    if (reduced) return;
    stopAutoplay();
    autoplayTimer = setInterval(next, AUTOPLAY_MS);
  }

  dots.forEach(function (d) {
    d.addEventListener("click", function () {
      stopAutoplay(); /* manual control from here on — respect it */
      goTo(parseInt(d.getAttribute("data-goto"), 10));
    });
  });

  /* swipe: horizontal drags advance/retreat; vertical drags still scroll */
  var startX = 0, startY = 0, dragging = false, horizontal = false;

  if (carousel) {
    carousel.addEventListener("touchstart", function (e) {
      var t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
      dragging = true; horizontal = false;
    }, { passive: true });

    carousel.addEventListener("touchmove", function (e) {
      if (!dragging) return;
      var t = e.touches[0];
      if (Math.abs(t.clientX - startX) > Math.abs(t.clientY - startY)) horizontal = true;
    }, { passive: true });

    carousel.addEventListener("touchend", function (e) {
      if (!dragging) return;
      dragging = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - startX;
      if (horizontal && Math.abs(dx) > 40) {
        stopAutoplay();
        if (dx < 0) next(); else goTo(current - 1);
      }
    });
  }

  render();
  startAutoplay();

  /* ---------- reduced motion / no GSAP: skip the rest ---------- */
  if (reduced || typeof gsap === "undefined") {
    document.body.classList.add("reduced");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: "power2.out" });
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ============ hero chrome entrance ============ */

  gsap.set([".nav", ".carousel-dots", ".scroll-cue", ".slide.is-active .slide-copy"], { autoAlpha: 0, y: 18 });
  gsap.to(".nav", { autoAlpha: 1, y: 0, duration: 1.4, delay: 0.2 });
  gsap.to(".slide.is-active .slide-copy", { autoAlpha: 1, y: 0, duration: 1.5, delay: 0.5 });
  gsap.to(".carousel-dots", { autoAlpha: 1, y: 0, duration: 1.2, delay: 0.9 });
  gsap.to(".scroll-cue", { autoAlpha: 1, y: 0, duration: 1.2, delay: 1.0 });

  /* each slide's own caption fades up the first time it becomes active */
  var revealed = {};
  function revealCaption(index) {
    if (revealed[index]) return;
    revealed[index] = true;
    var copy = slides[index].querySelector(".slide-copy");
    gsap.fromTo(copy, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.9, delay: 0.25, ease: "power2.out" });
  }
  revealed[0] = true; /* handled by the entrance tween above */
  var _goTo = goTo;
  goTo = function (index) {
    _goTo(index);
    revealCaption(current);
  };

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
