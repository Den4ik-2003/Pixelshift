"use strict";
const $ = (s) => document.querySelector(s),
  clamp = (v, a = 0, b = 255) => (v < a ? a : v > b ? b : v);
const mk = (w, h) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, w | 0);
  c.height = Math.max(1, h | 0);
  return c;
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
const data = (c) =>
  c
    .getContext("2d", { willReadFrequently: true })
    .getImageData(0, 0, c.width, c.height);
function rngf(s) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rs(c, w, h) {
  const n = mk(w, h),
    x = n.getContext("2d");
  x.imageSmoothingQuality = "high";
  x.drawImage(c, 0, 0, n.width, n.height);
  return n;
}
function shrink(a, w, h) {
  let c = a;
  while (c.width > w * 2 && c.height > h * 2)
    c = rs(c, c.width >> 1, c.height >> 1);
  return rs(c, w, h);
}
function blur(c, r) {
  if (r <= 0) return c;
  const f = 1 + r;
  return rs(shrink(c, c.width / f, c.height / f), c.width, c.height);
}
function layer(w, h, fn) {
  const c = mk(w, h),
    x = c.getContext("2d"),
    id = x.createImageData(w, h);
  fn(id.data);
  x.putImageData(id, 0, 0);
  return c;
}
const lvl = (n) => Math.max(2, Math.round(Math.cbrt(n)));
const quant = (d, n) => {
  for (let i = 0; i < d.length; i += 4)
    for (let j = 0; j < 3; j++)
      d[i + j] = (Math.round((d[i + j] / 255) * (n - 1)) / (n - 1)) * 255;
};
function sobel(a) {
  const w = a.width,
    h = a.height,
    d = data(a).data,
    g = new Float32Array(w * h),
    m = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = lum(d, i * 4);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x,
        gx =
          -g[i - w - 1] -
          2 * g[i - 1] -
          g[i + w - 1] +
          g[i - w + 1] +
          2 * g[i + 1] +
          g[i + w + 1],
        gy =
          -g[i - w - 1] -
          2 * g[i - w] -
          g[i - w + 1] +
          g[i + w - 1] +
          2 * g[i + w] +
          g[i + w + 1];
      m[i] = Math.hypot(gx, gy);
    }
  return m;
}

