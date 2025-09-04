import { Telegraf } from "telegraf";
import { exec } from "child_process";
import fs from "fs";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const API_ID = process.env.API_ID;
const API_HASH = process.env.API_HASH;

const userState = {};

// /login command
bot.command("login", (ctx) => {
  userState[ctx.chat.id] = { waitingForSession: true };
  ctx.reply("📂 Please upload your `.session` file.");
});

// Handle uploaded document
bot.on("document", (ctx) => {
  const userId = ctx.chat.id;
  if (!userState[userId]?.waitingForSession) return;

  const file = ctx.message.document;
  if (!file.file_name.endsWith(".session")) {
    return ctx.reply("❌ Please upload a valid `.session` file.");
  }

  ctx.telegram.getFileLink(file.file_id).then((link) => {
    const filePath = `./${file.file_name}`;
    const stream = fs.createWriteStream(filePath);

    fetch(link.href).then((res) => {
      res.body.pipe(stream);
      res.body.on("end", () => {
        ctx.reply("⏳ Verifying session...");
        const command = `python3 login.py ${API_ID} ${API_HASH} ${filePath}`;

        exec(command, (error, stdout) => {
          if (error) {
            ctx.reply("❌ Login failed.");
          } else {
            ctx.reply(stdout || "✅ Done!");
          }
          userState[userId] = {};
        });
      });
    });
  });
});

// Existing logic from before stays here...

// ================= EXPRESS WEB STATUS =================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("<h1>🤖 Telegram Bot Status</h1><p>✅ Bot is running!</p>");
});

app.listen(PORT, () => {
  console.log(`🌐 Status page running at http://localhost:${PORT}`);
});

bot.launch();
console.log("🚀 Bot running...");
