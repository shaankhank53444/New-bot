const axios = require('axios');

module.exports = {
  config: {
    name: "animequiz",
    aliases: ["aniqz"],
    version: "2.0.0",
    author: "Mr.King",
    countDown: 7,
    role: 0,
    shortDescription: "Play Anime Quiz to earn rewards",
    longDescription: "Fetch anime quiz from Vercel API and answer to win 10k coins",
    category: "game",
    guide: "{pn}"
  },

  onStart: async function ({ api, event, reply }) {
    try {
      const res = await axios.get('https://aliya-game.vercel.app/api/game/animequiz/random');

      if (!res.data.success || !res.data.data) {
        return reply("⚠️ Server theke quiz fetch kora jayni. Onno kono game try koro!");
      }

      const quiz = res.data.data;
      const mediaUrl = quiz.activeMedia || quiz.media.imgur || quiz.media.drive;

      let msg = "✨ ─── [ ANIME QUIZ ] ─── ✨\n\n";
      msg += `❓ Question: ${quiz.title}\n\n`;

      const labels = ["A", "B", "C", "D"];
      quiz.options.forEach((opt, idx) => {
        msg += `[ ${labels[idx]} ] ${opt}\n`;
      });

      msg += "\n🎁 Reward: $10,000\n";
      msg += "⏱️ Reply with option (A/B/C/D or 1/2/3/4)";

      const replyData = {
        commandName: this.config.name,
        messageID: null,
        author: event.senderID,
        correctIndex: quiz.correctIndex,
        options: quiz.options,
        answered: false
      };

      if (mediaUrl) {
        try {
          const stream = (await axios.get(mediaUrl, { responseType: 'stream', timeout: 5000 })).data;
          const info = await api.sendMessage({ body: msg, attachment: stream }, event.threadID, event.messageID);
          replyData.messageID = info.messageID;
          global.GoatBot.onReply.set(info.messageID, replyData);
          return;
        } catch (e) {
          if (quiz.media.drive && mediaUrl !== quiz.media.drive) {
            try {
              const driveStream = (await axios.get(quiz.media.drive, { responseType: 'stream', timeout: 5000 })).data;
              const info = await api.sendMessage({ body: msg, attachment: driveStream }, event.threadID, event.messageID);
              replyData.messageID = info.messageID;
              global.GoatBot.onReply.set(info.messageID, replyData);
              return;
            } catch (err) {}
          }
        }
      }

      const info = await api.sendMessage(msg, event.threadID, event.messageID);
      replyData.messageID = info.messageID;
      global.GoatBot.onReply.set(info.messageID, replyData);

    } catch (err) {
      return reply("❌ Game server offline or connection error!");
    }
  },

  onReply: async function ({ api, event, Reply, Users, reply }) {
    if (event.senderID !== Reply.author) return;

    if (Reply.answered) {
      return reply("⚠️ Tui eita ekbar uttor diye felechos!");
    }

    const input = event.body.trim().toUpperCase();
    let userAns = -1;

    if (["A", "1"].includes(input)) userAns = 0;
    else if (["B", "2"].includes(input)) userAns = 1;
    else if (["C", "3"].includes(input)) userAns = 2;
    else if (["D", "4"].includes(input)) userAns = 3;

    if (userAns === -1) {
      return reply("⚠️ Valid option choose koro: A, B, C, D ba 1, 2, 3, 4");
    }

    Reply.answered = true;
    global.GoatBot.onReply.delete(Reply.messageID);

    const labels = ["A", "B", "C", "D"];
    const correctAnsText = Reply.options[Reply.correctIndex] || "N/A";
    const correctLabel = labels[Reply.correctIndex];

    if (userAns === Reply.correctIndex) {
      const reward = 10000;
      await Users.increaseMoney(event.senderID, reward);
      return reply(`🎉 𝗖𝗢𝗡𝗚𝗥𝗔𝗧𝗨𝗟𝗔𝗧𝗜𝗢𝗡𝗦!\n\nTor uttor shothik hoyeche!\n💰 Prize Received: $10,000`);
    } else {
      const stylishAns = `❮ ${correctLabel} ❯  ❯❯ ${correctAnsText.toUpperCase()} ❮❮`;
      return reply(`❌ 𝗪𝗥𝗢𝗡𝗚 𝗔𝗡𝗦𝗪𝗘𝗥!\n\n💰 Added Balance: $0\n\n📌 𝗖𝗼𝗿𝗿𝗲𝗰𝘁 𝗔𝗻𝘀𝘄𝗲𝗿: ${stylishAns}`);
    }
  }
};
          
