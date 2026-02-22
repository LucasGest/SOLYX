// Cursor
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

// Stars
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
    ctx.fillStyle = `rgba(200,200,255,${s.opacity})`;
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
    grad.addColorStop(0, `rgba(255,255,255,${ss.opacity})`);
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

// Scroll reveal
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
