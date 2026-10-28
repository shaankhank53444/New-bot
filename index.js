/**
 * @author Mr.king x Aliya
 * Aliya Official V4 Engine
 * Ultra Fast Auto-Recovery Launcher (v2)
 */

"use strict";

const { spawn } = require("child_process");
const net = require("net");

const BOT_FILE = "Aliya.js";
const RESTART_DELAY = 1000;
const MAX_CRASH_COUNT = 5;
const CRASH_WINDOW = 60 * 1000;          // crashes counted inside this window
const CRASH_PAUSE = 30 * 1000;           // pause after too many crashes
const MAX_LOGOUT_RETRIES = 3;            // exit code 0 = logout / stop
const LOGOUT_RETRY_DELAY = 30 * 1000;
const STABLE_UPTIME = 5 * 60 * 1000;     // running this long resets all counters
const EXIT_RESTART = 2;                  // bot asked for a planned restart
const KILL_TIMEOUT = 5000;

const BANNER = `
  █████╗ ██╗     ██╗██╗   ██╗██████╗     ██╗   ██╗██╗  ██╗
 ██╔══██╗██║     ██║╚██╗ ██╔╝██╔══██╗    ██║   ██║██║  ██║
 ███████║██║     ██║ ╚████╔╝ ██████╔╝    ██║   ██║███████║
 ██╔══██║██║     ██║  ╚██╔╝  ██╔══██╗    ╚██╗ ██╔╝╚════██║
 ██║  ██║███████╗██║   ██║   ██║  ██║     ╚████╔╝      ██║
 ╚═╝  ╚═╝╚══════╝╚═╝   ╚═╝   ╚═╝  ╚═╝      ╚═══╝       ╚═╝
`;

let child = null;
let shuttingDown = false;
let restartTimer = null;
let restartCount = 0;
let starting = false;
let crashCount = 0;
let lastCrashTime = 0;
let logoutRetries = 0;
let lastStart = 0;

const PREFERRED_PORT = Number(process.env.PORT) || 8080;

function now() {
    return new Date().toTimeString().split(" ")[0];
}

function log(symbol, tag, msg) {
    console.log(`[${now()}] ${symbol} [${tag}] ──► ${msg}`);
}

const errMsg = err => String((err && err.message) || err);

function isPortFree(port) {
    return new Promise(resolve => {
        const tester = net.createServer();
        tester.once("error", () => resolve(false));
        tester.once("listening", () => tester.close(() => resolve(true)));
        tester.listen(port, "0.0.0.0");
    });
}

function getRandomFreePort() {
    return new Promise((resolve, reject) => {
        const tester = net.createServer();
        tester.once("error", reject);
        tester.listen(0, "0.0.0.0", () => {
            const port = tester.address().port;
            tester.close(() => resolve(port));
        });
    });
}

async function pickPort() {
    for (let i = 0; i < 5; i++) {
        if (await isPortFree(PREFERRED_PORT)) return PREFERRED_PORT;
        await new Promise(r => setTimeout(r, 500));
    }
    const port = await getRandomFreePort();
    log("⚠️", "PORT", `Port ${PREFERRED_PORT} is busy. Using free port ${port} instead.`);
    return port;
}

function isChildRunning() {
    return child !== null && child.exitCode === null && child.signalCode === null;
}

function scheduleRestart(delay = RESTART_DELAY, reason = "RECOVERY") {
    if (shuttingDown || restartTimer) return;
    log("🛡️", reason, `Re-booting in ${Math.round(delay / 1000)}s...`);
    restartTimer = setTimeout(() => {
        restartTimer = null;
        startBot();
    }, delay);
}

