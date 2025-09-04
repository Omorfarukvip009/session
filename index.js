// index.js
import { Telegraf } from "telegraf";
import { exec } from "child_process";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const API_ID = process.env.API_ID;
const API_HASH = process.env.API_HASH;

// ================== BOT HANDLER ==================
bot.start((ctx) => {
  ctx.reply("👋 Welcome! Please send me your phone number (e.g. +1234567890).");
});

bot.on("text", (ctx) => {
  const phone = ctx.message.text.trim();

  if (!phone.startsWith("+") || phone.length < 10) {
    return ctx.reply("❌ Invalid phone number. Please send like +1234567890.");
  }

  ctx.reply("⏳ Generating session, please wait...");

  const command = `python3 session.py ${API_ID} ${API_HASH} ${phone}`;
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error("Exec error:", error);
      return ctx.reply("❌ Failed to generate session.");
    }

    const match = stdout.match(/STRING SESSION: (.+)/);
    if (match && match[1]) {
      ctx.reply(`✅ Your session:\n\n\`${match[1]}\``, { parse_mode: "Markdown" });
    } else {
      ctx.reply("❌ Could not extract session. Check logs.");
    }
  });
});

bot.launch();
console.log("🚀 Bot is running...");

// ================== EXPRESS SERVER ==================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("<h1>🤖 Telegram Bot Status</h1><p>✅ Bot is running!</p>");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running at http://localhost:${PORT}`);
});
