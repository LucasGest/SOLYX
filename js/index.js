// ===== CONFIG FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAGwiJt0k6P3K0v3LsbxwsTHK1klmyRYAc",
  authDomain: "solyx-86700.firebaseapp.com",
  projectId: "solyx-86700",
  storageBucket: "solyx-86700.firebasestorage.app",
  messagingSenderId: "970013885074",
  appId: "1:970013885074:web:f634f126b9e0a0dc869c4b",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== CONFIG HENRIK =====
const HENRIK_API_KEY = "HDEV-e192f142-bc3c-49a0-aaf9-cfc4942390e7";

// ===== CURSOR =====
const cursor = document.getElementById("cursor");
const ring = document.getElementById("cursor-ring");
let mx = 0,
  my = 0,
  rx = 0,
  ry = 0;

document.addEventListener("mousemove", (e) => {
  mx = e.clientX;
  my = e.clientY;
  cursor.style.left = mx + "px";
  cursor.style.top = my + "px";
});
(function animRing() {
  rx += (mx - rx) * 0.12;
  ry += (my - ry) * 0.12;
  ring.style.left = rx + "px";
  ring.style.top = ry + "px";
  requestAnimationFrame(animRing);
})();

// ===== STARS =====
const canvas = document.getElementById("stars-canvas");
const ctx = canvas.getContext("2d");
let stars = [],
  shootingStars = [];

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  initStars();
}
window.addEventListener("resize", resize);

function initStars() {
  stars = [];
  for (let i = 0; i < 280; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.2,
      opacity: Math.random() * 0.8 + 0.1,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleDir: Math.random() > 0.5 ? 1 : -1,
    });
  }
}

setInterval(
  () =>
    shootingStars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.5,
      len: Math.random() * 120 + 60,
      speed: Math.random() * 8 + 6,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
      opacity: 1,
      life: 0,
      maxLife: 60,
    }),
  3000,
);

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  stars.forEach((s) => {
    s.opacity += s.twinkleSpeed * s.twinkleDir;
    if (s.opacity > 1 || s.opacity < 0.05) s.twinkleDir *= -1;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(200,200,255," + s.opacity + ")";
    ctx.fill();
  });
  shootingStars = shootingStars.filter((ss) => {
    ss.life++;
    ss.x += Math.cos(ss.angle) * ss.speed;
    ss.y += Math.sin(ss.angle) * ss.speed;
    ss.opacity = 1 - ss.life / ss.maxLife;
    const grad = ctx.createLinearGradient(
      ss.x,
      ss.y,
      ss.x - Math.cos(ss.angle) * ss.len,
      ss.y - Math.sin(ss.angle) * ss.len,
    );
    grad.addColorStop(0, "rgba(255,255,255," + ss.opacity + ")");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.moveTo(ss.x, ss.y);
    ctx.lineTo(
      ss.x - Math.cos(ss.angle) * ss.len,
      ss.y - Math.sin(ss.angle) * ss.len,
    );
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return ss.life < ss.maxLife;
  });
  requestAnimationFrame(draw);
}
resize();
draw();

// ===== HENRIK API =====
async function fetchRank(riotName, riotTag) {
  const url =
    "https://api.henrikdev.xyz/valorant/v2/mmr/eu/" +
    encodeURIComponent(riotName) +
    "/" +
    encodeURIComponent(riotTag);
  try {
    const res = await fetch(url, {
      headers: { Authorization: HENRIK_API_KEY },
    });
    const json = await res.json();
    if (!res.ok || !json.data) return null;
    const cd = json.data.current_data;
    if (!cd) return null;
    const rankName =
      cd.currenttier_patched ||
      cd.currenttierpatched ||
      cd.currentTierPatched ||
      null;
    return {
      rank: rankName || "Non classé",
      rankIcon: (cd.images && cd.images.small) || null,
      rr: cd.ranking_in_tier != null ? cd.ranking_in_tier : null,
    };
  } catch {
    return null;
  }
}

