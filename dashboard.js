/* ============================================================
   OFF COURT — member dashboard, mock sign-in + stats
   ============================================================ */

(function () {
  "use strict";

  if (typeof OC === "undefined") return;

  var signinPanel = document.getElementById("signinPanel");
  var dashWrap = document.getElementById("dashWrap");

  document.getElementById("backBtn").addEventListener("click", function () {
    window.location.href = "index.html";
  });

  function seedPastGamesIfEmpty() {
    if (OC.loadBookings().length) return;
    var past1 = new Date(); past1.setDate(past1.getDate() - 6);
    var past2 = new Date(); past2.setDate(past2.getDate() - 13);
    OC.addBooking({
      venueId: "padel", venueName: OC.VENUES.padel.name, courtIndex: 1, courtName: "Court 2",
      date: OC.dateISO(past1), startMin: 19 * 60, durationMin: 90,
      players: [{ name: "Avanish", initials: "A" }, { name: "Rohan", initials: "R" }],
      extras: ["coach"], total: 1850, category: "sport"
    });
    OC.addBooking({
      venueId: "sauna", venueName: OC.VENUES.sauna.name, courtIndex: 0, courtName: "Sauna 1",
      date: OC.dateISO(past2), startMin: 8 * 60, durationMin: 30,
      players: [], extras: [], total: 400, category: "wellness"
    });
  }

  function nowMinTotal() {
    var d = new Date();
    return { iso: OC.dateISO(d), min: d.getHours() * 60 + d.getMinutes() };
  }

  function isPast(b) {
    var now = nowMinTotal();
    if (b.date < now.iso) return true;
    if (b.date > now.iso) return false;
    return (b.startMin + b.durationMin) <= now.min;
  }

  function renderGameRow(b) {
    var v = OC.VENUES[b.venueId] || {};
    var label = (b.venueName || v.name || "Session") + (b.courtName ? " – " + b.courtName : "");
    var meta = OC.formatDateLabel(b.date) + " · " + OC.formatTime(b.startMin) + " – " + OC.formatTime(b.startMin + b.durationMin);
    return '<div class="game-row"><div class="game-row-main"><div class="game-venue">' + label + '</div><div class="game-meta">' + meta + '</div></div><div class="game-badge' + (isPast(b) ? " is-done" : "") + '">' + (isPast(b) ? "Completed" : "Upcoming") + "</div></div>";
  }

  function renderPanels() {
    var bookings = OC.loadBookings().slice().sort(function (a, b) { return (a.date + a.startMin) < (b.date + b.startMin) ? 1 : -1; });
    var upcoming = bookings.filter(function (b) { return !isPast(b); });
    var past = bookings.filter(isPast);

    var upcomingEl = document.getElementById("upcomingPanel");
    var pastEl = document.getElementById("pastPanel");
    upcomingEl.innerHTML = upcoming.length ? upcoming.map(renderGameRow).join("") : '<p class="empty-note">No upcoming games yet — go book one.</p>';
    pastEl.innerHTML = past.length ? past.map(renderGameRow).join("") : '<p class="empty-note">No past games yet.</p>';
  }

  document.querySelectorAll(".dash-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var target = tab.getAttribute("data-tab");
      document.querySelectorAll(".dash-tab").forEach(function (t) { t.classList.toggle("is-active", t === tab); });
      document.querySelectorAll(".dash-panel").forEach(function (p) { p.classList.toggle("is-active", p.getAttribute("data-panel") === target); });
    });
  });

  function renderSignedIn(member) {
    signinPanel.hidden = true;
    dashWrap.hidden = false;
    document.getElementById("signOutBtn").hidden = false;
    document.getElementById("dashAvatar").textContent = member.name.charAt(0).toUpperCase();
    document.getElementById("dashName").textContent = member.name;

    var stats = [
      [member.stats.minutesPlayed.toLocaleString("en-IN"), "Minutes Played"],
      [member.stats.tournaments, "Tournaments"],
      [member.stats.rating.toFixed(1), "Game Rating"],
      [member.stats.streak, "Week Streak"]
    ];
    document.getElementById("statsGrid").innerHTML = stats.map(function (s) {
      return '<div class="stat-tile"><div class="stat-value">' + s[0] + '</div><div class="stat-label">' + s[1] + "</div></div>";
    }).join("");

    seedPastGamesIfEmpty();
    renderPanels();
  }

  function renderSignedOut() {
    signinPanel.hidden = false;
    dashWrap.hidden = true;
    document.getElementById("signOutBtn").hidden = true;
  }

  document.getElementById("signInBtn").addEventListener("click", function () {
    var name = document.getElementById("nameInput").value.trim() || "You";
    var member = OC.signIn(name);
    renderSignedIn(member);
  });
  document.getElementById("nameInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") document.getElementById("signInBtn").click();
  });

  document.getElementById("signOutBtn").addEventListener("click", function () {
    OC.signOut();
    renderSignedOut();
  });

  var existing = OC.getMember();
  if (existing && existing.signedIn) renderSignedIn(existing);
  else renderSignedOut();
})();
