/* ============================================================
   OFF COURT — booking wizard (sport + wellness), mock logic only
   ============================================================ */

(function () {
  "use strict";

  if (typeof OC === "undefined") return;

  var SPORT_STEPS = ["mood", "zone", "venue", "time", "match", "crew", "extras", "review", "confirm", "invite-sent"];
  var WELLNESS_STEPS = ["mood", "wellness-pick", "time", "extras", "review", "confirm"];

  var state = {
    mood: null,
    venueId: null,
    date: OC.dateISO(new Date()),
    startMin: 18 * 60,
    durationMin: 90,
    courtIndex: null,
    players: [],
    inviteMode: "link",
    extras: []
  };

  var flow = SPORT_STEPS;
  var stepIndex = 0;

  var els = {
    progress: document.getElementById("wizardProgress"),
    steps: Array.prototype.slice.call(document.querySelectorAll(".step")),
    actions: document.getElementById("stepActions"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    backBtn: document.getElementById("backBtn")
  };

  var navProfile = document.getElementById("navProfile");
  if (navProfile) {
    var member = OC.getMember();
    if (member && member.signedIn) navProfile.classList.add("is-signed-in");
  }

  /* ============ step machine ============ */

  function currentStepId() { return flow[stepIndex]; }

  function showStep() {
    var id = currentStepId();
    els.steps.forEach(function (s) { s.classList.toggle("is-active", s.getAttribute("data-step") === id); });
    renderProgress();
    var renderer = RENDERERS[id];
    var cfg = renderer ? renderer() : {};
    applyActionBar(cfg || {});
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderProgress() {
    els.progress.innerHTML = "";
    flow.forEach(function (_, i) {
      var span = document.createElement("span");
      if (i < stepIndex) span.classList.add("is-done");
      if (i === stepIndex) span.classList.add("is-active");
      els.progress.appendChild(span);
    });
  }

  function applyActionBar(cfg) {
    if (cfg.hideBar) {
      els.actions.style.display = "none";
      return;
    }
    els.actions.style.display = "flex";
    els.prevBtn.style.visibility = stepIndex === 0 ? "hidden" : "visible";
    els.nextBtn.textContent = cfg.nextLabel || "Continue";
    els.nextBtn.disabled = !!cfg.nextDisabled;
    els.nextBtn.onclick = cfg.onNext || goNext;
  }

  function goNext() {
    if (stepIndex < flow.length - 1) { stepIndex++; showStep(); }
  }
  function goPrev() {
    if (stepIndex > 0) { stepIndex--; showStep(); }
    else { window.location.href = "index.html"; }
  }

  els.prevBtn.addEventListener("click", goPrev);
  els.backBtn.addEventListener("click", goPrev);

  /* ============ 1 · mood ============ */

  document.querySelectorAll(".mood-tile[data-mood]").forEach(function (tile) {
    tile.addEventListener("click", function () {
      state.mood = tile.getAttribute("data-mood");
      flow = state.mood === "recover" ? WELLNESS_STEPS : SPORT_STEPS;
      stepIndex = 1;
      showStep();
    });
  });

  function renderMood() { return { hideBar: true }; }

  /* ============ 2 · zone map (sport) ============ */

  function renderZone() {
    var map = document.getElementById("zoneMap");
    map.querySelectorAll(".zone-pin").forEach(function (p) { p.remove(); });
    OC.ZONES.forEach(function (zone) {
      var pin = document.createElement("button");
      pin.type = "button";
      pin.className = "zone-pin" + (zone.venue ? "" : " is-inactive");
      pin.style.top = zone.top + "%";
      pin.style.left = zone.left + "%";
      pin.innerHTML = '<span class="zone-pin-label">' + zone.label + '</span><span class="zone-pin-sub">' + zone.sub + "</span>";
      if (zone.venue) {
        pin.addEventListener("click", function () {
          state.venueId = zone.venue;
          goNext();
        });
      }
      map.appendChild(pin);
    });
    return { hideBar: true };
  }

  /* ============ 2b · wellness pick ============ */

  function renderWellnessPick() {
    var wrap = document.getElementById("wellnessPick");
    wrap.innerHTML = "";
    ["icebath", "sauna"].forEach(function (id) {
      var v = OC.VENUES[id];
      var tile = document.createElement("button");
      tile.type = "button";
      tile.className = "mood-tile" + (state.venueId === id ? " is-primary" : "");
      tile.innerHTML = '<span class="mood-icon">' + (id === "icebath" ? "🧊" : "🔥") + '</span>' +
        '<span class="mood-label">' + v.name + '</span>' +
        '<span class="mood-desc">' + v.features[0] + " · Max 30 mins</span>";
      tile.addEventListener("click", function () {
        state.venueId = id;
        goNext();
      });
      wrap.appendChild(tile);
    });
    return { hideBar: true };
  }

  /* ============ 3 · venue ============ */

  function renderVenue() {
    var v = OC.VENUES[state.venueId];
    var card = document.getElementById("venueCard");
    card.innerHTML =
      '<div class="venue-photo">' + v.name + " — photo coming soon</div>" +
      '<div class="venue-body">' +
      '<div class="venue-name">' + v.name + "</div>" +
      '<div class="venue-chips">' + v.features.map(function (f) { return '<span class="chip">' + f + "</span>"; }).join("") + "</div>" +
      (v.category === "sport" ?
        '<div class="venue-stats"><div><div class="venue-stat-label">Tonight\'s Energy</div><div class="venue-stat-value">' + "★".repeat(v.energy) + "☆".repeat(5 - v.energy) + '</div></div><div style="text-align:right"><div class="venue-stat-label">' + v.matches + ' matches happening</div><div class="venue-stat-value">' + v.playersExpected + " players expected</div></div></div>"
        : "") +
      "</div>";
    return {
      nextLabel: "Book Here",
      onNext: function () {
        state.durationMin = v.minMins;
        goNext();
      }
    };
  }

  /* ============ 4 · time ============ */

  function nextDays(n) {
    var out = [];
    var today = new Date();
    for (var i = 0; i < n; i++) {
      var d = new Date(today);
      d.setDate(today.getDate() + i);
      out.push(d);
    }
    return out;
  }

  function renderDateStrip() {
    var strip = document.getElementById("dateStrip");
    strip.innerHTML = "";
    var days = nextDays(7);
    days.forEach(function (d, i) {
      var iso = OC.dateISO(d);
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "date-chip" + (iso === state.date ? " is-active" : "");
      var dow = i === 0 ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase();
      chip.innerHTML = '<span class="dow">' + dow + '</span><span class="dom">' + d.getDate() + "</span>";
      chip.addEventListener("click", function () {
        state.date = iso;
        renderTime();
      });
      strip.appendChild(chip);
    });
  }

  function clampStart(v) {
    var maxStart = OC.DAY_END_MIN - state.durationMin;
    return Math.min(Math.max(v, OC.DAY_START_MIN), maxStart);
  }

  function updateTimeTrackUI() {
    var v = OC.VENUES[state.venueId];
    var totalSpan = OC.DAY_END_MIN - OC.DAY_START_MIN;
    var leftPct = ((state.startMin - OC.DAY_START_MIN) / totalSpan) * 100;
    var widthPct = (state.durationMin / totalSpan) * 100;
    var fill = document.getElementById("timeTrackFill");
    var handle = document.getElementById("timeHandle");
    fill.style.left = leftPct + "%";
    fill.style.width = widthPct + "%";
    handle.style.left = leftPct + "%";

    var endMin = state.startMin + state.durationMin;
    document.getElementById("timeRangeLabel").textContent = OC.formatTime(state.startMin) + " – " + OC.formatTime(endMin);
    var hrs = Math.floor(state.durationMin / 60), mins = state.durationMin % 60;
    document.getElementById("timeDurLabel").textContent =
      (hrs ? hrs + " hour" + (hrs > 1 ? "s" : "") + " " : "") + (mins ? mins + " mins" : "");
    document.getElementById("durationRule").textContent =
      v.category === "wellness" ? "15 min minimum · max 30 mins" : (v.minMins / 60) + " hour minimum · add 30 min slots";

    var extendBtns = document.querySelectorAll("#extendRow .extend-btn");
    var canExtend = state.durationMin < v.maxMins && (state.startMin + state.durationMin + 30) <= OC.DAY_END_MIN;
    extendBtns.forEach(function (b) { b.disabled = !canExtend; });

    var n = OC.peopleLooking(state.venueId, state.courtIndex || 0, state.date, state.startMin);
    document.getElementById("lookingNowText").textContent = n + " people are looking at this slot right now";
  }

  var dragging = false;
  function trackWidth() { return document.getElementById("timeTrack").getBoundingClientRect().width; }

  function setStartFromClientX(clientX) {
    var track = document.getElementById("timeTrack");
    var rect = track.getBoundingClientRect();
    var pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    var totalSpan = OC.DAY_END_MIN - OC.DAY_START_MIN;
    var raw = OC.DAY_START_MIN + pct * totalSpan;
    var snapped = Math.round(raw / OC.SLOT_STEP) * OC.SLOT_STEP;
    state.startMin = clampStart(snapped);
    updateTimeTrackUI();
  }

  function initDrag() {
    var handle = document.getElementById("timeHandle");
    var track = document.getElementById("timeTrack");

    function onDown(e) {
      dragging = true;
      handle.setPointerCapture && e.pointerId != null && handle.setPointerCapture(e.pointerId);
    }
    function onMove(e) {
      if (!dragging) return;
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      setStartFromClientX(clientX);
    }
    function onUp() { dragging = false; }

    handle.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    track.addEventListener("click", function (e) {
      if (e.target === handle) return;
      setStartFromClientX(e.clientX);
    });

    document.querySelectorAll("#extendRow .extend-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var v = OC.VENUES[state.venueId];
        if (state.durationMin + 30 > v.maxMins) return;
        state.durationMin += 30;
        updateTimeTrackUI();
      });
    });
  }
  var dragInitialized = false;

  function renderTime() {
    var v = OC.VENUES[state.venueId];
    if (state.durationMin > v.maxMins) state.durationMin = v.maxMins;
    if (state.durationMin < v.minMins) state.durationMin = v.minMins;
    state.startMin = clampStart(state.startMin);
    renderDateStrip();
    updateTimeTrackUI();
    if (!dragInitialized) { initDrag(); dragInitialized = true; }
    return { nextLabel: "Continue" };
  }

  /* ============ 5 · match ============ */

  var REASON_POOL = ["Closest to Café", "Great lighting", "Quiet tonight", "Available now", "Closest to Viewing Deck", "Popular tonight"];

  function renderMatch() {
    var v = OC.VENUES[state.venueId];
    var result = OC.findCourts(state.venueId, state.date, state.startMin, state.durationMin);
    if (state.courtIndex == null || !result.all[state.courtIndex] || !result.all[state.courtIndex].free) {
      state.courtIndex = result.best ? result.best.index : null;
    }
    var wrap = document.getElementById("matchWrap");
    wrap.innerHTML = "";

    if (!result.best) {
      wrap.innerHTML = '<div class="match-card"><div class="match-eyebrow">No courts free</div><div class="match-name">Try another time</div><p class="empty-note">Every ' + v.name.toLowerCase() + " is booked for that slot. Go back and pick a different time.</p></div>";
      return { nextDisabled: true };
    }

    var chosen = result.all[state.courtIndex];
    var reasons = [REASON_POOL[0], REASON_POOL[1], REASON_POOL[2], "Available"];
    var card = document.createElement("div");
    card.className = "match-card";
    card.innerHTML =
      '<div class="match-eyebrow">Best Match</div>' +
      '<div class="match-name">' + chosen.name + "</div>" +
      '<div class="match-reasons">' + reasons.map(function (r) { return '<div class="match-reason">' + r + "</div>"; }).join("") + "</div>" +
      '<div class="venue-stat-value" style="font-size:11px;">' + (85 + (state.courtIndex * 4) % 15) + "% of players choose this court for this time slot</div>";
    wrap.appendChild(card);

    if (result.all.length > 1) {
      var others = document.createElement("div");
      others.innerHTML = '<p class="time-panel-label">Other Courts</p>';
      var list = document.createElement("div");
      list.className = "alt-list";
      result.all.forEach(function (c) {
        var row = document.createElement("div");
        row.className = "alt-row" + (c.index === state.courtIndex ? " is-selected" : "");
        row.innerHTML =
          '<div><div class="alt-name">' + c.name + '</div><div class="alt-sub">' + (c.free ? "Available" : "Booked in this window") + '</div></div>' +
          '<div class="alt-status' + (c.free ? "" : " is-full") + '">' + (c.free ? "Available" : "Full") + "</div>";
        if (c.free) {
          row.addEventListener("click", function () {
            state.courtIndex = c.index;
            renderMatch();
          });
        }
        list.appendChild(row);
      });
      others.appendChild(list);
      wrap.appendChild(others);
    }

    return { nextDisabled: false };
  }

  /* ============ 6 · crew ============ */

  function renderCrewSlots() {
    document.querySelectorAll(".player-avatar").forEach(function (av, i) {
      if (i === 0) return; /* host */
      var slotIdx = i - 1;
      var player = state.players[slotIdx];
      var nameEl = av.parentElement.querySelector(".player-name");
      if (player) {
        av.textContent = player.initials;
        av.classList.add("is-filled");
        nameEl.textContent = player.name;
      } else {
        av.textContent = "+";
        av.classList.remove("is-filled");
        nameEl.innerHTML = "&nbsp;";
      }
    });
  }

  function renderCrew() {
    renderCrewSlots();

    var link = "offcourt.club/join/" + Math.random().toString(36).slice(2, 8);
    document.getElementById("inviteLinkText").textContent = link;
    var msg = encodeURIComponent("Join me for a game at Off Court — " + link);
    document.getElementById("whatsappShare").href = "https://wa.me/?text=" + msg;
    document.getElementById("smsShare").href = "sms:?body=" + msg;

    document.getElementById("copyLinkBtn").onclick = function () {
      if (navigator.clipboard) navigator.clipboard.writeText(link).catch(function () {});
      this.textContent = "Copied";
      var self = this;
      setTimeout(function () { self.textContent = "Copy"; }, 1500);
    };

    document.querySelectorAll(".invite-tab").forEach(function (tab) {
      tab.onclick = function () {
        state.inviteMode = tab.getAttribute("data-invite-mode");
        document.querySelectorAll(".invite-tab").forEach(function (t) { t.classList.toggle("is-active", t === tab); });
        document.querySelectorAll(".invite-panel").forEach(function (p) {
          p.classList.toggle("is-active", p.getAttribute("data-invite-panel") === state.inviteMode);
        });
      };
    });

    var memberList = document.getElementById("memberPickList");
    memberList.innerHTML = "";
    OC.MOCK_MEMBERS.forEach(function (m) {
      var picked = state.players.some(function (p) { return p.memberId === m.id; });
      var row = document.createElement("div");
      row.className = "member-pick-row" + (picked ? " is-picked" : "");
      row.innerHTML = '<div class="member-pick-avatar">' + m.initials + '</div><div class="member-pick-name">' + m.name + '</div><div class="member-pick-check">✓</div>';
      row.addEventListener("click", function () {
        var idx = state.players.findIndex(function (p) { return p.memberId === m.id; });
        if (idx > -1) {
          state.players.splice(idx, 1);
        } else if (state.players.length < 3) {
          state.players.push({ name: m.name, initials: m.initials, memberId: m.id });
        }
        renderCrew();
      });
      memberList.appendChild(row);
    });

    return { nextLabel: "Continue" };
  }

  document.querySelectorAll(".player-avatar[data-slot]").forEach(function (av) {
    av.addEventListener("click", function () {
      if (av.parentElement.querySelector(".player-name").textContent.trim() === "You (Host)") return;
      state.inviteMode = "members";
      document.querySelectorAll(".invite-tab").forEach(function (t) { t.classList.toggle("is-active", t.getAttribute("data-invite-mode") === "members"); });
      document.querySelectorAll(".invite-panel").forEach(function (p) { p.classList.toggle("is-active", p.getAttribute("data-invite-panel") === "members"); });
    });
  });

  /* ============ 7 · extras ============ */

  function renderExtras() {
    var v = OC.VENUES[state.venueId];
    var list = document.getElementById("extrasList");
    list.innerHTML = "";
    var applicable = OC.EXTRAS.filter(function (e) { return v.category === "sport" ? true : e.category === "any"; });
    applicable.forEach(function (extra) {
      var checked = state.extras.indexOf(extra.id) > -1;
      var row = document.createElement("div");
      row.className = "extra-row" + (checked ? " is-checked" : "");
      row.innerHTML =
        '<div class="extra-left"><div class="extra-check"></div><div class="extra-label">' + extra.label + "</div></div>" +
        '<div class="extra-price">₹' + extra.price + "</div>";
      row.addEventListener("click", function () {
        var idx = state.extras.indexOf(extra.id);
        if (idx > -1) state.extras.splice(idx, 1); else state.extras.push(extra.id);
        renderExtras();
      });
      list.appendChild(row);
    });
    return { nextLabel: "Continue" };
  }

  /* ============ pricing ============ */

  function courtFee() {
    var v = OC.VENUES[state.venueId];
    var perHalfHour = v.category === "sport" ? 350 : 200;
    return Math.round((state.durationMin / 30) * perHalfHour);
  }
  function extrasTotal() {
    return state.extras.reduce(function (sum, id) {
      var e = OC.EXTRAS.filter(function (x) { return x.id === id; })[0];
      return sum + (e ? e.price : 0);
    }, 0);
  }
  function grandTotal() { return courtFee() + extrasTotal(); }

  /* ============ 8 · review ============ */

  function fmtDateLabel(iso) {
    var d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  }

  function renderReview() {
    var v = OC.VENUES[state.venueId];
    var court = v.courts[state.courtIndex] || v.courts[0];
    var list = document.getElementById("reviewList");
    var rows = [
      ["Game", v.name + " – " + court],
      ["Date", fmtDateLabel(state.date)],
      ["Time", OC.formatTime(state.startMin) + " – " + OC.formatTime(state.startMin + state.durationMin)],
      ["Duration", (state.durationMin >= 60 ? Math.floor(state.durationMin / 60) + "h " : "") + (state.durationMin % 60 ? (state.durationMin % 60) + "m" : "")]
    ];
    if (v.category === "sport") {
      rows.push(["Players", (1 + state.players.length) + " Players"]);
    }
    if (state.extras.length) {
      rows.push(["Extras", state.extras.map(function (id) {
        return OC.EXTRAS.filter(function (e) { return e.id === id; })[0].label;
      }).join(", ")]);
    }
    list.innerHTML = rows.map(function (r) {
      return '<div class="review-row"><div class="review-label">' + r[0] + '</div><div class="review-value">' + r[1] + "</div></div>";
    }).join("");
    document.getElementById("totalAmount").textContent = OC.money(grandTotal());

    return {
      nextLabel: "Confirm & Reserve",
      onNext: function () {
        var v2 = OC.VENUES[state.venueId];
        var booking = OC.addBooking({
          venueId: state.venueId,
          venueName: v2.name,
          courtIndex: state.courtIndex || 0,
          courtName: v2.courts[state.courtIndex || 0],
          date: state.date,
          startMin: state.startMin,
          durationMin: state.durationMin,
          players: state.players.slice(),
          extras: state.extras.slice(),
          total: grandTotal(),
          category: v2.category
        });
        state.lastBooking = booking;
        goNext();
      }
    };
  }

  /* ============ 9 · confirm ============ */

  function toICSDate(iso, min) {
    var d = new Date(iso + "T00:00:00");
    d.setMinutes(d.getMinutes() + min);
    return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }

  function renderConfirm() {
    var v = OC.VENUES[state.venueId];
    var court = v.courts[state.courtIndex || 0];
    var card = document.getElementById("confirmSummary");
    card.innerHTML =
      '<div class="booking-summary-title">' + v.name + " – " + court + "</div>" +
      '<div class="booking-summary-sub">' + fmtDateLabel(state.date) + " · " + OC.formatTime(state.startMin) + " – " + OC.formatTime(state.startMin + state.durationMin) + "</div>";

    document.getElementById("addCalendarBtn").onclick = function () {
      var ics = "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:Off Court — " + v.name + "\nDTSTART:" + toICSDate(state.date, state.startMin) +
        "\nDTEND:" + toICSDate(state.date, state.startMin + state.durationMin) + "\nLOCATION:Off Court Social Club, Bettahalasuru\nEND:VEVENT\nEND:VCALENDAR";
      var blob = new Blob([ics], { type: "text/calendar" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "off-court-booking.ics";
      a.click();
    };
    document.getElementById("getDirectionsBtn").onclick = function () {
      window.open("https://maps.google.com/?q=Off+Court+Social+Club+Bettahalasuru+North+Bengaluru", "_blank", "noopener");
    };

    var hasInvites = v.category === "sport" && state.players.length > 0;
    var hideBar = true;

    var actionsHTML = '<div class="confirm-actions" style="margin-top:0;">';
    if (hasInvites) {
      actionsHTML += '<button class="app-btn app-btn-primary" id="inviteMoreBtn" type="button">Invite More Friends</button>';
    } else {
      actionsHTML += '<button class="app-btn app-btn-primary" id="doneBtn" type="button">Done</button>';
    }
    actionsHTML += "</div>";
    var existing = card.parentElement.querySelector(".confirm-actions.js-injected");
    if (existing) existing.remove();
    var div = document.createElement("div");
    div.innerHTML = actionsHTML;
    div.firstChild.classList.add("js-injected");
    card.parentElement.appendChild(div.firstChild);

    var inviteMoreBtn = document.getElementById("inviteMoreBtn");
    if (inviteMoreBtn) inviteMoreBtn.onclick = goNext;
    var doneBtn = document.getElementById("doneBtn");
    if (doneBtn) doneBtn.onclick = function () { window.location.href = "index.html"; };

    return { hideBar: hideBar };
  }

  /* ============ 10 · invite sent ============ */

  function renderInviteSent() {
    var card = document.getElementById("inviteSentCard");
    card.innerHTML =
      '<div class="booking-summary-title" style="text-align:center;">You\'re invited to play!</div>' +
      '<div class="invite-sent-sub">Invites sent to ' + state.players.length + " friend" + (state.players.length === 1 ? "" : "s") + ".</div>";

    var crew = document.getElementById("crewList");
    var rows = [{ name: "You (Host)", accepted: true }].concat(
      state.players.map(function (p) { return { name: p.name, accepted: false }; })
    );
    crew.innerHTML = rows.map(function (r) {
      return '<div class="crew-row"><span class="crew-status-dot' + (r.accepted ? "" : " is-pending") + '"></span><span class="crew-name">' + r.name + '</span><span class="crew-status-text">' + (r.accepted ? "Accepted" : "Pending") + "</span></div>";
    }).join("");

    var actionsHTML = '<div class="confirm-actions"><button class="app-btn app-btn-primary" id="doneInviteBtn" type="button">Done</button></div>';
    var existing = crew.parentElement.querySelector(".confirm-actions.js-injected2");
    if (existing) existing.remove();
    var div = document.createElement("div");
    div.innerHTML = actionsHTML;
    div.firstChild.classList.add("js-injected2");
    crew.parentElement.appendChild(div.firstChild);
    document.getElementById("doneInviteBtn").onclick = function () { window.location.href = "index.html"; };

    /* gentle simulated acceptances so the screen feels alive */
    state.players.forEach(function (p, i) {
      setTimeout(function () {
        var rowsNow = document.querySelectorAll("#crewList .crew-row");
        var row = rowsNow[i + 1];
        if (!row) return;
        row.querySelector(".crew-status-dot").classList.remove("is-pending");
        row.querySelector(".crew-status-text").textContent = "Accepted";
      }, 1200 + i * 900);
    });

    return { hideBar: true };
  }

  var RENDERERS = {
    "mood": renderMood,
    "zone": renderZone,
    "wellness-pick": renderWellnessPick,
    "venue": renderVenue,
    "time": renderTime,
    "match": renderMatch,
    "crew": renderCrew,
    "extras": renderExtras,
    "review": renderReview,
    "confirm": renderConfirm,
    "invite-sent": renderInviteSent
  };

  showStep();
})();
