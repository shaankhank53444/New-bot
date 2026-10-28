const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const BG_URL = "https://i.imgur.com/PZYjU9e.jpeg";
const FB_TOKEN = "6628568379|c1e620fa708a1d5696fb991c1bde5662";

// Bangla-capable font (auto-downloaded once, then cached)
const FONT_FILE = "HindSiliguri-Regular.ttf";
const FONT_URLS = [
  "https://github.com/google/fonts/raw/main/ofl/hindsiliguri/HindSiliguri-Regular.ttf",
  "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/hindsiliguri/HindSiliguri-Regular.ttf"
];
const FONT = '"HindSiliguri", "Noto Sans Bengali", "Noto Sans", Arial, sans-serif';

// Emoji are drawn as images (Twemoji) so every emoji works on any server
const EMOJI_CDNS = [
  c => `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${c}.png`,
  c => `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/${c}.png`
];

let fontReady = false;
let bgBuffer = null;
const emojiCache = new Map();

/* ---------------- helpers ---------------- */

async function getBuf(url, timeout = 10000) {
  const r = await axios.get(url, {
    responseType: "arraybuffer",
    timeout,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return Buffer.from(r.data);
}

async function ensureFont(registerFont, cacheDir) {
  if (fontReady) return;
  const file = path.join(cacheDir, FONT_FILE);
  try {
    if (!fs.existsSync(file) || fs.statSync(file).size < 50000) {
      for (const u of FONT_URLS) {
        try {
          await fs.writeFile(file, await getBuf(u, 20000));
          if (fs.statSync(file).size > 50000) break;
        } catch (e) {}
      }
    }
    if (fs.existsSync(file) && fs.statSync(file).size > 50000) {
      registerFont(file, { family: "HindSiliguri" });
      fontReady = true;
    }
  } catch (e) {
    console.warn("[fakechat] font load failed:", e.message);
  }
}

const EMOJI_RE = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)/u;

function graphemes(str) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(str)].map(s => s.segment);
  }
  return Array.from(str);
}

function toCode(g) {
  const s = g.indexOf("\u200D") < 0 ? g.replace(/\uFE0F/g, "") : g;
  return Array.from(s).map(c => c.codePointAt(0).toString(16)).join("-");
}

async function loadEmoji(loadImage, code) {
  if (emojiCache.has(code)) return emojiCache.get(code);
  let img = null;
  for (const mk of EMOJI_CDNS) {
    try {
      img = await loadImage(await getBuf(mk(code), 8000));
      break;
    } catch (e) {}
  }
  emojiCache.set(code, img);
  return img;
}

// text -> paragraphs -> words -> segments ({t:"text"} | {e:true,t:"😀"})
function buildParagraphs(text) {
  return text.replace(/\r/g, "").split("\n").map(line => {
    const words = [];
    for (const w of line.split(/ +/)) {
      if (!w) continue;
      const segs = [];
      let buf = "";
      for (const g of graphemes(w)) {
        if (EMOJI_RE.test(g)) {
          if (buf) { segs.push({ t: buf }); buf = ""; }
          segs.push({ e: true, t: g });
        } else buf += g;
      }
      if (buf) segs.push({ t: buf });
      words.push(segs);
    }
    return words;
  });
}

function wrapText(ctx, paragraphs, maxW, fs) {
  const emojiW = fs * 1.15;
  const segW = s => (s.e ? emojiW : ctx.measureText(s.t).width);
  const wordW = w => w.reduce((a, s) => a + segW(s), 0);
  const spaceW = ctx.measureText(" ").width;
  const lines = [];

  for (const words of paragraphs) {
    if (!words.length) { lines.push({ segs: [], w: 0 }); continue; }
    let cur = [], curW = 0;
    const flush = () => { lines.push({ segs: cur, w: curW }); cur = []; curW = 0; };

    for (const word of words) {
      const ww = wordW(word);
      if (ww > maxW) {
        // very long word: break by character
        if (cur.length) flush();
        let part = [], pw = 0;
        for (const seg of word) {
          const units = seg.e ? [seg] : graphemes(seg.t).map(g => ({ t: g }));
          for (const u of units) {
            const uw = segW(u);
            if (pw + uw > maxW && part.length) { lines.push({ segs: part, w: pw }); part = []; pw = 0; }
            part.push(u); pw += uw;
          }
        }
        cur = part; curW = pw;
        continue;
      }
      const add = cur.length ? spaceW + ww : ww;
      if (curW + add > maxW && cur.length) {
        flush();
        cur = [...word]; curW = ww;
      } else {
        if (cur.length) cur.push({ t: " " });
        cur.push(...word);
        curW += add;
      }
    }
    if (cur.length) flush();
  }
  return lines;
}

