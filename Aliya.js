/**
 * @author Mr.king
 * ! Modified and Updated for Aliya Bot v4 Engine
 */

"use strict";

// Trace WHO stops the bot and with which code (helps find the real logout cause)
const _realExit = process.exit;
process.exit = function (code) {
	console.error(`[EXIT_TRACE] process.exit(${code}) called from:\n${new Error().stack.split("\n").slice(2, 7).join("\n")}`);
	return _realExit.call(process, code);
};

// Error storm guard: log errors, but restart cleanly if they pile up
const errorTimes = [];
function onFatal(tag, error) {
	console.error(tag, error);
	const t = Date.now();
	errorTimes.push(t);
	while (errorTimes.length && t - errorTimes[0] > 60000) errorTimes.shift();
	if (errorTimes.length >= 20) {
		console.error("[FATAL] 20+ errors in 60s. Exiting so the launcher can restart cleanly...");
		process.exit(1);
	}
}
process.on('unhandledRejection', error => onFatal("[UNHANDLED_REJECTION]", error));
process.on('uncaughtException', error => onFatal("[UNCAUGHT_EXCEPTION]", error));

const withTimeout = (promise, ms, label) =>
	Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms))]);

const fs = require("fs-extra");
const google = require("googleapis").google;
const nodemailer = require("nodemailer");
const log = require('./logger/log.js');
const path = require("path");

process.env.BLUEBIRD_W_FORGOTTEN_RETURN = 0;

// Dynamic Path Loader
function getConfigPath(baseName, ext = ".json") {
	const devPath = path.join(__dirname, `${baseName}.dev${ext}`);
	const normalPath = path.join(__dirname, `${baseName}${ext}`);
	if (fs.existsSync(devPath)) {
		console.log(`⚙️ Loaded ${baseName}.dev${ext}`);
		return devPath;
	} else if (fs.existsSync(normalPath)) {
		console.log(`⚙️ Loaded ${baseName}${ext}`);
		return normalPath;
	} else {
		throw new Error(`❌ Missing ${baseName}${ext} or ${baseName}.dev${ext}`);
	}
}

// Fast Built-in JSON Validator
function validJSON(pathDir) {
	if (!fs.existsSync(pathDir)) throw new Error(`File "${pathDir}" not found`);
	try {
		const content = fs.readFileSync(pathDir, "utf-8");
		JSON.parse(content);
		return true;
	} catch (err) {
		throw new Error(`JSON Syntax Error in ${pathDir}: ${err.message}`);
	}
}

const dirConfig = getConfigPath("config", ".json");
const dirConfigCommands = getConfigPath("configCommands", ".json");
const dirAccount = getConfigPath("account", ".txt");

for (const pathDir of [dirConfig, dirConfigCommands]) {
	try {
		validJSON(pathDir);
	} catch (err) {
		log.error("CONFIG", `${err.message}\nPlease fix it and restart bot.`);
		process.exit(1);
	}
}

const config = require(dirConfig);
if (config.whiteListMode?.whiteListIds && Array.isArray(config.whiteListMode.whiteListIds)) {
	config.whiteListMode.whiteListIds = config.whiteListMode.whiteListIds.map(id => id.toString());
}
const configCommands = require(dirConfigCommands);

// Global Bot Storage Initialization
global.GoatBot = {
	startTime: Date.now() - process.uptime() * 1000,
	commands: new Map(),
	eventCommands: new Map(),
	commandFilesPath: [],
	eventCommandsFilesPath: [],
	aliases: new Map(),
	onFirstChat: [],
	onChat: [],
	onEvent: [],
	onReply: new Map(),
	onReaction: new Map(),
	onAnyEvent: [],
	config,
	configCommands,
	envCommands: {},
	envEvents: {},
	envGlobal: {},
	reLoginBot: function () { },
	Listening: null,
	oldListening: [],
	callbackListenTime: {},
	storage5Message: [],
	fcaApi: null,
	botID: null
};

global.db = {
	allThreadData: [],
	allUserData: [],
	allDashBoardData: [],
	allGlobalData: [],
	threadModel: null,
	userModel: null,
	dashboardModel: null,
	globalModel: null,
	threadsData: null,
	usersData: null,
	dashBoardData: null,
	globalData: null,
	receivedTheFirstMessage: {}
};

global.client = {
	dirConfig,
	dirConfigCommands,
	dirAccount,
	countDown: {},
	cache: {},
	database: {
		creatingThreadData: [],
		creatingUserData: [],
		creatingDashBoardData: [],
		creatingGlobalData: []
	},
	commandBanned: configCommands.commandBanned
};

const utils = require("./utils.js");
global.utils = utils;

global.temp = {
	createThreadData: [],
	createUserData: [],
	createThreadDataError: [],
	filesOfGoogleDrive: {
		arraybuffer: {},
		stream: {},
		fileNames: {}
	},
	contentScripts: {
		cmds: {},
		events: {}
	}
};

