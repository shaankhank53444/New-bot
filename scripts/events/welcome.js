module.exports = {
	config: {
		name: "welcome",
		version: "5.0.0",
		author: "𝔐𝔯.𝔎𝔦𝔫𝔤",
		category: "events"
	},

	langs: {
		en: {
			welcomeMsg: 
				`🌸 𝖂𝖊𝖑𝖈𝖔𝖒𝖊 𝖙𝖔 𝖙𝖍𝖊 𝕲𝖗𝖔𝖚𝖕 🦢\n\n` +
				`✨ 𝖌𝖗𝖔𝖚𝖕 𝗻𝗮𝗺𝗲 : %1\n` +
				`📌 𝘀𝘆𝘀𝘁𝗲𝗺 𝗽𝗿𝗲𝗳𝗶𝘅 : %2\n` +
				`🔗 𝗴𝗿𝗼𝘂𝗽 𝗽𝗿𝗲𝗳𝗶𝘅 : %3\n\n` +
				`👋 𝖍𝖊𝖑𝖑𝖔 @%4, welcome to the family! Enjoy your time here. 🎉\n\n` +
				`╭───────────────⬣\n` +
				`│ 𝐌𝐚𝐝𝐞 𝐰𝐢𝐭𝐡 🤍 𝐛𝐲 --𝔐𝔯.𝔎𝔦𝔫𝔤\n` +
				`╰───────────────⬣`
		}
	},

	onStart: async function ({ api, usersData, threadsData, event, prefix, getLang }) {
		if (event.logMessageType === "log:subscribe") {
			const threadID = event.threadID;
			const threadInfo = await threadsData.get(threadID) || {};
			const threadName = threadInfo.threadName || "This Group";
			
			const systemPrefix = prefix; 
			const groupPrefix = threadInfo.data?.prefix || prefix;

			const addedParticipants = event.logMessageData.addedParticipants || [];
			for (const participant of addedParticipants) {
				const userID = participant.userFbId;
				const userName = participant.fullName || await usersData.getName(userID) || "User";

				const text = getLang("welcomeMsg", threadName, systemPrefix, groupPrefix, userName);
				
				const axios = require("axios");
				const imgUrl = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS4Bajq7KeozS19EhsrKZXtn9MxZoTSyE0TxcaByeRNew&s=10";
				
				try {
					const res = await axios.get(imgUrl, { responseType: "stream" });
					await api.sendMessage({
						body: text,
						mentions: [{ tag: userName, id: userID }],
						attachment: res.data
					}, threadID);
				} catch (err) {
					await api.sendMessage({
						body: text,
						mentions: [{ tag: userName, id: userID }]
					}, threadID);
				}
			}
		}
	}
};
						
