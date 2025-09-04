// index.js
import { Telegraf } from "telegraf";
import { exec } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const API_ID = process.env.API_ID;
const API_HASH = process.env.API_HASH;

// /start command
bot.start((ctx) => {
  ctx.reply("👋 Welcome! Please send me your phone number (e.g. +1234567890).");
});

// Handle phone number input
bot.on("text", (ctx) => {
  const phone = ctx.message.text.trim();

  if (!phone.startsWith("+") || phone.length < 10) {
    return ctx.reply("❌ Invalid phone number. Please send like +1234567890.");
  }

  ctx.reply("⏳ Generating session, please wait...");

  // Run session.py with args
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

// Launch bot in polling mode
bot.launch();
console.log("🚀 Bot is running on Render (polling mode)...");
