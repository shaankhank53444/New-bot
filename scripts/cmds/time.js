const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "time",
    version: "2.0.0",
    author: "𝔐𝔯.𝔎𝔦𝔫𝔤",
    role: 0,
    countDown: 3,
    shortDescription: "Fetches stylish time card from API",
    category: "tools",
    guide: { en: "{p}time - Get current neon time card" }
  },

  onStart: async ({ message, api, event }) => {
    if (api && typeof api.setMessageReaction === "function") {
      api.setMessageReaction("⌛️", event.messageID, () => {}, true);
    }

    try {
      const apiUrl = "https://xsaim8x-xxx-api.onrender.com/api/time";
      const response = await axios.get(apiUrl, { responseType: "arraybuffer" });

      const tmpDir = path.join(__dirname, "cache");
      await fs.ensureDir(tmpDir);

      const filePath = path.join(tmpDir, `time_card_${Date.now()}.png`);
      fs.writeFileSync(filePath, Buffer.from(response.data));

      if (api && typeof api.setMessageReaction === "function") {
        api.setMessageReaction("✅️", event.messageID, () => {}, true);
      }

      const signature = `╭───────────────⬣\n│ 𝐌𝐚𝐝𝐞 𝐰𝐢𝐭𝐡 🤍 by --𝔐𝔯.𝔎𝔦𝔫𝔤\n╰───────────────⬣`;
      
      return message.reply({
        body: `⏰ 𝐍𝐄𝐎𝐍 𝐓𝐈𝐌𝐄 𝐂𝐀𝐑𝐃 🌸\n\n${signature}`,
        attachment: fs.createReadStream(filePath)
      }, () => fs.unlinkSync(filePath));

    } catch (err) {
      if (api && typeof api.setMessageReaction === "function") {
        api.setMessageReaction("❌️", event.messageID, () => {}, true);
      }
      return message.reply("❌ Failed to fetch time card, please try again!");
    }
  }
};
    