// ===== LOAD DATA (Firebase + data.json pour joueurs) =====
// Expose une promesse globale pour le loader
window._dataReady = false;
async function loadData() {
  try {
    // Joueurs → data.json (pas encore dans Firebase)
    const res = await fetch("js/data.json");
    const localData = await res.json();
    renderPlayers(localData.players || []);

    // Matchs → Firebase uniquement
    try {
      const q = query(collection(db, "matches"), orderBy("date", "desc"));
      const snap = await getDocs(q);
      const matches = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderMatches(matches);
    } catch {
      renderMatches([]);
    }

    // Tournois → Firebase uniquement
    try {
      const snap = await getDocs(collection(db, "tournaments"));
      const tournaments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTournaments(tournaments);
    } catch {
      renderTournaments([]);
    }

    // Rangs Valorant — délai entre chaque appel pour éviter le 429
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const p of localData.players || []) {
      if (!p.riotName || !p.riotTag) continue;
      await sleep(400); // 400ms entre chaque appel
      const rankData = await fetchRank(p.riotName, p.riotTag);
      if (!rankData) continue;
      const card = document.getElementById("card-" + p.id);
      if (!card) continue;
      const rankEl = card.querySelector(".player-rank-text");
      if (rankEl) rankEl.textContent = rankData.rank;
      const iconEl = card.querySelector(".rank-icon");
      if (iconEl && rankData.rankIcon) {
        iconEl.src = rankData.rankIcon;
        iconEl.style.display = "inline";
      }
      const rrEl = card.querySelector(".player-rr");
      if (rrEl && rankData.rr !== null) {
        rrEl.textContent = rankData.rr + " RR";
        rrEl.style.display = "block";
      }
    }
  } catch (e) {
    // silently fail
  } finally {
    window._dataReady = true;
    initScrollReveal();
  }
}

// ===== RENDER PLAYERS =====
function renderPlayers(players) {
  const grid = document.getElementById("roster-grid");
  if (!grid) return;
  grid.innerHTML = players
    .map((p) => {
      const trackerBtn = p.trackerUrl
        ? '<a class="tracker-link" href="' +
          p.trackerUrl +
          '" target="_blank" rel="noopener noreferrer"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>tracker.gg</a>'
        : "";
      return (
        '<div class="player-card' +
        (p.trial ? " trial" : p.sub ? " sub" : "") +
        '" id="card-' +
        p.id +
        '">' +
        '<div class="player-avatar">' +
        p.initials +
        "</div>" +
        '<div class="player-role">' +
        p.role +
        "</div>" +
        '<div class="player-name">' +
        p.pseudo +
        "</div>" +
        '<div class="player-real">' +
        (p.realName || "") +
        "</div>" +
        '<div class="player-badge">' +
        p.badge +
        "</div>" +
        '<div class="player-rank">' +
        '<img class="rank-icon" src="" alt="rank" style="display:none; width:22px; height:22px; object-fit:contain;" />' +
        '<span class="player-rank-text">Chargement...</span>' +
        "</div>" +
        '<span class="player-rr" style="display:none; font-size:0.65rem; color:var(--muted); margin-top:4px; display:block;"></span>' +
        trackerBtn +
        "</div>"
      );
    })
    .join("");
}

