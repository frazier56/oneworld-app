/* One World — agent video page tracker. ADMIN30 overlay 7, 3 Oct 2026.
 *
 * The six /v/agent/<slug>/ pages are plain HTML, outside the app, so nothing counted them: not
 * a view, not a play, not a tap on "create my profile". This file sends those moments to the
 * same collector the app uses, with the SAME visitor id the app keeps in this browser
 * (localStorage "ow_analytics_visitor_v1"), so a person who watches ES3, taps the button and
 * signs up shows up in the admin console as one person with one story.
 *
 * Loaded with:  <script src="/v/track.js" data-video="es3" defer></script>
 * Fire-and-forget, never throws, sends nothing if the browser asks not to be tracked.
 */
(function () {
  try {
    var me = document.currentScript;
    var slug = (me && me.getAttribute("data-video")) || (location.pathname.match(/\/v\/agent\/([a-z0-9]+)/i) || [])[1] || "unknown";
    if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl) return;

    var URL_ = "https://wseblryyqxawvbjmylbo.supabase.co/functions/v1/track-oneworld-event";
    var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZWJscnl5cXhhd3Ziam15bGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU4NjksImV4cCI6MjA5MzUyMTg2OX0.y2yfMwSC_eh_jzI5eXsp6qD5zkl0OICtESV070EhRQM"; // the app's public anon key (same one every page ships)
    var uuid = function () {
      try { return crypto.randomUUID(); } catch (e) { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) + "-" + Math.random().toString(36).slice(2); }
    };
    var store = function (area, k) {
      try { var v = area.getItem(k); if (v && v.length >= 16) return v; var n = uuid(); area.setItem(k, n); return n; } catch (e) { return uuid(); }
    };
    var visitor = store(window.localStorage, "ow_analytics_visitor_v1");
    var session = store(window.sessionStorage, "ow_analytics_session_v1");

    var tags = {};
    try {
      var q = new URLSearchParams(location.search);
      ["src", "ref", "c", "promo", "qr", "utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach(function (k) {
        var v = q.get(k); if (v !== null) tags[k] = v.replace(/[^\w .:\/+-]/g, "").slice(0, 80) || true;
      });
      ["gclid", "fbclid", "ttclid"].forEach(function (k) { if (q.has(k)) tags[k] = true; });
    } catch (e) {}

    var referrer = "";
    try {
      if (document.referrer) {
        var r = new URL(document.referrer);
        referrer = r.origin === location.origin ? r.origin + r.pathname : r.origin;
      }
    } catch (e) {}

    var send = function (name, extra) {
      try {
        var meta = { video: slug };
        for (var k in tags) meta[k] = tags[k];
        for (var j in (extra || {})) meta[j] = extra[j];
        var body = JSON.stringify({
          event_name: name, event_category: "video", product: "onehome",
          page_path: location.pathname, referrer: referrer, visitor_id: visitor, session_id: session,
          screen_width: (screen && screen.width) || 0, screen_height: (screen && screen.height) || 0, metadata: meta
        });
        fetch(URL_, { method: "POST", keepalive: true, mode: "cors",
          headers: { "content-type": "application/json", "apikey": KEY, "authorization": "Bearer " + KEY },
          body: body }).catch(function () {});
      } catch (e) {}
    };

    send("page_view", { landing: true });

    var v = document.querySelector("video");
    if (v) {
      var played = false, marks = {};
      v.addEventListener("play", function () { if (!played) { played = true; send("video_play"); } });
      v.addEventListener("timeupdate", function () {
        if (!v.duration) return;
        var pct = Math.floor((v.currentTime / v.duration) * 100);
        [25, 50, 75].forEach(function (m) { if (pct >= m && !marks[m]) { marks[m] = true; send("video_progress", { pct: m }); } });
      });
      v.addEventListener("ended", function () { send("video_complete"); });
    }
    Array.prototype.forEach.call(document.querySelectorAll('a[href*="/join"]'), function (a) {
      a.addEventListener("click", function () { send("video_cta", { button: a.className || "link" }); }, { capture: true });
    });
  } catch (e) {}
})();
