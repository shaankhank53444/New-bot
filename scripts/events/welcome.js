module.exports = {
	config: {
		name: "welcome",
		version: "4.0",
		author: "Mr.king",
		category: "events"
	},

	langs: {
		en: {
			welcomeMsg: "𓍢ִ໋🌸✧ ── ͟͟͞͞Aliya v4 System Status ── ✧🌸𓍢ִ໋🌷͙֒\n\nᥫ᭡ Group : %1\nᥫ᭡ System Prefix : %2\nᥫ᭡ Group Prefix : %3\n\nHello new member %4, welcome to the group! Your ID is %5"
		}
	},

	onStart: async function ({ api, usersData, threadsData, message, event, prefix, getLang }) {
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

				const text = getLang("welcomeMsg", threadName, systemPrefix, groupPrefix, userName, userID);
				
				const axios = require("axios");
				const imgUrl = "https://i.imgur.com/D5fW2iu.jpeg";
				const res = await axios.get(imgUrl, { responseType: "stream" });

				await message.send({
					body: text,
					attachment: res.data
				});
			}
		}
	}
};
	