/* ---------- effects: fn(adjustedCanvas, params, outCtx, scale, rng) ---------- */
function pixel(a, p, o, S) {
  const z = Math.max(1, p.size * S),
    sm = shrink(a, Math.ceil(a.width / z), Math.ceil(a.height / z)),
    x = sm.getContext("2d"),
    id = x.getImageData(0, 0, sm.width, sm.height);
  quant(id.data, lvl(p.colors));
  x.putImageData(id, 0, 0);
  o.imageSmoothingEnabled = false;
  o.drawImage(sm, 0, 0, sm.width * z, sm.height * z);
}
const PAL = {
  "Game Boy": ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
  CGA: ["#000000", "#55ffff", "#ff55ff", "#ffffff"],
  NES: [
    "#000000",
    "#fcfcfc",
    "#bcbcbc",
    "#7c7c7c",
    "#a80020",
    "#e45c10",
    "#f8b800",
    "#00a800",
    "#0058f8",
    "#6844fc",
    "#d800cc",
    "#3cbcfc",
  ],
  "PICO-8": [
    "#000000",
    "#1d2b53",
    "#7e2553",
    "#008751",
    "#ab5236",
    "#5f574f",
    "#c2c3c7",
    "#fff1e8",
    "#ff004d",
    "#ffa300",
    "#ffec27",
    "#00e436",
    "#29adff",
    "#83769c",
    "#ff77a8",
    "#ffccaa",
  ],
};
function retro(a, p, o, S) {
  const z = Math.max(1, p.size * S),
    sm = shrink(a, Math.ceil(a.width / z), Math.ceil(a.height / z)),
    x = sm.getContext("2d"),
    id = x.getImageData(0, 0, sm.width, sm.height),
    d = id.data,
    P = PAL[p.palette].map(hex),
    k = 1 + p.contrast / 50;
  for (let i = 0; i < d.length; i += 4) {
    let c;
    if (p.palette == "Game Boy")
      c = P[Math.min(3, (clamp((lum(d, i) - 128) * k + 128) / 64) | 0)];
    else {
      let b = 1e9;
      const r = clamp((d[i] - 128) * k + 128),
        g = clamp((d[i + 1] - 128) * k + 128),
        bl = clamp((d[i + 2] - 128) * k + 128);
      for (const q of P) {
        const e = (r - q[0]) ** 2 + (g - q[1]) ** 2 + (bl - q[2]) ** 2;
        if (e < b) {
          b = e;
          c = q;
        }
      }
    }
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
  }
  x.putImageData(id, 0, 0);
  o.imageSmoothingEnabled = false;
  o.drawImage(sm, 0, 0, sm.width * z, sm.height * z);
}
function mosaic(a, p, o, S) {
  const z = p.size * S,
    g = p.gap * S,
    w = a.width,
    h = a.height,
    cw = Math.ceil(w / z),
    ch = Math.ceil(h / z),
    d = data(shrink(a, cw, ch)).data;
  o.fillStyle = "#0a0a0d";
  o.fillRect(0, 0, w, h);
  for (let j = 0; j < ch; j++)
    for (let i = 0; i < cw; i++) {
      const k = (j * cw + i) * 4;
      o.fillStyle = `rgb(${d[k]},${d[k + 1]},${d[k + 2]})`;
      const x = i * z + (p.shape == "Brick" && j % 2 ? -z / 2 : 0),
        y = j * z;
      if (p.shape == "Circle") {
        o.beginPath();
        o.arc(x + z / 2, y + z / 2, Math.max(0.5, z / 2 - g / 2), 0, 7);
        o.fill();
      } else if (p.shape == "Brick")
        o.fillRect(x + g / 2, y + g / 2, z * 1.5 - g, z - g);
      else o.fillRect(x + g / 2, y + g / 2, z - g, z - g);
    }
}
const SETS = {
  Classic: " .:-=+*#%@",
  Blocks: " ░▒▓█",
  Binary: " 01",
  Minimal: " .oO@",
};
function ascii(a, p, o, S) {
  const w = a.width,
    h = a.height,
    cw = p.size * S * 0.6,
    chh = p.size * S,
    cols = Math.ceil(w / cw),
    rows = Math.ceil(h / chh),
    d = data(shrink(a, cols, rows)).data,
    s = SETS[p.set],
    light = p.paper == "Light",
    ink = hex(p.color);
  o.fillStyle = light ? "#f4f2ec" : "#050507";
  o.fillRect(0, 0, w, h);
  o.font = `${chh}px monospace`;
  o.textBaseline = "top";
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const k = (j * cols + i) * 4,
        l = lum(d, k) / 255,
        ch = s[Math.round((light ? 1 - l : l) * (s.length - 1))];
      if (ch == " ") continue;
      o.fillStyle =
        p.mode == "Color"
          ? `rgb(${d[k]},${d[k + 1]},${d[k + 2]})`
          : light
            ? "#111"
            : `rgb(${ink})`;
      o.fillText(ch, i * cw, j * chh);
    }
}
function halftone(a, p, o, S) {
  const w = a.width,
    h = a.height,
    f = p.freq * S,
    d = data(blur(a, f)).data,
    an = (p.angle * Math.PI) / 180,
    c = Math.cos(an),
    s = Math.sin(an),
    col = p.mode == "Color",
    R = Math.hypot(w, h) / 2;
  o.fillStyle = col ? "#0b0b0e" : "#f5f3ee";
  o.fillRect(0, 0, w, h);
  for (let u = -R; u < R; u += f)
    for (let v = -R; v < R; v += f) {
      const x = w / 2 + u * c - v * s,
        y = h / 2 + u * s + v * c;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const k = ((y | 0) * w + (x | 0)) * 4,
        l = lum(d, k) / 255,
        r = f * 0.75 * Math.sqrt(col ? l : 1 - l);
      if (r < 0.4) continue;
      o.fillStyle = col ? `rgb(${d[k]},${d[k + 1]},${d[k + 2]})` : "#111";
      o.beginPath();
      o.arc(x, y, r, 0, 7);
      o.fill();
    }
}
function glitch(a, p, o, S, R) {
  const w = a.width,
    h = a.height,
    sh = Math.round(p.shift * S),
    s = data(a).data,
    out = new ImageData(w, h),
    t = out.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      t[i] = s[(y * w + clamp(x + sh, 0, w - 1)) * 4];
      t[i + 1] = s[i + 1];
      t[i + 2] = s[(y * w + clamp(x - sh, 0, w - 1)) * 4 + 2];
      t[i + 3] = 255;
    }
  o.putImageData(out, 0, 0);
  for (let n = 0; n < p.count; n++) {
    const y = R() * h,
      hh = (R() * 0.06 * h * p.strength) / 50 + 2 * S,
      dx = ((R() - 0.5) * w * 0.3 * p.strength) / 100;
    o.drawImage(o.canvas, 0, y, w, hh, dx, y, w, hh);
  }
}
function neon(a, p, o, S) {
  const w = a.width,
    h = a.height,
    m = sobel(a),
    c = hex(p.color),
    e = layer(w, h, (t) => {
      for (let i = 0; i < w * h; i++) {
        const v = Math.min(1, ((m[i] / 255) * p.edge) / 20),
          j = i * 4;
        t[j] = c[0] * v;
        t[j + 1] = c[1] * v;
        t[j + 2] = c[2] * v;
        t[j + 3] = 255;
      }
    });
  o.fillStyle = "#040407";
  o.fillRect(0, 0, w, h);
  o.globalCompositeOperation = "lighter";
  o.globalAlpha = Math.min(1, p.glow / 100);
  o.drawImage(blur(e, p.radius * S), 0, 0);
  o.drawImage(blur(e, (p.radius * S) / 3), 0, 0);
  o.globalAlpha = 1;
  o.drawImage(e, 0, 0);
  o.globalCompositeOperation = "source-over";
}
function duotone(a, p, o) {
  const w = a.width,
    h = a.height,
    d = data(a).data,
    A = hex(p.c1),
    B = hex(p.c2);
  o.putImageData(
    new ImageData(
      layer(w, h, (t) => {
        for (let i = 0; i < t.length; i += 4) {
          const l = lum(d, i) / 255;
          for (let j = 0; j < 3; j++) t[i + j] = A[j] + (B[j] - A[j]) * l;
          t[i + 3] = 255;
        }
      })
        .getContext("2d")
        .getImageData(0, 0, w, h).data,
      w,
      h,
    ),
    0,
    0,
  );
}
function sketch(a, p, o, S) {
  const w = a.width,
    h = a.height,
    d = data(a).data,
    gi = layer(w, h, (t) => {
      for (let i = 0; i < t.length; i += 4) {
        t[i] = t[i + 1] = t[i + 2] = 255 - lum(d, i);
        t[i + 3] = 255;
      }
    }),
    b = data(blur(gi, p.detail * S)).data,
    id = o.createImageData(w, h),
    t = id.data;
  for (let i = 0; i < t.length; i += 4) {
    const v =
      255 * Math.pow(Math.min(1, lum(d, i) / Math.max(1, 255 - b[i])), p.dark);
    t[i] = v;
    t[i + 1] = v * 0.99;
    t[i + 2] = v * 0.95;
    t[i + 3] = 255;
  }
  o.putImageData(id, 0, 0);
}
const TS = [
  [0, 20, 0, 60],
  [0.25, 40, 40, 210],
  [0.5, 225, 30, 40],
  [0.75, 255, 150, 0],
  [1, 255, 240, 80],
];
function thermal(a, p, o, S) {
  a = blur(a, p.smooth * S);
  const w = a.width,
    h = a.height,
    d = data(a).data,
    L = new Uint8Array(768);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < 3 && t > TS[k + 1][0]) k++;
    const A = TS[k],
      B = TS[k + 1],
      f = (t - A[0]) / (B[0] - A[0]);
    for (let j = 0; j < 3; j++)
      L[i * 3 + j] = A[j + 1] + (B[j + 1] - A[j + 1]) * f;
  }
  o.putImageData(
    new ImageData(
      layer(w, h, (t) => {
        for (let i = 0; i < t.length; i += 4) {
          let v = lum(d, i) | 0;
          if (p.invert == "On") v = 255 - v;
          t[i] = L[v * 3];
          t[i + 1] = L[v * 3 + 1];
          t[i + 2] = L[v * 3 + 2];
          t[i + 3] = 255;
        }
      })
        .getContext("2d")
        .getImageData(0, 0, w, h).data,
      w,
      h,
    ),
    0,
    0,
  );
}
function lowpoly(a, p, o, S, R) {
  const w = a.width,
    h = a.height,
    z = Math.max(6, p.size * S),
    cw = Math.ceil(w / z),
    ch = Math.ceil(h / z),
    d = data(blur(a, z / 4)).data,
    V = [];
  for (let j = 0; j <= ch; j++)
    for (let i = 0; i <= cw; i++) {
      let x = Math.min(w, i * z),
        y = Math.min(h, j * z);
      if (i > 0 && i < cw) x += ((R() - 0.5) * z * p.jitter) / 100;
      if (j > 0 && j < ch) y += ((R() - 0.5) * z * p.jitter) / 100;
      V.push([x, y]);
    }
  const v = (i, j) => V[j * (cw + 1) + i],
    tri = (A, B, C) => {
      const cx = clamp(((A[0] + B[0] + C[0]) / 3) | 0, 0, w - 1),
        cy = clamp(((A[1] + B[1] + C[1]) / 3) | 0, 0, h - 1),
        k = (cy * w + cx) * 4,
        c = `rgb(${d[k]},${d[k + 1]},${d[k + 2]})`;
      o.fillStyle = o.strokeStyle = c;
      o.lineWidth = 1;
      o.beginPath();
      o.moveTo(...A);
      o.lineTo(...B);
      o.lineTo(...C);
      o.closePath();
      o.fill();
      o.stroke();
    };
  for (let j = 0; j < ch; j++)
    for (let i = 0; i < cw; i++) {
      const A = v(i, j),
        B = v(i + 1, j),
        C = v(i, j + 1),
        D = v(i + 1, j + 1);
      if ((i + j) % 2) {
        tri(A, B, D);
        tri(A, D, C);
      } else {
        tri(A, B, C);
        tri(B, D, C);
      }
    }
}
function vintage(a, p, o, S, R) {
  const w = a.width,
    h = a.height;
  o.drawImage(a, 0, 0);
  const id = o.getImageData(0, 0, w, h),
    d = id.data,
    wm = p.warm / 100,
    gr = p.grain * 1.4;
  for (let i = 0; i < d.length; i += 4) {
    const l = lum(d, i),
      n = (R() - 0.5) * gr;
    d[i] = clamp((l + (d[i] - l) * 0.7) * 0.9 + 22 + 30 * wm + n);
    d[i + 1] = clamp((l + (d[i + 1] - l) * 0.7) * 0.9 + 20 + 10 * wm + n);
    d[i + 2] = clamp((l + (d[i + 2] - l) * 0.7) * 0.9 + 18 - 25 * wm + n);
  }
  o.putImageData(id, 0, 0);
  const g = o.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.3,
    w / 2,
    h / 2,
    Math.hypot(w, h) / 2,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${(p.vig / 100) * 0.85})`);
  o.fillStyle = g;
  o.fillRect(0, 0, w, h);
}
function blueprint(a, p, o, S) {
  const w = a.width,
    h = a.height,
    m = sobel(a),
    g = 40 * S;
  o.fillStyle = "#0a3a8c";
  o.fillRect(0, 0, w, h);
  o.strokeStyle = "rgba(255,255,255,.13)";
  o.lineWidth = 1;
  o.beginPath();
  for (let x = 0; x < w; x += g) {
    o.moveTo(x, 0);
    o.lineTo(x, h);
  }
  for (let y = 0; y < h; y += g) {
    o.moveTo(0, y);
    o.lineTo(w, y);
  }
  o.stroke();
  o.drawImage(
    layer(w, h, (t) => {
      for (let i = 0; i < w * h; i++) {
        const j = i * 4;
        t[j] = 232;
        t[j + 1] = 242;
        t[j + 2] = 255;
        t[j + 3] = Math.min(1, ((m[i] / 255) * p.lines) / 12) * 255;
      }
    }),
    0,
    0,
  );
}
function emboss(a, p, o, S) {
  const w = a.width,
    h = a.height,
    d = data(a).data,
    g = new Float32Array(w * h),
    an = (p.angle * Math.PI) / 180,
    dp = Math.max(1, Math.round(p.depth * S)),
    ox = Math.round(Math.cos(an) * dp),
    oy = Math.round(Math.sin(an) * dp);
  for (let i = 0; i < w * h; i++) g[i] = lum(d, i * 4);
  o.putImageData(
    new ImageData(
      layer(w, h, (t) => {
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4,
              v =
                128 +
                (g[clamp(y + oy, 0, h - 1) * w + clamp(x + ox, 0, w - 1)] -
                  g[clamp(y - oy, 0, h - 1) * w + clamp(x - ox, 0, w - 1)]) *
                  p.strength *
                  0.5;
            t[i] = v * 0.95;
            t[i + 1] = v * 0.98;
            t[i + 2] = v * 1.07;
            t[i + 3] = 255;
          }
      })
        .getContext("2d")
        .getImageData(0, 0, w, h).data,
      w,
      h,
    ),
    0,
    0,
  );
}
function poster(a, p, o, S) {
  const w = a.width,
    h = a.height,
    id = data(a);
  quant(id.data, p.levels);
  o.putImageData(id, 0, 0);
  if (p.ink == "On") {
    const m = sobel(a);
    o.drawImage(
      layer(w, h, (t) => {
        for (let i = 0; i < w * h; i++) t[i * 4 + 3] = m[i] > 120 ? 255 : 0;
      }),
      0,
      0,
    );
  }
}

/* ---------- style registry ---------- */
const r = (k, l, min, max, d, step = 1) => ({
    k,
    l,
    t: "range",
    min,
    max,
    d,
    step,
  }),
  sl = (k, l, o, d) => ({ k, l, t: "sel", o, d: d || o[0] }),
  co = (k, l, d) => ({ k, l, t: "col", d });
const STYLES = [
  {
    id: "pixel-art",
    name: "Pixel Art",
    desc: "Чіткі квадратні пікселі та квантування кольорів",
    fn: pixel,
    params: [
      r("size", "Розмір пікселя", 2, 40, 10),
      r("colors", "Кількість кольорів", 4, 256, 32),
    ],
  },
  {
    id: "8-bit-retro",
    name: "8-Bit Retro",
    desc: "Палітри старих консолей, великі пікселі",
    fn: retro,
    params: [
      sl("palette", "Палітра", Object.keys(PAL), "PICO-8"),
      r("size", "Розмір пікселя", 3, 40, 12),
      r("contrast", "Контраст", 0, 100, 30),
    ],
  },
  {
    id: "mosaic",
    name: "Mosaic",
    desc: "Мозаїка з кольорових плиток",
    fn: mosaic,
    params: [
      r("size", "Розмір плитки", 6, 60, 20),
      r("gap", "Відстань", 0, 10, 2),
      sl("shape", "Форма", ["Square", "Circle", "Brick"]),
    ],
  },
  {
    id: "ascii-art",
    name: "ASCII Art",
    desc: "Зображення з текстових символів",
    fn: ascii,
    params: [
      r("size", "Розмір символу", 6, 24, 10),
      sl("set", "Набір символів", Object.keys(SETS)),
      sl("mode", "Режим", ["Mono", "Color"]),
      sl("paper", "Фон", ["Dark", "Light"]),
      co("color", "Колір (Mono)", "#b6ff3b"),
    ],
  },
  {
    id: "halftone",
    name: "Halftone",
    desc: "Друкований растр з крапок",
    fn: halftone,
    params: [
      r("freq", "Частота (крок)", 4, 30, 9),
      r("angle", "Кут", 0, 90, 45),
      sl("mode", "Режим", ["Mono", "Color"]),
    ],
  },
  {
    id: "glitch",
    name: "Glitch",
    desc: "Зсуви смуг і RGB-розділення",
    fn: glitch,
    params: [
      r("strength", "Сила", 0, 100, 50),
      r("count", "Кількість артефактів", 0, 80, 24),
      r("shift", "RGB-зсув", 0, 40, 8),
    ],
  },
  {
    id: "neon-glow",
    name: "Neon Glow",
    desc: "Неонові контури зі світінням",
    fn: neon,
    params: [
      co("color", "Колір неону", "#b6ff3b"),
      r("edge", "Чутливість контурів", 5, 60, 20),
      r("glow", "Світіння", 0, 100, 80),
      r("radius", "Радіус світіння", 1, 30, 10),
    ],
  },
  {
    id: "duotone",
    name: "Duotone",
    desc: "Двоколірна композиція",
    fn: duotone,
    params: [co("c1", "Тіні", "#12002e"), co("c2", "Світла", "#ff4fd8")],
  },
  {
    id: "sketch",
    name: "Sketch",
    desc: "Олівцевий ескіз: інверсія, розмиття, color dodge",
    fn: sketch,
    params: [
      r("detail", "Розмиття ліній", 1, 30, 8),
      r("dark", "Темрява штриха", 0.5, 4, 1.4, 0.1),
    ],
  },
  {
    id: "thermal-vision",
    name: "Thermal Vision",
    desc: "Тепловізор: від фіолетового до жовтого",
    fn: thermal,
    params: [
      r("smooth", "Згладжування", 0, 20, 4),
      sl("invert", "Інверсія", ["Off", "On"]),
    ],
  },
  {
    id: "low-poly",
    name: "Low Poly",
    desc: "Геометрична сітка трикутників",
    fn: lowpoly,
    params: [
      r("size", "Розмір полігонів", 10, 120, 40),
      r("jitter", "Хаотичність", 0, 100, 60),
    ],
  },
  {
    id: "vintage-film",
    name: "Vintage Film",
    desc: "Зерно, віньєтка, теплий відтінок",
    fn: vintage,
    params: [
      r("grain", "Зернистість", 0, 100, 40),
      r("vig", "Віньєтка", 0, 100, 50),
      r("warm", "Теплота", 0, 100, 60),
    ],
  },
  {
    id: "blueprint",
    name: "Blueprint",
    desc: "Креслення на синьому фоні",
    fn: blueprint,
    params: [r("lines", "Контрастність ліній", 2, 40, 10)],
  },
  {
    id: "emboss",
    name: "Emboss",
    desc: "Рельєф на металевій поверхні",
    fn: emboss,
    params: [
      r("angle", "Кут світла", 0, 360, 135),
      r("depth", "Глибина", 1, 6, 2),
      r("strength", "Сила", 1, 10, 4, 0.5),
    ],
  },
  {
    id: "posterize",
    name: "Posterize",
    desc: "Чіткі кольорові площини",
    fn: poster,
    params: [
      r("levels", "Тональні рівні", 2, 8, 4),
      sl("ink", "Контур", ["Off", "On"]),
    ],
  },
];
const U = [
  r("intensity", "Інтенсивність ефекту", 0, 100, 100),
  r("brightness", "Яскравість", -100, 100, 0),
  r("contrast", "Контрастність", -100, 100, 0),
  r("saturation", "Насиченість", -100, 100, 0),
  r("gamma", "Гама", 0.3, 3, 1, 0.05),
  r("blur", "Розмиття", 0, 10, 0, 0.5),
  r("scale", "Масштаб обробки, %", 20, 100, 100, 5),
];
const PRE = [
  ["Retro Game", "8-bit-retro", { palette: "Game Boy", size: 8 }],
  ["Cyberpunk", "neon-glow", { color: "#ff2bd6", glow: 95 }],
  ["Green Neon", "neon-glow", { color: "#b6ff3b" }],
  ["Minimal Poster", "posterize", { levels: 3, saturation: -25, ink: "On" }],
  ["Dark Portrait", "sketch", { dark: 2.2, contrast: 20 }],
  ["Purple Dream", "duotone", { c1: "#1a0b3d", c2: "#d58bff" }],
];

/* ---------- state ---------- */
const S = {
  img: null,
  style: STYLES[0],
  params: {},
  fav: new Set(),
  recent: [],
  mode: "res",
  z: 1,
  px: 0,
  py: 0,
};
try {
  S.fav = new Set(JSON.parse(localStorage.getItem("ps-fav") || "[]"));
} catch {}
const defs = (st) => {
  const p = { seed: 1 };
  [...st.params, ...U].forEach((s) => (p[s.k] = s.d));
  return p;
};
const PP = () => S.params[S.style.id] || (S.params[S.style.id] = defs(S.style));
let toastT;
function toast(m) {
  const t = $("#toast");
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 3200);
}

/* ---------- pipeline ---------- */
function adjust(c, p) {
  c = blur(c, (p.blur * c.width) / 800);
  const w = c.width,
    h = c.height,
    id = data(c),
    d = id.data,
    ct = p.contrast * 2.55,
    f = (259 * (ct + 255)) / (255 * (259 - ct)),
    L = new Uint8Array(256),
    sa = 1 + p.saturation / 100;
  for (let i = 0; i < 256; i++)
    L[i] = clamp(
      255 *
        Math.pow(
          clamp(f * (i - 128) + 128 + p.brightness * 2.55) / 255,
          1 / p.gamma,
        ),
    );
  for (let i = 0; i < d.length; i += 4) {
    const l = lum(d, i);
    d[i] = L[clamp(l + (d[i] - l) * sa) | 0];
    d[i + 1] = L[clamp(l + (d[i + 1] - l) * sa) | 0];
    d[i + 2] = L[clamp(l + (d[i + 2] - l) * sa) | 0];
  }
  const o = mk(w, h);
  o.getContext("2d").putImageData(id, 0, 0);
  return o;
}
function build(long, useScale) {
  const p = PP(),
    im = S.img,
    k = (long / Math.max(im.width, im.height)) * (useScale ? p.scale / 100 : 1),
    w = Math.max(8, Math.round(im.width * k)),
    h = Math.max(8, Math.round(im.height * k)),
    a = adjust(rs(im, w, h), p),
    r = mk(w, h);
  S.style.fn(a, p, r.getContext("2d"), w / 800, rngf(p.seed | 0));
  const f = mk(w, h),
    x = f.getContext("2d");
  x.drawImage(a, 0, 0);
  x.globalAlpha = p.intensity / 100;
  x.drawImage(r, 0, 0);
  return f;
}
let raf = 0;
const spin = (on) => ($("#spin").hidden = !on);
function render() {
  if (!S.img) return;
  spin(true);
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() =>
    setTimeout(() => {
      try {
        const r = build(1280, true),
          cR = $("#cR"),
          cO = $("#cO");
        cR.width = cO.width = r.width;
        cR.height = cO.height = r.height;
        cR.getContext("2d").drawImage(r, 0, 0);
        cO.getContext("2d").drawImage(rs(S.img, r.width, r.height), 0, 0);
        cR.style.animation = "none";
        void cR.offsetWidth;
        cR.style.animation = "";
        fit();
      } catch (e) {
        toast("Помилка обробки: " + (e.message || "недостатньо пам’яті"));
      }
      spin(false);
    }, 0),
  );
}
const deb = (f, t) => {
    let h;
    return () => {
      clearTimeout(h);
      h = setTimeout(f, t);
    };
  },
  renderD = deb(render, 70);

/* ---------- view: fit / zoom / pan / compare ---------- */
function fit() {
  const st = $("#stage"),
    c = $("#cR");
  if (!c.width) return;
  const b = st.getBoundingClientRect(),
    ar = c.width / c.height,
    w = Math.min(b.width * 0.96, b.height * 0.96 * ar);
  const i = $("#inner");
  i.style.width = w + "px";
  i.style.height = w / ar + "px";
  tf();
}
const tf = () => {
  $("#inner").style.transform =
    `translate(-50%,-50%) translate(${S.px}px,${S.py}px) scale(${S.z})`;
};
function zoom(z) {
  S.z = clamp(z, 1, 8);
  if (S.z == 1) S.px = S.py = 0;
  tf();
}
function slider(box, h) {
  const set = (e) => {
    const b = box.getBoundingClientRect(),
      v = clamp(((e.clientX - b.left) / b.width) * 100, 0, 100);
    box.style.setProperty("--x", v + "%");
    h.setAttribute("aria-valuenow", Math.round(v));
  };
  h.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    h.setPointerCapture(e.pointerId);
    set(e);
    h.onpointermove = set;
  });
  h.addEventListener("pointerup", () => (h.onpointermove = null));
  h.addEventListener("keydown", (e) => {
    const v =
      parseFloat(box.style.getPropertyValue("--x")) +
      (e.key == "ArrowRight" ? 5 : e.key == "ArrowLeft" ? -5 : 0);
    box.style.setProperty("--x", clamp(v, 0, 100) + "%");
    h.setAttribute("aria-valuenow", Math.round(clamp(v, 0, 100)));
  });
}
function setMode(m) {
  S.mode = m;
  $("#stage").dataset.mode = m;
  document
    .querySelectorAll(".seg [data-m]")
    .forEach((b) => b.classList.toggle("on", b.dataset.m == m));
}

/* ---------- UI: gallery / panel ---------- */
function grid() {
  const g = $("#grid");
  g.replaceChildren();
  [...STYLES]
    .sort((a, b) => S.fav.has(b.id) - S.fav.has(a.id))
    .forEach((s) => {
      const d = document.createElement("div");
      d.className = "card" + (s === S.style ? " on" : "");
      d.style.setProperty("--h", STYLES.indexOf(s) * 24);
      const b = document.createElement("button"),
        n = document.createElement("b"),
        t = document.createElement("small"),
        f = document.createElement("button");
      b.className = "pick";
      b.type = "button";
      n.textContent = s.name;
      t.textContent = s.desc;
      b.append(n, t);
      b.onclick = () => setStyle(s);
      f.className = "star";
      f.type = "button";
      f.textContent = S.fav.has(s.id) ? "★" : "☆";
      f.setAttribute("aria-label", "Улюблений стиль: " + s.name);
      f.onclick = () => {
        S.fav.has(s.id) ? S.fav.delete(s.id) : S.fav.add(s.id);
        try {
          localStorage.setItem("ps-fav", JSON.stringify([...S.fav]));
        } catch {}
        grid();
      };
      d.append(b, f);
      g.append(d);
    });
}
function chips(box, items) {
  box.replaceChildren();
  items.forEach(([t, fn]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t;
    b.onclick = fn;
    box.append(b);
  });
}
function panel() {
  const p = PP(),
    box = $("#ctl");
  box.replaceChildren();
  $("#pt").textContent = S.style.name;
  [...S.style.params, ...U].forEach((s) => {
    const l = document.createElement("label"),
      sp = document.createElement("span"),
      v = document.createElement("output");
    sp.textContent = s.l;
    let i;
    if (s.t == "sel") {
      i = document.createElement("select");
      s.o.forEach((x) => i.add(new Option(x, x)));
    } else {
      i = document.createElement("input");
      i.type = s.t == "col" ? "color" : "range";
      if (s.t == "range") {
        i.min = s.min;
        i.max = s.max;
        i.step = s.step;
      }
    }
    i.value = p[s.k];
    i.setAttribute("aria-label", s.l);
    v.textContent = s.t == "range" ? p[s.k] : "";
    i.oninput = () => {
      p[s.k] = s.t == "range" ? +i.value : i.value;
      if (s.t == "range") {
        v.textContent = i.value;
        renderD();
      } else render();
    };
    l.append(sp, v, i);
    box.append(l);
  });
}
function setStyle(s) {
  S.style = s;
  S.recent = [s, ...S.recent.filter((x) => x !== s)].slice(0, 4);
  grid();
  panel();
  chips(
    $("#recent"),
    S.recent.slice(1).map((x) => ["↺ " + x.name, () => setStyle(x)]),
  );
  render();
  if (!S.img)
    toast("Спочатку завантажте фото — стиль «" + s.name + "» вибрано.");
}
function randomize() {
  const p = PP();
  [...S.style.params, ...U].forEach((s) => {
    if (s.k == "scale" || s.k == "intensity" || s.k == "blur") return;
    if (s.t == "range") {
      const lim = U.includes(s) ? 0.3 : 1,
        mid = (s.min + s.max) / 2,
        sp = ((s.max - s.min) * lim) / 2,
        v = U.includes(s)
          ? mid + (Math.random() - 0.5) * 2 * sp
          : s.min + Math.random() * (s.max - s.min);
      p[s.k] = Math.round(v / s.step) * s.step;
    } else if (s.t == "sel") p[s.k] = s.o[(Math.random() * s.o.length) | 0];
    else {
      const h = (Math.random() * 360) | 0;
      const c = document.createElement("canvas").getContext("2d");
      c.fillStyle = `hsl(${h} 90% 55%)`;
      p[s.k] = c.fillStyle;
    }
  });
  p.seed = (Math.random() * 1e6) | 0;
  panel();
  render();
}
function resetP() {
  S.params[S.style.id] = defs(S.style);
  panel();
  render();
}

/* ---------- files ---------- */
const OK = ["image/jpeg", "image/png", "image/webp"],
  MAX = 25 * 1024 * 1024;
async function load(f) {
  if (!f) return;
  if (!OK.includes(f.type))
    return toast("Формат не підтримується. Використайте JPEG, PNG або WebP.");
  if (f.size > MAX) return toast("Файл завеликий: максимум 25 МБ.");
  let bmp, url;
  try {
    try {
      bmp = await createImageBitmap(f, { imageOrientation: "from-image" });
    } catch {
      url = URL.createObjectURL(f);
      bmp = await new Promise((ok, no) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = no;
        i.src = url;
      });
    }
    const W = bmp.width || bmp.naturalWidth,
      H = bmp.height || bmp.naturalHeight,
      k = Math.min(1, 4096 / Math.max(W, H)),
      c = mk(W * k, H * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close && bmp.close();
    if (S.img) S.img.width = 0;
    S.img = c;
    S.recent = [S.style];
    S.z = 1;
    S.px = S.py = 0;
    $("#drop").hidden = true;
    $("#work").hidden = false;
    chips($("#recent"), []);
    render();
    $("#editor").scrollIntoView();
  } catch {
    toast("Не вдалося прочитати зображення. Файл може бути пошкоджений.");
  } finally {
    url && URL.revokeObjectURL(url);
    $("#file").value = "";
  }
}
function removeImg() {
  if (S.img) S.img.width = 0;
  S.img = null;
  ["#cR", "#cO"].forEach((s) => {
    $(s).width = 1;
    $(s).height = 1;
  });
  $("#work").hidden = true;
  $("#drop").hidden = false;
  $("#file").value = "";
}
const pick = () => $("#file").click();
function download() {
  if (!S.img) return toast("Спочатку завантажте фото.");
  const long =
      $("#size").value == "max"
        ? Math.max(S.img.width, S.img.height)
        : +$("#size").value,
    fmt = $("#fmt").value;
  spin(true);
  setTimeout(() => {
    try {
      build(long, false).toBlob(
        (b) => {
          spin(false);
          if (!b)
            return toast("Не вдалося створити файл. Спробуйте менший розмір.");
          const u = URL.createObjectURL(b),
            a = document.createElement("a");
          a.href = u;
          a.download = `pixelshift-${S.style.id}.${fmt == "jpeg" ? "jpg" : "png"}`;
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(u), 4000);
        },
        "image/" + fmt,
        $("#qual").value / 100,
      );
    } catch (e) {
      spin(false);
      toast("Помилка експорту: недостатньо пам’яті. Оберіть менший розмір.");
    }
  }, 30);
}

function init() {
  // demo (procedural scene, clearly not user's photo)
  const A = mk(800, 500),
    x = A.getContext("2d"),
    g = x.createLinearGradient(0, 0, 0, 500);
  g.addColorStop(0, "#2b1a6b");
  g.addColorStop(0.6, "#ff6a88");
  g.addColorStop(1, "#ffd27a");
  x.fillStyle = g;
  x.fillRect(0, 0, 800, 500);
  x.fillStyle = "#fff3c4";
  x.beginPath();
  x.arc(560, 230, 90, 0, 7);
  x.fill();
  [
    ["#3b1d5a", 0.5, 300],
    ["#1c0f33", 0.7, 380],
  ].forEach(([c, _, y], k) => {
    x.fillStyle = c;
    x.beginPath();
    x.moveTo(0, 500);
    for (let i = 0; i <= 8; i++)
      x.lineTo(i * 100, y + Math.sin(i * 1.7 + k * 2) * 60);
    x.lineTo(800, 500);
    x.fill();
  });
  const B = mk(800, 500);
  pixel(A, { size: 10, colors: 20 }, B.getContext("2d"), 1);
  for (const [id, c] of [
    ["#dA", A],
    ["#dB", B],
  ]) {
    const e = $(id);
    e.width = 800;
    e.height = 500;
    e.getContext("2d").drawImage(c, 0, 0);
  }
  slider($("#demo"), $("#dH"));
  slider($("#inner"), $("#hd"));
  // editor events
  $("#heroUp").onclick = pick;
  $("#drop").onclick = pick;
  $("#change").onclick = pick;
  $("#remove").onclick = removeImg;
  $("#file").onchange = (e) => load(e.target.files[0]);
  $("#drop").onkeydown = (e) => {
    if (e.key == "Enter" || e.key == " ") {
      e.preventDefault();
      pick();
    }
  };
  const c = $("#center");
  ["dragenter", "dragover"].forEach((n) =>
    c.addEventListener(n, (e) => {
      e.preventDefault();
      $("#drop").classList.add("over");
    }),
  );
  c.addEventListener("dragleave", () => $("#drop").classList.remove("over"));
  c.addEventListener("drop", (e) => {
    e.preventDefault();
    $("#drop").classList.remove("over");
    load(e.dataTransfer.files[0]);
  });
  document
    .querySelectorAll(".seg [data-m]")
    .forEach((b) => (b.onclick = () => setMode(b.dataset.m)));
  $("#zi").onclick = () => zoom(S.z * 1.4);
  $("#zo").onclick = () => zoom(S.z / 1.4);
  $("#zf").onclick = () => zoom(1);
  const st = $("#stage");
  st.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoom(S.z * Math.exp(-e.deltaY * 0.0015));
    },
    { passive: false },
  );
  st.addEventListener("pointerdown", (e) => {
    if (S.z <= 1) return;
    st.setPointerCapture(e.pointerId);
    let lx = e.clientX,
      ly = e.clientY;
    st.onpointermove = (m) => {
      S.px += m.clientX - lx;
      S.py += m.clientY - ly;
      lx = m.clientX;
      ly = m.clientY;
      tf();
    };
  });
  st.addEventListener("pointerup", () => (st.onpointermove = null));
  addEventListener("resize", deb(fit, 100));
  $("#fmt").onchange = () => ($("#qual").disabled = $("#fmt").value == "png");
  $("#dl").onclick = download;
  $("#reset").onclick = resetP;
  $("#rand").onclick = randomize;
  $("#art").onclick = () => {
    S.style = STYLES[(Math.random() * STYLES.length) | 0];
    setStyle(S.style);
    randomize();
  };
  $("#roul").onclick = () => {
    if (!S.img) return toast("Спочатку завантажте фото.");
    let n = 0;
    const t = setInterval(() => {
      setStyle(STYLES[(Math.random() * STYLES.length) | 0]);
      if (++n > 8) {
        clearInterval(t);
        randomize();
      }
    }, 260);
  };
  chips(
    $("#pre"),
    PRE.map(([n, id, v]) => [
      n,
      () => {
        const s = STYLES.find((q) => q.id == id);
        S.params[id] = Object.assign(defs(s), v);
        setStyle(s);
      },
    ]),
  );
  // modal & shortcuts
  const M = $("#modal"),
    close = () => (M.hidden = true);
  $("#keys").onclick = () => {
    M.hidden = false;
    $("#mx").focus();
  };
  $("#mx").onclick = close;
  M.onclick = (e) => {
    if (e.target == M) close();
  };
  addEventListener("keydown", (e) => {
    const t = e.target.tagName,
      typing = /INPUT|TEXTAREA|SELECT/.test(t) && e.target.type != "range";
    if (e.key == "Escape") close();
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == "o") {
      e.preventDefault();
      pick();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == "s") {
      e.preventDefault();
      download();
    } else if (
      !typing &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      e.key.toLowerCase() == "r" &&
      S.img
    )
      resetP();
  });
  addEventListener("pagehide", () => {
    S.img && (S.img.width = 0);
  });
  grid();
  panel();
}
init();
