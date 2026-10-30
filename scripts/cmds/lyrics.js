const axios = require("axios");

module.exports = {
  config: {
    name: "lyrics",
    aliases: ["lyric", "songlyrics"],
    version: "1.0.0",
    author: "𝔐𝔯.𝔎𝔦𝔫𝔤",
    countDown: 5,
    role: 0,
    shortDescription: "Get song lyrics using Azadx69x API",
    category: "media",
    guide: { en: "{p}lyrics <song name>" }
  },

  onStart: async function ({ message, args, api, event }) {
    try {
      const query = args.join(" ");
      if (!query) return message.reply("⚠️ গানের নাম লিখে সার্চ করো! যেমন: `/lyrics Nadaaniyan`");

      if (api && typeof api.sendTypingIndicator === "function") {
        api.sendTypingIndicator(event.threadID, () => {});
      }

      // API Call
      const encodedQuery = encodeURIComponent(query);
      const res = await axios.get(`https://azadx69x.is-a.dev/api/lyrics?song=${encodedQuery}`);
      const resData = res?.data;

      // Extracting data based on your API response structure
      const songTitle = resData?.data?.song || query;
      const artistName = resData?.data?.artist || "Unknown Artist";
      const songLyrics = resData?.data?.lyrics;

      if (!songLyrics) {
        return message.reply("❌ এই গানের লিরিক্স খুঁজে পাওয়া যায়নি, অন্য গান দিয়ে চেষ্টা করো!");
      }

      // Formatting response with your custom stylish signature
      const signature = `╭───────────────⬣\n│ 𝐌𝐚𝐝𝐞 𝐰𝐢𝐭𝐡 🤍 𝐛𝐲 --𝔐𝔯.𝔎𝔦𝔫𝔤\n╰───────────────⬣`;

      const output = `📜 𝐒𝐎𝐍𝐆 𝐋𝐘𝐑𝐈𝐂𝐒 🌸\n\n` +
                     `🎵 𝐓𝐢𝐭𝐥𝐞: ${songTitle}\n` +
                     `🎤 𝐀𝐫𝐭𝐢𝐬𝐭: ${artistName}\n\n` +
                     `───────────────────\n` +
                     `${songLyrics}\n` +
                     `───────────────────\n\n` +
                     signature;

      return message.reply(output);

    } catch (err) {
      console.error("Lyrics Command Error:", err?.response?.data || err.message);
      return message.reply("❌ লিরিক্স ফেচ করতে সমস্যা হয়েছে, একটু পর আবার চেষ্টা করো!");
    }
  }
};
      
