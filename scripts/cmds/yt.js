const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "yt",
    aliases: ["yts", "youtubesearch", "ytsearch"],
    version: "2.1.0",
    author: "𝔐𝔯.𝔎𝔦𝔫𝔤",
    countDown: 3,
    role: 0,
    shortDescription: "Search YouTube and download audio/video with autodl engine",
    category: "media",
    guide: { en: "{p}yt <search query>" }
  },

  onStart: async function ({ message, args, api, event }) {
    try {
      const query = args.join(" ");
      if (!query) return message.reply("⚠️ Please provide a search query! Example: `/yt Phonk`");

      if (api && typeof api.setMessageReaction === "function") {
        api.setMessageReaction("⌛️", event.messageID, () => {}, true);
      }

      const encodedQuery = encodeURIComponent(query);
      const res = await axios.get(`https://azadx69x.is-a.dev/api/youtube-search?query=${encodedQuery}&type=Bazil`);
      const resData = res?.data;

      const results = resData?.data?.results;
      if (!results || results.length === 0) {
        if (api && typeof api.setMessageReaction === "function") {
          api.setMessageReaction("❌️", event.messageID, () => {}, true);
        }
        return message.reply("❌ No results found on YouTube!");
      }

      if (api && typeof api.setMessageReaction === "function") {
        api.setMessageReaction("✅️", event.messageID, () => {}, true);
      }

      let msg = `📺 𝐘𝐎𝐔𝐓𝐔𝐁𝐄 𝐒𝐄𝐀𝐑𝐂𝐇 𝐑𝐄𝐒𝐔𝐋𝐓𝐒 🌸\n` +
                `📌 𝐐𝐮𝐞𝐫𝐲: ${query}\n\n`;

      const listItems = [];
      results.forEach((item, index) => {
        listItems.push(item);
        msg += `[ ${index + 1} ] 🎬 ${item.title}\n` +
               `⏱️ Duration: ${item.duration} | 👁️ Views: ${item.views}\n` +
               `📌 Channel: ${item.channel}\n───────────────────\n`;
      });

      const signature = `╭───────────────⬣\n│ 𝐌𝐚𝐝𝐞 𝐰𝐢𝐭𝐡 🤍 𝐛𝐲 --𝔐𝔯.𝔎𝔦𝔫𝔤\n╰───────────────⬣`;
      msg += `\n💬 Reply with format:\n👉 video <number> (e.g. video 1)\n👉 audio <number> (e.g. audio 1)\n\n${signature}`;

      return message.reply(msg, (err, info) => {
        if (err) return;
        global.GoatBot.onReply.set(info.messageID, {
          commandName: this.config.name,
          messageID: info.messageID,
          author: event.senderID,
          results: listItems
        });
      });

    } catch (err) {
      if (api && typeof api.setMessageReaction === "function") {
        api.setMessageReaction("❌️", event.messageID, () => {}, true);
      }
      return message.reply("❌ Error occurred while searching YouTube, please try again!");
    }
  },

  onReply: async function ({ message, event, api, reply }) {
    try {
      const { author, results } = reply;
      if (event.senderID !== author) return message.reply("⚠️ You cannot use this search result!");

      const args = event.body.trim().split(" ");
      const action = args[0]?.toLowerCase();
      const index = parseInt(args[1]) - 1;

      if (!["video", "audio"].includes(action) || isNaN(index) || !results[index]) {
        return message.reply("⚠️ Invalid format! Use: `audio 1` or `video 1`");
      }

      const selectedItem = results[index];
      let downloadUrl = action === "video" ? selectedItem.download_video : selectedItem.download_audio;

      if (api && typeof api.setMessageReaction === "function") {
        api.setMessageReaction("⌛️", event.messageID, () => {}, true);
      }

      global.GoatBot.onReply.delete(reply.messageID);

      // Autodl API Fallback integration if primary download url fails or missing
      if (!downloadUrl && selectedItem.url) {
        try {
          const autoRes = await axios.get(`https://xsaim8x-xxx-api.onrender.com/api/auto?url=${encodeURIComponent(selectedItem.url)}`);
          if (autoRes.data) {
            downloadUrl = action === "video" ? (autoRes.data.high_quality || autoRes.data.low_quality) : autoRes.data.audio || autoRes.data.high_quality;
          }
        } catch (e) {}
      }

      if (!downloadUrl) {
        if (api && typeof api.setMessageReaction === "function") {
          api.setMessageReaction("❌️", event.messageID, () => {}, true);
        }
        return message.reply("❌ Download link not found for this file!");
      }

      const buffer = (await axios.get(downloadUrl, { responseType: "arraybuffer" })).data;
      const extension = action === "video" ? "mp4" : "mp3";
      const filePath = path.join(__dirname, "cache", `yt_${Date.now()}.${extension}`);
      await fs.ensureDir(path.dirname(filePath));
      fs.writeFileSync(filePath, Buffer.from(buffer));

      if (api && typeof api.setMessageReaction === "function") {
        api.setMessageReaction("✅️", event.messageID, () => {}, true);
      }

      const signature = `╭───────────────⬣\n│ 𝐌𝐚𝐝𝐞 𝐰𝐢𝐭𝐡 🤍 𝐛𝐲 --𝔐𝔯.𝔎𝔦𝔫𝔤\n╰───────────────⬣`;
      const caption = `📥 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐃 (${action.toUpperCase()}) 🌸\n` +
                      `📌 𝐓𝐢𝐭𝐥𝐞: ${selectedItem.title}\n\n${signature}`;

      return message.reply({
        body: caption,
        attachment: fs.createReadStream(filePath)
      }, () => fs.unlinkSync(filePath));

    } catch (err) {
      if (api && typeof api.setMessageReaction === "function") {
        api.setMessageReaction("❌️", event.messageID, () => {}, true);
      }
      return message.reply("❌ Failed to download and send the file!");
    }
  }
};
      