// ===== COUNTDOWN PROCHAIN MATCH =====
function renderCountdown(matches) {
  const header = document.querySelector(".matches-header");
  if (!header) return;

  // Cherche le prochain match (date future)
  const now = new Date();
  const upcoming = matches
    .filter((m) => m.nextMatchDate && new Date(m.nextMatchDate) > now)
    .sort((a, b) => new Date(a.nextMatchDate) - new Date(b.nextMatchDate))[0];

  if (!upcoming) return;

  const target = new Date(upcoming.nextMatchDate);

  const banner = document.createElement("div");
  banner.className = "next-match-banner";
  banner.innerHTML = `
		<div>
			<div class="next-match-label">Prochain match</div>
			<div class="next-match-info">SOLYX vs ${upcoming.nextMatchOpponent || "???"}
				${upcoming.tournament ? " · " + upcoming.tournament : ""}
			</div>
		</div>
		<div class="next-match-countdown" id="countdown-wrap">
			<div class="countdown-unit"><div class="countdown-num" id="cd-days">00</div><div class="countdown-lbl">Jours</div></div>
			<div class="countdown-sep">:</div>
			<div class="countdown-unit"><div class="countdown-num" id="cd-hours">00</div><div class="countdown-lbl">Heures</div></div>
			<div class="countdown-sep">:</div>
			<div class="countdown-unit"><div class="countdown-num" id="cd-mins">00</div><div class="countdown-lbl">Min</div></div>
			<div class="countdown-sep">:</div>
			<div class="countdown-unit"><div class="countdown-num" id="cd-secs">00</div><div class="countdown-lbl">Sec</div></div>
		</div>`;

  header.insertAdjacentElement("afterend", banner);

  function tick() {
    const diff = new Date(target) - new Date();
    if (diff <= 0) {
      document.getElementById("countdown-wrap").innerHTML =
        '<span style="font-family:Orbitron,monospace;color:var(--green);font-size:0.85rem;letter-spacing:0.2em">MATCH EN COURS !</span>';
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    document.getElementById("cd-days").textContent = String(d).padStart(2, "0");
    document.getElementById("cd-hours").textContent = String(h).padStart(
      2,
      "0",
    );
    document.getElementById("cd-mins").textContent = String(m).padStart(2, "0");
    document.getElementById("cd-secs").textContent = String(s).padStart(2, "0");
    setTimeout(tick, 1000);
  }
  tick();
}

// ===== RENDER MATCHES =====
function renderMatches(matches) {
  renderCountdown(matches);
  const track = document.getElementById("matches-track");
  const wrapper = document.querySelector(".matches-track-wrapper");
  const nav = document.querySelector(".matches-nav");
  if (!track) return;

  if (!matches.length) {
    if (wrapper) wrapper.style.display = "none";
    if (nav) nav.style.display = "none";
    // Injecter dans un conteneur centré identique au palmarès
    const emptyWrap = document.createElement("div");
    emptyWrap.className = "matches-empty-wrap";
    emptyWrap.innerHTML =
      '<div class="empty-section"><div class="empty-section-icon">⚔️</div><div class="empty-section-text">Aucun match enregistré pour le moment.</div></div>';
    wrapper.insertAdjacentElement("afterend", emptyWrap);
    return;
  }

  // Nettoyer l'éventuel empty state et réafficher le carrousel
  const prevEmpty = document.querySelector(".matches-empty-wrap");
  if (prevEmpty) prevEmpty.remove();
  if (wrapper) wrapper.style.display = "";
  if (nav) nav.style.display = "";

  track.innerHTML = matches
    .map((m) => {
      const dateObj = new Date(m.date);
      const dateStr = dateObj
        .toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .toUpperCase();
      const twitchBtn = m.twitchUrl
        ? '<a class="twitch-link" href="' +
          m.twitchUrl +
          '" target="_blank" rel="noopener noreferrer">' +
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>VOD</a>'
        : "";
      const tournament = m.tournament || "";
      return (
        '<div class="match-card ' +
        (m.result || "loss") +
        '">' +
        '<div class="match-meta">' +
        '<span class="match-date">' +
        dateStr +
        "</span>" +
        '<span class="match-time">' +
        (m.time || "") +
        "</span>" +
        "</div>" +
        '<div class="match-vs">' +
        '<span class="match-team">SOLYX</span>' +
        '<span class="match-score">' +
        (m.score || "—") +
        "</span>" +
        '<span class="match-team right">' +
        (m.opponent || "—") +
        "</span>" +
        "</div>" +
        '<div class="match-footer">' +
        '<span class="match-tournament">' +
        tournament +
        "</span>" +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        twitchBtn +
        '<span class="match-result-tag">' +
        (m.result === "win" ? "VICTOIRE" : "DÉFAITE") +
        "</span>" +
        "</div>" +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  // Carrousel
  const CARD_WIDTH = 280 + 19;
  const VISIBLE = Math.floor(track.parentElement.offsetWidth / CARD_WIDTH);
  let current = 0;
  const max = Math.max(0, matches.length - VISIBLE);

  const btnPrev = document.getElementById("matches-prev");
  const btnNext = document.getElementById("matches-next");

  function updateCarousel() {
    track.style.transform = "translateX(-" + current * CARD_WIDTH + "px)";
    btnPrev.disabled = current === 0;
    btnNext.disabled = current >= max;
  }

  btnPrev.onclick = () => {
    if (current > 0) {
      current--;
      updateCarousel();
    }
  };
  btnNext.onclick = () => {
    if (current < max) {
      current++;
      updateCarousel();
    }
  };

  updateCarousel();
}

// ===== RENDER TOURNAMENTS =====
function renderTournaments(tournaments) {
  const list = document.getElementById("results-list");
  if (!list) return;
  if (!tournaments.length) {
    list.innerHTML =
      '<div class="empty-section"><div class="empty-section-icon">🏆</div><div class="empty-section-text">Aucun tournoi enregistré pour le moment.</div></div>';
    return;
  }
  list.innerHTML = tournaments
    .map(
      (t) =>
        '<div class="result-item ' +
        (t.type || "loss") +
        '">' +
        '<div class="result-placement">' +
        (t.placement || "—") +
        "</div>" +
        '<div class="result-info">' +
        '<div class="result-tournament">' +
        (t.name || "—") +
        "</div>" +
        '<div class="result-date">' +
        (t.date || "") +
        "</div>" +
        "</div>" +
        '<div class="result-tag">' +
        (t.tag || "—") +
        "</div>" +
        "</div>",
    )
    .join("");
}

// ===== SCROLL REVEAL =====
function initScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.style.opacity = 1;
      });
    },
    { threshold: 0.1 },
  );
  document.querySelectorAll(".player-card, .result-item").forEach((el) => {
    el.style.opacity = 0;
    el.style.transition =
      "opacity 0.6s, transform 0.3s, border-color 0.3s, box-shadow 0.3s";
    observer.observe(el);
  });
}

loadData();
