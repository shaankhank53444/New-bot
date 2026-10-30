const path = require("path");

module.exports = {
  config: {
    name: "update",
    version: "4.1.0",
    author: "𝔐𝔯.𝔎𝔦𝔫𝔤",
    countDown: 5,
    role: 4,
    shortDescription: "Update Aliya Official V4 from its verified update manifest",
    category: "owner",
    guide: { en: "{p}update" }
  },

  onStart: async function ({ message, api, event }) {
    if (api && typeof api.setMessageReaction === "function") {
      api.setMessageReaction("⌛️", event.messageID, () => {}, true);
    }

    try {
      await message.reply("🌸 Checking for Aliya V4 updates from verified repository...");
      
      const updaterPath = path.resolve(__dirname, "../../updater.js");
      if (require.cache[updaterPath]) {
        delete require.cache[updaterPath];
      }
      
      require(updaterPath);

      if (api && typeof api.setMessageReaction === "function") {
        api.setMessageReaction("✅️", event.messageID, () => {}, true);
      }
    } catch (err) {
      if (api && typeof api.setMessageReaction === "function") {
        api.setMessageReaction("❌️", event.messageID, () => {}, true);
      }
      return message.reply("❌ Update failed: " + (err.message || err));
    }
  }
};
        
