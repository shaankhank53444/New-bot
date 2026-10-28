const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports = {
  config: {
    name: "raw",
    version: "2.4",
    role: 0,
    author: "𝔐𝔯.𝔎𝔦𝔫𝔤",
    description: "Generate a unique RAW text link publicly with random number IDs",
    category: "convert",
    guide: { 
      en: "{pn} → Reply to a code snippet to create RAW Link\n{pn} [filename] → Create raw from cmds folder\n{pn} -e [filename] → Create raw from events folder"
    },
    countDown: 1
  },

  onStart: async function ({ api, event, args }) {
    let fileName = "";
    let code = "";

    try {
      if (event.type === "message_reply" && event.messageReply?.body) {
        code = event.messageReply.body;
        fileName = args[0] ? (args[0].endsWith(".js") || args[0].endsWith(".txt") ? args[0] : `${args[0]}.js`) : `raw_${Date.now()}.js`;
      } 
      else if (args.length > 0) {
        let filePath;

        if (args[0] === "-e") {
          const eventFile = args[1];
          if (!eventFile) {
            return api.sendMessage("⚠ | Please provide a filename after -e.", event.threadID, event.messageID);
          }
          fileName = eventFile.endsWith(".js") ? eventFile : `${eventFile}.js`;
          filePath = path.resolve(__dirname, '../../scripts/events', fileName);
        } else {
          fileName = args[0].endsWith(".js") ? args[0] : `${args[0]}.js`;
          filePath = path.resolve(__dirname, '../../scripts/cmds', fileName);
        }

        if (!fs.existsSync(filePath)) {
          return api.sendMessage(`❌ File "${fileName}" not found in the directory!`, event.threadID, event.messageID);
        }
        code = await fs.promises.readFile(filePath, "utf-8");
      } 
      else {
        return api.sendMessage("⚠ | Please reply with code OR provide a file name.", event.threadID, event.messageID);
      }

      const baseUrl = "https://aliya-official-v4.vercel.app";
      
      const response = await axios.post(`${baseUrl}/api/raw/save`, {
        title: fileName,
        code: code
      }, { timeout: 15000 });

      if (!response.data || !response.data.success) {
        return api.sendMessage("⚠️ Server refused to save the file.", event.threadID, event.messageID);
      }

      const fileId = response.data.fileId;
      const rawLink = `${baseUrl}/raw/${fileId}`;
      const signature = `╭───────────────⬣\n│ 𝐌𝐚𝐝𝐞 𝐰𝐢𝐭𝐡 🤍 𝐛𝐲 --𝔐𝔯.𝔎𝔦𝔫𝔤\n╰───────────────⬣`;

      const rawMsg = `✅ HERE IS YOUR RAW LINK 🌸\n\n📌 𝐅𝐢𝐥𝐞: ${fileName}\n🔗 ${rawLink}\n\n${signature}`;
      return api.sendMessage(rawMsg, event.threadID, event.messageID);

    } catch (err) {
      console.error("❌ RAW Error Details:", err?.response?.data || err.message);
      return api.sendMessage(`⚠️ Failed to create RAW link.\nError: ${err.message}`, event.threadID, event.messageID);
    }
  }
};
        
