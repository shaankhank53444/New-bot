/**
 * Aliya Official V4 - Keep-Alive / Status Server
 * Run it separately only if your bot itself does not already open the PORT.
 */

"use strict";

const express = require("express");
const app = express();
const PORT = Number(process.env.PORT) || 8000;

app.disable("x-powered-by");

function formatUptime(sec) {
	const d = Math.floor(sec / 86400);
	const h = Math.floor((sec % 86400) / 3600);
	const m = Math.floor((sec % 3600) / 60);
	const s = Math.floor(sec % 60);
	return `${d}d ${h}h ${m}m ${s}s`;
}

// Lightweight health check (for UptimeRobot / Render / Koyeb pings)
app.get("/health", (req, res) => {
	res.status(200).json({
		status: "ok",
		bot: "Aliya Official v4",
		uptime: formatUptime(process.uptime()),
		memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
	});
});

app.get("/", (req, res) => {
	const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);
	res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Aliya Official v4</title>
<style>
	* { margin: 0; padding: 0; box-sizing: border-box; }
	body {
		min-height: 100vh; display: flex; align-items: center; justify-content: center;
		background: radial-gradient(circle at 20% 20%, #3a0ca3 0%, #10002b 45%, #000 100%);
		font-family: "Segoe UI", system-ui, sans-serif; color: #fff;
	}
	.card {
		width: min(92vw, 420px); padding: 36px 28px; text-align: center;
		background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
		border-radius: 24px; backdrop-filter: blur(14px);
		box-shadow: 0 20px 60px rgba(157, 78, 221, 0.35);
	}
	h1 {
		font-size: 30px; letter-spacing: 1px;
		background: linear-gradient(90deg, #f72585, #b5179e, #7209b7, #4cc9f0);
		-webkit-background-clip: text; background-clip: text; color: transparent;
	}
	.sub { margin-top: 6px; font-size: 13px; opacity: .7; }
	.status {
		margin: 22px auto 18px; display: inline-flex; align-items: center; gap: 10px;
		padding: 8px 18px; border-radius: 999px; background: rgba(76, 201, 94, .15);
		border: 1px solid rgba(76, 201, 94, .5); font-weight: 600; color: #7dffa0;
	}
	.dot { width: 10px; height: 10px; border-radius: 50%; background: #4cd964; animation: pulse 1.6s infinite; }
	@keyframes pulse {
		0% { box-shadow: 0 0 0 0 rgba(76,217,100,.7); }
		70% { box-shadow: 0 0 0 12px rgba(76,217,100,0); }
		100% { box-shadow: 0 0 0 0 rgba(76,217,100,0); }
	}
	.row { display: flex; justify-content: space-between; padding: 10px 4px; font-size: 14px; border-top: 1px solid rgba(255,255,255,.1); }
	.row span:first-child { opacity: .65; }
	.foot { margin-top: 20px; font-size: 12px; opacity: .55; }
</style>
</head>
<body>
	<div class="card">
		<h1>👑 ALIYA V4</h1>
		<div class="sub">Official Bot Engine</div>
		<div class="status"><span class="dot"></span> Online &amp; Alive</div>
		<div class="row"><span>Uptime</span><span id="up">${formatUptime(process.uptime())}</span></div>
		<div class="row"><span>Memory</span><span>${mem} MB</span></div>
		<div class="row"><span>Developer</span><span>Mr.king</span></div>
		<div class="foot">Made with ❤️ by Mr.king</div>
	</div>
	<script>
		let sec = ${Math.floor(process.uptime())};
		const f = s => Math.floor(s/86400)+"d "+Math.floor(s%86400/3600)+"h "+Math.floor(s%3600/60)+"m "+(s%60)+"s";
		setInterval(() => { sec++; document.getElementById("up").textContent = f(sec); }, 1000);
	</script>
</body>
</html>`);
});

app.use((req, res) => res.status(404).json({ status: "not_found" }));

const server = app.listen(PORT, "0.0.0.0", () => {
	console.log(`✅ Keep-alive server for Aliya v4 is running on port ${PORT}`);
});

// If the port is already used by the bot itself, don't crash - just stay quiet
server.on("error", (err) => {
	if (err.code === "EADDRINUSE") {
		console.log(`ℹ️ Port ${PORT} is already in use (bot server is active). Keep-alive skipped.`);
	} else {
		console.error("[KEEP_ALIVE_ERROR]", err.message);
	}
});

// Keep it robust
process.on("unhandledRejection", (e) => console.error("[KEEP_ALIVE_REJECTION]", e?.message || e));
process.on("uncaughtException", (e) => console.error("[KEEP_ALIVE_EXCEPTION]", e?.message || e));