// merge neighbouring text segments so Bangla shaping stays correct
function mergeSegs(segs) {
  const out = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (!s.e && last && !last.e) last.t += s.t;
    else out.push({ ...s });
  }
  return out;
}

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawAvatar(ctx, img, cx, cy, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, cx - size / 2, cy - size / 2, size, size);
  } else {
    ctx.fillStyle = "#8d8a99";
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.12, size * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.5, size * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ---------------- command ---------------- */

module.exports = {
  config: {
    name: "fakechat",
    aliases: ["fc", "fchat", "facechat"],
    version: "2.0.0",
    author: "Mr.King",
    countDown: 5,
    role: 0,
    shortDescription: "Fake messenger chat card",
    longDescription: "Make a fake Messenger chat screenshot (Bangla + all emoji supported)",
    category: "image",
    guide: {
      en: "{pn} <text>\n{pn} <uid> <text>\nReply to someone: {pn} (uses their message) or {pn} <text>"
    }
  },

  onStart: async function ({ message, args, event, usersData, api }) {
    const send = body =>
      message ? message.reply(body) : api.sendMessage(body, event.threadID, null, event.messageID);

    let outFile = null;
    try {
      // canvas is required lazily so the command always loads, even if canvas is missing
      let canvasLib;
      try {
        canvasLib = require("canvas");
      } catch (e) {
        return send("❌ `canvas` module install nai. Server e run koro: npm i canvas");
      }
      const { createCanvas, loadImage, registerFont } = canvasLib;

      /* ---- who + what ---- */
      let uid = String(event.senderID);
      const raw = args.slice();

      if (raw[0] && /^\d{6,}$/.test(raw[0])) {
        uid = raw.shift();
      } else if (event.messageReply) {
        uid = String(event.messageReply.senderID);
      } else if (event.mentions && Object.keys(event.mentions).length) {
        uid = Object.keys(event.mentions)[0];
      }

      let text = raw.join(" ");
      if (event.mentions) {
        for (const nm of Object.values(event.mentions)) text = text.split(nm).join("");
      }
      text = text.trim();
      if (!text && event.messageReply) text = (event.messageReply.body || "").trim();
      if (!text) {
        return send("⚠️ Text dao ba kaaro message e reply koro!\nJemon: fc Kheli na\nfc <uid> Hello\nfc (reply)");
      }
      if (text.length > 600) text = text.slice(0, 600) + "…";

      /* ---- name ---- */
      let name = "Facebook User";
      try {
        if (usersData && typeof usersData.getName === "function") name = (await usersData.getName(uid)) || name;
      } catch (e) {}
      if (name.length > 26) name = name.slice(0, 25) + "…";

      /* ---- assets ---- */
      const cacheDir = path.join(__dirname, "cache");
      await fs.ensureDir(cacheDir);
      await ensureFont(registerFont, cacheDir);

      const paragraphs = buildParagraphs(text);
      const emojiCodes = new Set(["1f425"]); // duck icon (bottom-right)
      for (const p of paragraphs) for (const w of p) for (const s of w) if (s.e) emojiCodes.add(toCode(s.t));

      const [avatarImg, bgImg] = await Promise.all([
        (async () => {
          try {
            const url = `https://graph.facebook.com/${uid}/picture?width=512&height=512&access_token=${FB_TOKEN}`;
            return await loadImage(await getBuf(url, 8000));
          } catch (e) { return null; }
        })(),
        (async () => {
          try {
            if (!bgBuffer) bgBuffer = await getBuf(BG_URL, 12000);
            return await loadImage(bgBuffer);
          } catch (e) { return null; }
        })(),
        ...[...emojiCodes].map(c => loadEmoji(loadImage, c))
      ]);

      /* ---- layout ---- */
      const W = 720;
      const FS = 30;
      const LH = 44;
      const bubbleX = 84;
      const padX = 26;
      const padY = 18;
      const maxTextW = W - bubbleX - 64 - padX * 2;

      const measure = createCanvas(10, 10).getContext("2d");
      measure.font = `${FS}px ${FONT}`;
      let lines = wrapText(measure, paragraphs, maxTextW, FS);
      if (lines.length > 20) lines = lines.slice(0, 20);

      const textW = Math.max(...lines.map(l => l.w), 20);
      const bubbleW = Math.ceil(textW + padX * 2);
      const bubbleY = 120;
      const bubbleH = padY * 2 + 40 + (lines.length - 1) * LH;
      const bubbleBottom = bubbleY + bubbleH;
      const barY = bubbleBottom + 80;
      const H = Math.max(barY + 60 + 50, 470);

      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext("2d");

      /* ---- background ---- */
      ctx.save();
      rr(ctx, 0, 0, W, H, 36);
      ctx.clip();

      if (bgImg) {
        const sc = Math.max(W / bgImg.width, H / bgImg.height);
        const bw = bgImg.width * sc;
        const bh = bgImg.height * sc;
        ctx.drawImage(bgImg, (W - bw) / 2, (H - bh) / 2, bw, bh);
      } else {
        ctx.fillStyle = "#3b2f55";
        ctx.fillRect(0, 0, W, H);
      }
      const ov = ctx.createLinearGradient(0, 0, 0, H);
      ov.addColorStop(0, "rgba(45,38,90,0.25)");
      ov.addColorStop(1, "rgba(80,70,150,0.75)");
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, W, H);

      /* ---- time + name ---- */
      let time = "09:07 PM";
      try {
        time = new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" });
      } catch (e) {}
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `22px ${FONT}`;
      ctx.fillText(time, W / 2, 50);

      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(235,230,248,0.85)";
      ctx.font = `22px ${FONT}`;
      ctx.fillText(name, bubbleX + 10, 104);

      /* ---- bubble ---- */
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "rgba(53,52,66,0.96)";
      rr(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 34);
      ctx.fill();
      ctx.restore();

      // text + emoji
      ctx.fillStyle = "#ffffff";
      ctx.font = `${FS}px ${FONT}`;
      const eSize = FS * 1.1;
      lines.forEach((ln, i) => {
        let x = bubbleX + padX;
        const y = bubbleY + padY + 32 + i * LH;
        for (const s of mergeSegs(ln.segs)) {
          if (s.e) {
            const img = emojiCache.get(toCode(s.t));
            if (img) ctx.drawImage(img, x, y - eSize * 0.82, eSize, eSize);
            else ctx.fillText(s.t, x, y);
            x += FS * 1.15;
          } else {
            ctx.fillText(s.t, x, y);
            x += ctx.measureText(s.t).width;
          }
        }
      });

      // avatars
      drawAvatar(ctx, avatarImg, 24 + 24, bubbleBottom - 24, 48);
      drawAvatar(ctx, avatarImg, W - 46, bubbleBottom + 20, 22);

      /* ---- bottom bar ---- */
      const cy = barY + 30;
      const blue = "#6a8bff";

      // plus
      ctx.fillStyle = blue;
      ctx.beginPath(); ctx.arc(44, cy, 18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(44, cy - 8); ctx.lineTo(44, cy + 8); ctx.moveTo(36, cy); ctx.lineTo(52, cy); ctx.stroke();

      // camera
      ctx.fillStyle = blue;
      rr(ctx, 86, cy - 14, 40, 28, 8); ctx.fill();
      ctx.fillStyle = "rgba(60,50,120,0.9)";
      ctx.beginPath(); ctx.arc(106, cy + 1, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = blue;
      ctx.beginPath(); ctx.arc(106, cy + 1, 4.5, 0, Math.PI * 2); ctx.fill();

      // image
      ctx.fillStyle = blue;
      rr(ctx, 142, cy - 17, 38, 34, 8); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.moveTo(146, cy + 13); ctx.lineTo(158, cy - 3); ctx.lineTo(166, cy + 6); ctx.lineTo(171, cy); ctx.lineTo(177, cy + 13);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(167, cy - 9, 4, 0, Math.PI * 2); ctx.fill();

      // mic
      ctx.fillStyle = blue;
      rr(ctx, 209, cy - 18, 14, 26, 7); ctx.fill();
      ctx.strokeStyle = blue; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(216, cy - 2, 12, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(216, cy + 10); ctx.lineTo(216, cy + 17); ctx.stroke();

      // input pill
      const pillX = 250;
      const pillW = W - 100 - pillX;
      ctx.fillStyle = "#000000";
      rr(ctx, pillX, barY, pillW, 60, 30); ctx.fill();
      ctx.fillStyle = "#a29eb2";
      ctx.font = `26px ${FONT}`;
      ctx.fillText("Message", pillX + 24, barY + 39);

      // smiley
      const sx = pillX + pillW - 34;
      ctx.fillStyle = blue;
      ctx.beginPath(); ctx.arc(sx, cy, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(30,25,70,0.95)";
      ctx.beginPath(); ctx.arc(sx - 6, cy - 4, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + 6, cy - 4, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(30,25,70,0.95)"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(sx, cy + 1, 8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();

      // duck
      const duck = emojiCache.get("1f425");
      if (duck) ctx.drawImage(duck, W - 84, cy - 22, 44, 44);

      // home indicator
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      rr(ctx, W / 2 - 100, H - 22, 200, 6, 3); ctx.fill();

      ctx.restore();

      /* ---- send ---- */
      outFile = path.join(cacheDir, `fakechat_${Date.now()}.png`);
      await fs.writeFile(outFile, canvas.toBuffer("image/png"));
      await send({ attachment: fs.createReadStream(outFile) });
    } catch (err) {
      console.error("[fakechat] error:", err);
      return send("❌ Fakechat banate somoshya: " + (err.message || err));
    } finally {
      if (outFile) fs.remove(outFile).catch(() => {});
    }
  }
};