// Hot Reloading Setup
const watchAndReloadConfig = (dir, type, prop, logName, afterReload) => {
	let lastModified = fs.statSync(dir).mtimeMs;
	fs.watch(dir, (eventType) => {
		if (eventType === type) {
			setTimeout(() => {
				try {
					const currentMtime = fs.statSync(dir).mtimeMs;
					if (lastModified === currentMtime) return;
					lastModified = currentMtime;

					const fresh = JSON.parse(fs.readFileSync(dir, 'utf-8'));
					const target = global.GoatBot[prop];
					for (const key of Object.keys(target)) delete target[key];
					Object.assign(target, fresh);
					if (afterReload) afterReload();
					log.success(logName, `Reloaded ${dir.replace(process.cwd(), "")}`);
				} catch (err) {
					log.warn(logName, `Can't reload ${dir.replace(process.cwd(), "")}`);
				}
			}, 200);
		}
	});
};

const syncEnv = () => {
	global.GoatBot.envGlobal = global.GoatBot.configCommands.envGlobal;
	global.GoatBot.envCommands = global.GoatBot.configCommands.envCommands;
	global.GoatBot.envEvents = global.GoatBot.configCommands.envEvents;
};
const syncWhiteList = () => {
	const ids = global.GoatBot.config.whiteListMode?.whiteListIds;
	if (Array.isArray(ids)) global.GoatBot.config.whiteListMode.whiteListIds = ids.map(id => id.toString());
};

watchAndReloadConfig(dirConfigCommands, 'change', 'configCommands', 'CONFIG COMMANDS', syncEnv);
watchAndReloadConfig(dirConfig, 'change', 'config', 'CONFIG', syncWhiteList);
syncEnv();

const getText = global.utils.getText;

// Auto Restart Manager
if (config.autoRestart) {
	const time = config.autoRestart.time;
	if (!isNaN(time) && time > 0) {
		utils.log.info("AUTO RESTART", getText("Goat", "autoRestart1", utils.convertTime(time, true)));
		setTimeout(() => {
			utils.log.info("AUTO RESTART", "Restarting system...");
			process.exit(2);
		}, time);
	} else if (typeof time == "string" && time.match(/^((((\d+,)+\d+|(\d+(\/|-|#)\d+)|\d+L?|\*(\/\d+)?|L(-\d+)?|\?|[A-Z]{3}(-[A-Z]{3})?) ?){5,7})$/gmi)) {
		utils.log.info("AUTO RESTART", getText("Goat", "autoRestart2", time));
		const cron = require("node-cron");
		cron.schedule(time, () => {
			utils.log.info("AUTO RESTART", "Restarting system...");
			process.exit(2);
		});
	}
}

// Async Main Bootstrapper
(async () => {
	// 1. Gmail & OAuth2 Setup
	try {
		const { gmailAccount } = config.credentials || {};
		if (gmailAccount?.email && gmailAccount?.refreshToken) {
			const { email, clientId, clientSecret, refreshToken } = gmailAccount;
			const OAuth2 = google.auth.OAuth2;
			const OAuth2_client = new OAuth2(clientId, clientSecret);
			OAuth2_client.setCredentials({ refresh_token: refreshToken });
			
			const accessToken = await withTimeout(OAuth2_client.getAccessToken(), 15000, "Gmail token");
			const transporter = nodemailer.createTransport({
				host: 'smtp.gmail.com',
				service: 'Gmail',
				auth: {
					type: 'OAuth2',
					user: email,
					clientId,
					clientSecret,
					refreshToken,
					accessToken
				}
			});

			global.utils.sendMail = async ({ to, subject, text, html, attachments }) => {
				return await transporter.sendMail({ from: email, to, subject, text, html, attachments });
			};
			global.utils.transporter = transporter;
		}
	} catch (err) {
		log.warn("GMAIL_INIT", "Gmail/Nodemailer bypass: " + err.message);
	}

	// 2. Google Drive Setup
	try {
		if (utils.drive && typeof utils.drive.checkAndCreateParentFolder === "function") {
			utils.drive.parentID = await withTimeout(utils.drive.checkAndCreateParentFolder("AliyaBot"), 15000, "Google Drive");
		}
	} catch (err) {
		log.warn("GDRIVE_INIT", "Google Drive bypass: " + err.message);
	}

	// 3. Trigger Core Login (exit on boot failure so the launcher restarts us, never a silent zombie)
	try {
		require(`./bot/login/login.js`);
	} catch (err) {
		log.error("LOGIN_BOOT", err.stack || err.message);
		process.exit(1);
	}
})().catch(err => {
	log.error("BOOT", err.stack || err.message);
	process.exit(1);
});
	