function handleExit(code, signal) {
    child = null;
    log("💀", "EXIT", `Stopped | Code: [ ${code} ] | Signal: [ ${signal} ]`);
    if (shuttingDown) return;

    const uptime = Date.now() - lastStart;
    if (uptime > STABLE_UPTIME) {
        crashCount = 0;
        logoutRetries = 0;
    }

    // Planned restart requested by the bot (autoRestart / restart command)
    if (code === EXIT_RESTART) {
        log("🔄", "RESTART", "Planned restart requested by the bot.");
        return scheduleRestart(RESTART_DELAY, "RESTART");
    }

    // Code 0 = bot stopped itself / account logged out: retry a few times, then stop
    if (code === 0) {
        if (logoutRetries >= MAX_LOGOUT_RETRIES) {
            log("🛑", "STOP", "Bot keeps logging out. Check appstate/checkpoint. Server turning OFF...");
            shuttingDown = true;
            return process.exit(0);
        }
        logoutRetries++;
        log("🔁", "RELOGIN", `Bot exited with code 0 (logout?). Retry ${logoutRetries}/${MAX_LOGOUT_RETRIES}`);
        return scheduleRestart(LOGOUT_RETRY_DELAY, "RELOGIN");
    }

    // Crash-loop protection (also covers kills by signal, e.g. out of memory)
    const t = Date.now();
    crashCount = t - lastCrashTime < CRASH_WINDOW ? crashCount + 1 : 1;
    lastCrashTime = t;

    if (crashCount >= MAX_CRASH_COUNT) {
        log("🚨", "CRASH_GUARD", `Too many crashes (${crashCount} in 1 minute). Pausing ${CRASH_PAUSE / 1000}s...`);
        crashCount = 0;
        return scheduleRestart(CRASH_PAUSE, "CRASH_GUARD");
    }

    log("⚠️", "AUTO_HEAL", `Crash detected! Consecutive crashes: [ ${crashCount} ]`);
    scheduleRestart(RESTART_DELAY * crashCount, "RECOVERY");
}

async function startBot() {
    if (shuttingDown || starting) return;

    if (isChildRunning()) {
        log("⚠️", "INDEX", `${BOT_FILE} is already running!`);
        return;
    }

    if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
    }

    starting = true;
    let botPort;
    try {
        botPort = await pickPort();
    } catch (e) {
        starting = false;
        log("❌", "PORT_FAIL", errMsg(e));
        return scheduleRestart();
    }
    starting = false;
    if (shuttingDown) return;

    restartCount++;

    console.log("\n" + BANNER);
    console.log(" ╔═══════════════════════════════════════════════════════════╗");
    console.log(" ║              👑 ALIYA OFFICIAL V4 ENGINE                  ║");
    console.log(" ║              👤 DEVELOPER : Mr.king                      ║");
    console.log(` ║              🔄 LAUNCH COUNT : ${String(restartCount).padEnd(25)} ║`);
    console.log(" ╚═══════════════════════════════════════════════════════════╝\n");

    try {
        child = spawn(process.execPath, [BOT_FILE], {
            cwd: __dirname,
            stdio: "inherit",
            shell: false,
            env: { ...process.env, PORT: String(botPort) }
        });
    } catch (error) {
        log("❌", "SPAWN_FAIL", `Failed to start ${BOT_FILE}: ${errMsg(error)}`);
        child = null;
        return scheduleRestart();
    }

    lastStart = Date.now();
    log("🚀", "SYSTEM", `Bot core spawned | PID: [ ${child.pid} ] | PORT: [ ${botPort} ]`);

    child.on("error", error => log("❌", "PROCESS_ERR", `Error in ${BOT_FILE}: ${errMsg(error)}`));
    child.on("exit", handleExit);
}

// Watchdog: if nothing is running and nothing is scheduled, start again
setInterval(() => {
    if (!shuttingDown && !isChildRunning() && !restartTimer && !starting) {
        log("⚠️", "WATCHDOG", "Bot is inactive! Forcing start...");
        scheduleRestart();
    }
}, 10000);

// Graceful shutdown: wait for the bot to exit, force-kill after a timeout
function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    log("⚠️", "SHUTDOWN", `${signal} received. Cleaning up...`);
    if (restartTimer) clearTimeout(restartTimer);

    if (!isChildRunning()) return process.exit(0);

    child.once("exit", () => process.exit(0));
    try { child.kill(signal); } catch (e) { return process.exit(0); }
    setTimeout(() => {
        try { child.kill("SIGKILL"); } catch (e) {}
        process.exit(0);
    }, KILL_TIMEOUT).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", err => log("❌", "UNCAUGHT", errMsg(err)));
process.on("unhandledRejection", err => log("⚠️", "UNHANDLED", errMsg(err)));

startBot();
