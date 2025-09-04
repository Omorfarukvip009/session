// index.js
import { Telegraf } from "telegraf";
import { exec } from "child_process";
import fs from "fs";
import fse from "fs-extra";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const API_ID = process.env.API_ID;
const API_HASH = process.env.API_HASH;
const SESSIONS_DIR = "./sessions";

fse.ensureDirSync(SESSIONS_DIR);

// =============== BOT COMMANDS =================

// Start
bot.start((ctx) => {
  ctx.reply("👋 Welcome! Use:\n/session → Generate new session\n/login → Upload session to login");
});

// Generate session
bot.command("session", (ctx) => {
  ctx.reply("📲 Send your phone number (format: +123...)");
  bot.on("text", async (ctx2) => {
    const phone = ctx2.message.text.trim();
    if (!phone.startsWith("+")) return ctx2.reply("❌ Invalid phone number.");

    ctx2.reply("⏳ Sending OTP...");
    exec(`python3 session.py ${API_ID} ${API_HASH} ${phone} request`, (err, stdout) => {
      if (err || !stdout.includes("CODE_REQUESTED")) {
        return ctx2.reply("❌ Failed to send OTP.");
      }
      ctx2.reply("✅ OTP sent! Reply with the code you received.");
    });
  });
});

// Upload session & login
bot.command("login", (ctx) => {
  ctx.reply("📤 Please upload your `.session` file.");
});

bot.on("document", async (ctx) => {
  const fileName = ctx.message.document.file_name;
  if (!fileName.endsWith(".session")) {
    return ctx.reply("❌ Please upload a valid `.session` file.");
  }

  const filePath = `${SESSIONS_DIR}/${fileName}`;
  const link = await ctx.telegram.getFileLink(ctx.message.document.file_id);

  const res = await fetch(link.href);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  ctx.reply("⏳ Logging in using session...");
  exec(`python3 login.py ${filePath}`, (err, stdout) => {
    if (err) return ctx.reply("❌ Login failed.");
    ctx.reply(`✅ Login successful:\n${stdout}`);
  });
});

// =============== EXPRESS SERVER =================

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.MODE === "webhook") {
  app.use(await bot.createWebhook({ domain: process.env.WEBHOOK_URL }));
  app.listen(PORT, () => console.log(`🌐 Webhook running on port ${PORT}`));
} else {
  bot.launch();
  app.get("/", (req, res) => res.send("<h1>🤖 Bot is running (polling mode)</h1>"));
  app.listen(PORT, () => console.log(`🌐 Status page on port ${PORT}`));
}

console.log("🚀 Bot started...");
