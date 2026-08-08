/* ============================================================
   OFF COURT — shared mock data + state layer for the booking
   flow, wellness flow and member dashboard. No real backend:
   everything lives in localStorage so the prototype behaves
   consistently across reloads without needing a server.
   ============================================================ */

var OC = (function () {
  "use strict";

  var DAY_START_MIN = 6 * 60;   /* 6 AM */
  var DAY_END_MIN = 24 * 60;    /* 12 AM */
  var SLOT_STEP = 30;

  var ZONES = [
    { id: "padel", label: "Paddle Courts", sub: "3 Courts", top: 14, left: 30, venue: "padel" },
    { id: "pickleball", label: "Pickle Court", sub: "1 Court", top: 22, left: 62, venue: "pickleball" },
    { id: "turf", label: "Box Arena", sub: "Cricket / Football", top: 55, left: 20, venue: "turf" },
    { id: "wellness", label: "Wellness Zone", sub: "Yoga, Recovery", top: 66, left: 60, venue: null },
    { id: "cafe", label: "Café", sub: "Good food. Great people", top: 82, left: 32, venue: null }
  ];

  var VENUES = {
    padel: {
      id: "padel", zone: "padel", name: "Paddle Courts", kicker: "PADDLE COURTS",
      category: "sport", courts: ["Court 1", "Court 2", "Court 3"],
      minMins: 60, stepMins: 30, maxMins: 150,
      energy: 4, playersExpected: 18, matches: 3,
      features: ["Floodlit", "Premium Surface", "Open till 12 AM"],
      img: null
    },
    turf: {
      id: "turf", zone: "turf", name: "Multisport Turf", kicker: "MULTISPORT TURF",
      category: "sport", courts: ["Turf 1"],
      minMins: 60, stepMins: 30, maxMins: 150,
      energy: 4, playersExpected: 12, matches: 2,
      features: ["Floodlit", "All-Weather Turf", "Open till 12 AM"],
      img: null
    },
    pickleball: {
      id: "pickleball", zone: "pickleball", name: "Pickleball Court", kicker: "PICKLEBALL COURT",
      category: "sport", courts: ["Court 1"],
      minMins: 60, stepMins: 30, maxMins: 150,
      energy: 3, playersExpected: 8, matches: 1,
      features: ["Floodlit", "Premium Surface", "Open till 12 AM"],
      img: null
    },
    icebath: {
      id: "icebath", zone: "wellness", name: "Ice Bath", kicker: "ICE BATH",
      category: "wellness", courts: ["Bath 1", "Bath 2"],
      minMins: 15, stepMins: 15, maxMins: 30,
      features: ["3–10°C", "Towels Provided", "Max 30 Mins"],
      img: null
    },
    sauna: {
      id: "sauna", zone: "wellness", name: "Sauna", kicker: "SAUNA",
      category: "wellness", courts: ["Sauna 1"],
      minMins: 15, stepMins: 15, maxMins: 30,
      features: ["70–90°C", "Towels Provided", "Max 30 Mins"],
      img: null
    }
  };

  var EXTRAS = [
    { id: "coach", label: "Coach", price: 800, category: "sport" },
    { id: "racket", label: "Racket Rental", price: 200, category: "sport" },
    { id: "ball", label: "Ball Rental", price: 100, category: "sport" },
    { id: "locker", label: "Locker", price: 150, category: "any" },
    { id: "coconut", label: "Tender Coconut", price: 80, category: "any" },
    { id: "recovery", label: "Recovery Session", price: 600, category: "any" }
  ];

  var MOCK_MEMBERS = [
    { id: "m1", name: "Avanish", initials: "A" },
    { id: "m2", name: "Rohan", initials: "R" },
    { id: "m3", name: "Priya", initials: "P" },
    { id: "m4", name: "Esha", initials: "E" },
    { id: "m5", name: "Kabir", initials: "K" },
    { id: "m6", name: "Diya", initials: "D" }
  ];

  /* ---------- tiny deterministic hash -> pseudo-random, so the same
     court/date always looks "booked" the same way on every load ---------- */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function seededRandom(seed) {
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  function dateISO(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function formatTime(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    var ap = h >= 12 ? "PM" : "AM";
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + (m ? ":" + String(m).padStart(2, "0") : "") + " " + ap;
  }

  function money(n) {
    return "₹" + n.toLocaleString("en-IN");
  }

  function formatDateLabel(iso) {
    var d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  }

  /* ---------- mock "already booked" slots, seeded per venue+court+date ---------- */
  function seededBookedSlots(venueId, courtIndex, iso) {
    var venue = VENUES[venueId];
    var totalSlots = (DAY_END_MIN - DAY_START_MIN) / SLOT_STEP;
    var seed = hash(venueId + "|" + courtIndex + "|" + iso);
    var booked = {};
    var count = 3 + Math.floor(seededRandom(seed) * 5); /* 3-7 booked slots */
    for (var i = 0; i < count; i++) {
      var r = seededRandom(seed + i * 97.13);
      var slotIdx = Math.floor(r * totalSlots);
      var span = 2 + Math.floor(seededRandom(seed + i * 51.7) * 2); /* 1-2hr block */
      for (var s = 0; s < span; s++) {
        if (slotIdx + s < totalSlots) booked[slotIdx + s] = true;
      }
    }
    return booked;
  }

  /* ---------- localStorage-backed user bookings, layered on top of the
     seeded mock data so a booking made in this demo actually blocks
     the slot if you go looking for it again ---------- */
  function loadBookings() {
    try { return JSON.parse(localStorage.getItem("oc_myBookings") || "[]"); }
    catch (e) { return []; }
  }
  function saveBookings(list) {
    localStorage.setItem("oc_myBookings", JSON.stringify(list));
  }
  function addBooking(booking) {
    var list = loadBookings();
    booking.id = "bk_" + Date.now();
    booking.createdAt = Date.now();
    list.push(booking);
    saveBookings(list);
    return booking;
  }

  function userBookedSlots(venueId, courtIndex, iso) {
    var booked = {};
    loadBookings().forEach(function (b) {
      if (b.venueId !== venueId || b.courtIndex !== courtIndex || b.date !== iso) return;
      var startSlot = (b.startMin - DAY_START_MIN) / SLOT_STEP;
      var span = b.durationMin / SLOT_STEP;
      for (var s = 0; s < span; s++) booked[startSlot + s] = true;
    });
    return booked;
  }

  /* returns an array of { slot, min, booked } across the full day for one court */
  function courtAvailability(venueId, courtIndex, iso) {
    var seeded = seededBookedSlots(venueId, courtIndex, iso);
    var mine = userBookedSlots(venueId, courtIndex, iso);
    var totalSlots = (DAY_END_MIN - DAY_START_MIN) / SLOT_STEP;
    var out = [];
    for (var i = 0; i < totalSlots; i++) {
      out.push({
        slot: i,
        min: DAY_START_MIN + i * SLOT_STEP,
        booked: !!seeded[i] || !!mine[i]
      });
    }
    return out;
  }

  /* is a given [startMin, startMin+durationMin) range free on this court? */
  function isRangeFree(venueId, courtIndex, iso, startMin, durationMin) {
    var avail = courtAvailability(venueId, courtIndex, iso);
    var startSlot = (startMin - DAY_START_MIN) / SLOT_STEP;
    var span = durationMin / SLOT_STEP;
    for (var s = 0; s < span; s++) {
      var slot = avail[startSlot + s];
      if (!slot || slot.booked) return false;
    }
    return true;
  }

  /* best-match court + alternatives for a chosen time range */
  function findCourts(venueId, iso, startMin, durationMin) {
    var venue = VENUES[venueId];
    var results = venue.courts.map(function (name, idx) {
      return { index: idx, name: name, free: isRangeFree(venueId, idx, iso, startMin, durationMin) };
    });
    var free = results.filter(function (r) { return r.free; });
    return { all: results, free: free, best: free[0] || null };
  }

  /* deterministic-ish "N people looking at this slot" — stable per
     venue/court/date/time within a short window, small live jitter */
  function peopleLooking(venueId, courtIndex, iso, startMin) {
    var seed = hash(venueId + "|" + courtIndex + "|" + iso + "|" + startMin);
    var base = 2 + Math.floor(seededRandom(seed) * 8);
    var jitter = Math.floor(seededRandom(Date.now() / 15000) * 3) - 1;
    return Math.max(1, base + jitter);
  }

  /* ---------- mock member / sign-in state ---------- */
  function getMember() {
    try { return JSON.parse(localStorage.getItem("oc_member") || "null"); }
    catch (e) { return null; }
  }
  function signIn(name) {
    var member = {
      name: name || "You",
      signedIn: true,
      stats: {
        minutesPlayed: 2140,
        tournaments: 3,
        rating: 4.6,
        streak: 5
      }
    };
    localStorage.setItem("oc_member", JSON.stringify(member));
    return member;
  }
  function signOut() {
    localStorage.removeItem("oc_member");
  }

  return {
    DAY_START_MIN: DAY_START_MIN, DAY_END_MIN: DAY_END_MIN, SLOT_STEP: SLOT_STEP,
    ZONES: ZONES, VENUES: VENUES, EXTRAS: EXTRAS, MOCK_MEMBERS: MOCK_MEMBERS,
    dateISO: dateISO, formatTime: formatTime, money: money, formatDateLabel: formatDateLabel,
    courtAvailability: courtAvailability, isRangeFree: isRangeFree, findCourts: findCourts,
    peopleLooking: peopleLooking,
    loadBookings: loadBookings, addBooking: addBooking,
    getMember: getMember, signIn: signIn, signOut: signOut
  };
})();
