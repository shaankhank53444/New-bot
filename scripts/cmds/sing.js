const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "sing",
    aliases: ["playaudio", "song", "audio"],
    version: "2.0.0",
    author: "azadx69x x Mr.king",
    countDown: 3,
    role: 0,
    shortDescription: "Download and play song audio quickly",
    category: "media",
    guide: { en: "{p}sing <song name>" }
  },

  onStart: async function ({ message, args, api, event }) {
    const query = args.join(" ");
    if (!query) return message.reply("⚠️ Ganer nam ba keyword dao! Jemon: `/sing Nadaaniyan`");

    if (api && typeof api.setMessageReaction === "function") {
      api.setMessageReaction("⌛️", event.messageID, () => {}, true);
    }

    try {
      const encodedQuery = encodeURIComponent(query);
      const res = await axios.get(`https://azadx69x.is-a.dev/api/sing?song=${encodedQuery}`);
      const resData = res?.data;

      const audioUrl = resData?.data?.audio?.url;
      const title = resData?.data?.info?.title || query;
      const artist = resData?.data?.info?.artist || "Unknown Artist";

      if (!audioUrl) {
        if (api && typeof api.setMessageReaction === "function") {
          api.setMessageReaction("❌️", event.messageID, () => {}, true);
        }
        return message.reply("❌ Ganer audio link khuje pawa jayni, onno gan try koro!");
      }

      const buffer = (await axios.get(audioUrl, { responseType: "arraybuffer" })).data;
      const filePath = path.join(__dirname, "cache", `sing_${Date.now()}.mp3`);
      await fs.ensureDir(path.dirname(filePath));
      fs.writeFileSync(filePath, Buffer.from(buffer));

      if (api && typeof api.setMessageReaction === "function") {
        api.setMessageReaction("✅️", event.messageID, () => {}, true);
      }

      const caption = 
        `🎵 𝐒𝐎𝐍𝐆 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑 🌸\n` +
        `📌 𝐓𝐢𝐭𝐥𝐞: ${title}\n` +
        `🎤 𝐀𝐫𝐭𝐢𝐬𝐭: ${artist}\n\n` +
        `╭───────────────⬣\n│ 𝐌𝐚𝐝𝐞 𝐰𝐢𝐭𝐡 🤍 𝐛𝐲 --𝔐𝔯.𝔎𝔦𝔫𝔤\n╰───────────────⬣`;

      return message.reply({
        body: caption,
        attachment: fs.createReadStream(filePath)
      }, () => fs.unlinkSync(filePath));

    } catch (err) {
      if (api && typeof api.setMessageReaction === "function") {
        api.setMessageReaction("❌️", event.messageID, () => {}, true);
      }
      return message.reply("❌ Gan download korte samossya hoyeche, abar chesta koro!");
    }
  }
};
                                                                             
