module.exports = {
  config: {
    name: "tag",
    aliases: ["mention"],
    version: "1.0.0",
    author: "𝔐𝔯.𝔎𝔦𝔫𝔤",
    countDown: 3,
    role: 0,
    shortDescription: "Tag a user with custom message by replying to them",
    category: "utility",
    guide: { en: "{p}tag <message> (by replying to someone)" }
  },

  onStart: async function ({ message, event, args, usersData, api }) {
    try {
      // Check if the user replied to someone
      if (!event.messageReply || !event.messageReply.senderID) {
        return message.reply("⚠️ Kono user-er message-e reply diye tag command use koro!\nJemon: `tag Hello Aliya 🐇🌸`");
      }

      const targetUserID = event.messageReply.senderID;
      const customText = args.join(" ");

      if (!customText) {
        return message.reply("⚠️ Sathi ke ki message dite chao seta lekho!\nJemon: `tag Hello Aliya 🐇🌸`");
      }

      if (api && typeof api.setMessageReaction === "function") {
        api.setMessageReaction("⌛️", event.messageID, () => {}, true);
      }

      // Fetch sender's name (who executed the command)
      const senderName = await usersData.getName(event.senderID) || "Someone";
      // Fetch target user's name (who is being tagged)
      const targetName = await usersData.getName(targetUserID) || "User";

      const signature = `╭───────────────⬣\n│ 𝐌𝐚𝐝𝐞 𝐰𝐢𝐭𝐡 🤍 𝐛𝐲 --𝔐𝔯.𝔎𝔦𝔫𝔤\n╰───────────────⬣`;
      
      const body = `@${targetName} ${customText} 🐇🌸\n\n- From: ${senderName}\n\n${signature}`;

      if (api && typeof api.setMessageReaction === "function") {
        api.setMessageReaction("✅️", event.messageID, () => {}, true);
      }

      return message.reply({
        body: body,
        mentions: [{ tag: targetName, id: targetUserID }]
      });

    } catch (err) {
      if (api && typeof api.setMessageReaction === "function") {
        api.setMessageReaction("❌️", event.messageID, () => {}, true);
      }
      return message.reply("❌ Failed to tag user, please try again!");
    }
  }
};
          
