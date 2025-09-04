// index.js
import { Telegraf } from "telegraf";
import { exec } from "child_process";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Handle /start
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

  const command = `python3 session.py ${process.env.API_ID} ${process.env.API_HASH} ${phone}`;
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

// Export webhook handler for Vercel
export default async function handler(req, res) {
  await bot.handleUpdate(req.body, res);
  res.status(200).send("ok");
}
