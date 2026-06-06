/* ============================================================
   Element hero particles
   A lightweight canvas engine. Each of the Five Elements gets a
   motion + palette that reflects its character:
     fire  — embers rising and flickering upward
     earth — dust motes drifting and settling downward
     metal — sharp glints twinkling in slow orbit
     water — bubbles rising with a fluid sine sway
     wood  — pollen/spores meandering gently aloft
   Respects prefers-reduced-motion and pauses when off-screen.
   ============================================================ */
(function () {
  const canvas = document.querySelector('canvas.hero-particles');
  if (!canvas || !canvas.getContext) return;
  const host = canvas.closest('.page-hero') || canvas.parentElement;
  const ctx = canvas.getContext('2d');
  const element = (canvas.dataset.element || 'fire').toLowerCase();
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];

  let W = 0, H = 0, dpr = 1;
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---- per-element behaviour ---- */
  const B = {
    fire: {
      composite: 'lighter', density: 0.00010, glow: true,
      init(p, fill) {
        p.x = rand(0, W);
        p.y = fill ? rand(0, H) : H + rand(0, 30);
        p.r = rand(0.8, 3);
        p.vy = -rand(0.018, 0.06);            // px / ms, upward
        p.sway = rand(8, 26);
        p.sp = rand(0.0008, 0.0024);
        p.ph = rand(0, Math.PI * 2);
        p.flick = rand(0.004, 0.012);
        p.maxA = rand(0.35, 0.9);
        p.color = pick(['#E8A24A', '#E0763A', '#B33A3A', '#C4A47C']);
      },
      step(p, dt, t) {
        p.y += p.vy * dt;
        p.x += Math.sin(t * p.sp + p.ph) * 0.02 * dt;
        const top = p.y / H;                  // 1 at bottom -> 0 at top
        const fade = Math.max(0, Math.min(1, top));      // fade as it climbs
        p.a = p.maxA * fade * (0.7 + 0.3 * Math.sin(t * p.flick + p.ph));
        return p.y > -20;
      }
    },
    earth: {
      composite: 'source-over', density: 0.00012, glow: false,
      init(p, fill) {
        p.x = rand(0, W);
        p.y = fill ? rand(0, H) : -rand(0, 30);
        p.r = rand(0.8, 2.6);
        p.vy = rand(0.006, 0.02);             // slow fall
        p.sway = rand(6, 16);
        p.sp = rand(0.0004, 0.0012);
        p.ph = rand(0, Math.PI * 2);
        p.maxA = rand(0.12, 0.4);
        p.color = pick(['#C4A47C', '#8B5A3C', '#A67C52', '#7C5A3A']);
      },
      step(p, dt, t) {
        p.y += p.vy * dt;
        p.x += Math.sin(t * p.sp + p.ph) * 0.008 * dt;
        const d = p.y / H;
        p.a = p.maxA * Math.min(1, d * 4) * (1 - Math.max(0, (d - 0.85) / 0.15));
        return p.y < H + 20;
      }
    },
    metal: {
      composite: 'lighter', density: 0.00009, glow: true,
      init(p, fill) {
        p.x = rand(0, W);
        p.y = rand(0, H);
        p.r = rand(0.6, 2.1);
        p.vx = rand(-0.004, 0.004);
        p.vy = rand(-0.004, 0.004);
        p.sp = rand(0.0012, 0.004);           // twinkle speed
        p.ph = rand(0, Math.PI * 2);
        p.maxA = rand(0.3, 0.95);
        p.cross = Math.random() < 0.25;       // some get a star flare
        p.color = pick(['#E8E0CC', '#B89968', '#D8C9A8', '#F0E8D2']);
      },
      step(p, dt, t) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
        const tw = 0.5 + 0.5 * Math.sin(t * p.sp + p.ph);
        p.a = p.maxA * tw * tw;               // sharp twinkle
        return true;
      },
      drawExtra(p) {
        if (!p.cross || p.a < 0.4) return;
        const l = p.r * 4 * p.a;
        ctx.globalAlpha = p.a * 0.6;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(p.x - l, p.y); ctx.lineTo(p.x + l, p.y);
        ctx.moveTo(p.x, p.y - l); ctx.lineTo(p.x, p.y + l);
        ctx.stroke();
      }
    },
    water: {
      composite: 'lighter', density: 0.00009, glow: true,
      init(p, fill) {
        p.x = rand(0, W);
        p.baseX = p.x;
        p.y = fill ? rand(0, H) : H + rand(0, 30);
        p.r = rand(1.2, 5);
        p.vy = -rand(0.012, 0.04);
        p.amp = rand(10, 40);
        p.sp = rand(0.0008, 0.002);
        p.ph = rand(0, Math.PI * 2);
        p.maxA = rand(0.18, 0.5);
        p.ring = Math.random() < 0.5;
        p.color = pick(['#A8C4C9', '#7FA0A6', '#5A6F73', '#BcdadF']);
      },
      step(p, dt, t) {
        p.y += p.vy * dt;
        p.x = p.baseX + Math.sin(t * p.sp + p.ph) * p.amp;
        const top = p.y / H;
        p.a = p.maxA * Math.max(0, Math.min(1, top)) * Math.min(1, (1 - top) * 3 + 0.2);
        return p.y > -30;
      },
      drawExtra(p) {
        if (!p.ring || p.a < 0.15) return;
        ctx.globalAlpha = p.a * 0.5;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 1.7, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    wood: {
      composite: 'source-over', density: 0.00011, glow: false,
      init(p, fill) {
        p.x = rand(0, W);
        p.y = fill ? rand(0, H) : H + rand(0, 40);
        p.r = rand(1, 3);
        p.vy = -rand(0.004, 0.016);
        p.sp = rand(0.0005, 0.0016);
        p.sp2 = rand(0.0003, 0.0011);
        p.amp = rand(10, 34);
        p.ph = rand(0, Math.PI * 2);
        p.ph2 = rand(0, Math.PI * 2);
        p.baseX = p.x;
        p.maxA = rand(0.18, 0.5);
        p.color = pick(['#A8BE94', '#8BA677', '#6B7F5C', '#C2D2AE']);
      },
      step(p, dt, t) {
        p.y += p.vy * dt;
        // meander: two summed sines for an organic drift
        p.x = p.baseX + Math.sin(t * p.sp + p.ph) * p.amp
                      + Math.sin(t * p.sp2 + p.ph2) * p.amp * 0.5;
        const top = p.y / H;
        p.a = p.maxA * Math.max(0, Math.min(1, top * 1.5)) * Math.min(1, (1 - top) * 2.5 + 0.15);
        return p.y > -30;
      }
    }
  };

  const cfg = B[element] || B.fire;
  let parts = [];

  function build() {
    const target = Math.max(18, Math.min(110, Math.round(W * H * cfg.density)));
    parts = [];
    for (let i = 0; i < target; i++) {
      const p = {};
      cfg.init(p, true);
      parts.push(p);
    }
  }

  function draw(p) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.a || 0));
    ctx.fillStyle = p.color;
    if (cfg.glow) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.r * 4;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    if (cfg.glow) ctx.shadowBlur = 0;
    if (cfg.drawExtra) cfg.drawExtra(p);
  }

  let last = 0, raf = 0, running = false;
  function frame(now) {
    if (!running) return;
    if (!last) last = now;
    let dt = now - last; last = now;
    if (dt > 60) dt = 60;                     // clamp after tab switch
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = cfg.composite;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!cfg.step(p, dt, now)) cfg.init(p, false);
      draw(p);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true; last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
  }

  function renderStatic() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = cfg.composite;
    for (const p of parts) { cfg.step(p, 0, 1200); draw(p); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function init() {
    resize();
    build();
    if (reduce) { renderStatic(); return; }
    start();
  }

  // Pause when the hero scrolls out of view
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { e.isIntersecting ? start() : stop(); });
    }, { threshold: 0 });
    io.observe(host);
  }

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { resize(); build(); if (reduce) renderStatic(); }, 200);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
