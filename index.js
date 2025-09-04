import { Telegraf } from "telegraf";
import { exec } from "child_process";
import fs from "fs";
import fse from "fs-extra";
import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const API_ID = process.env.API_ID;
const API_HASH = process.env.API_HASH;
const SESSIONS_DIR = "./sessions";

fse.ensureDirSync(SESSIONS_DIR);

const userState = {};

// /start
bot.start((ctx) => {
  ctx.reply("👋 Welcome!\n/session → Generate new session\n/login → Upload session to login");
});

// /login
bot.command("login", (ctx) => {
  userState[ctx.chat.id] = { waitingForSession: true };
  ctx.reply("📂 Please upload your `.session` file.");
});

// Handle uploaded session
bot.on("document", async (ctx) => {
  const fileName = ctx.message.document.file_name;
  if (!fileName.endsWith(".session")) return ctx.reply("❌ Please upload a valid .session file.");

  const filePath = `${SESSIONS_DIR}/${fileName}`;
  const link = await ctx.telegram.getFileLink(ctx.message.document.file_id);
  const res = await fetch(link.href);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  ctx.reply("⏳ Logging in using session...");
  exec(`API_ID=${API_ID} API_HASH=${API_HASH} python3 login.py ${filePath}`, (err, stdout) => {
    if (err) return ctx.reply("❌ Login failed.");
    ctx.reply(`✅ Login result:\n${stdout}`);
  });

  userState[ctx.chat.id] = {};
});

// /session
bot.command("session", (ctx) => {
  userState[ctx.chat.id] = { step: "phone" };
  ctx.reply("📱 Send your phone number (format: +123...)");
});

// Handle messages for `/session` flow
bot.on("text", (ctx) => {
  const userId = ctx.chat.id;
  const msg = ctx.message.text.trim();
  const state = userState[userId];

  if (!state) return;

  // Phone number step
  if (state.step === "phone") {
    if (!msg.startsWith("+") || msg.length < 10) return ctx.reply("❌ Invalid phone number.");
    ctx.reply("⏳ Sending OTP...");
    exec(`python3 session.py ${API_ID} ${API_HASH} ${msg} request`, (err, stdout) => {
      if (err || !stdout.includes("CODE_REQUESTED")) return ctx.reply("❌ Failed to send OTP.");
      ctx.reply("✅ OTP sent! Reply with the code you received.");
      userState[userId] = { step: "otp", phone: msg };
    });
    return;
  }

  // OTP step
  if (state.step === "otp") {
    const phone = state.phone;
    const otp = msg;
    exec(`python3 session.py ${API_ID} ${API_HASH} ${phone} otp=${otp}`, (err, stdout) => {
      if (err) return ctx.reply("❌ OTP verification failed.");

      if (stdout.includes("NEED_2FA")) {
        userState[userId] = { step: "password", phone, otp };
        return ctx.reply("🔒 2FA enabled. Please send your password:");
      }

      handleSessionResult(ctx, phone, stdout);
      userState[userId] = {};
    });
    return;
  }

  // Password step
  if (state.step === "password") {
    const { phone, otp } = state;
    const password = msg;
    exec(`python3 session.py ${API_ID} ${API_HASH} ${phone} otp=${otp} password=${password}`, (err, stdout) => {
      if (err) return ctx.reply("❌ Password verification failed.");
      handleSessionResult(ctx, phone, stdout);
      userState[userId] = {};
    });
    return;
  }
});

// Helper
function handleSessionResult(ctx, phone, stdout) {
  if (stdout.includes("SESSION_FILE")) {
    ctx.reply("✅ Session generated!");
    const filePath = `sessions/${phone}.session`;
    if (fs.existsSync(filePath)) ctx.replyWithDocument({ source: filePath, filename: `${phone}.session` });
    const match = stdout.match(/STRING_SESSION=(.+)/);
    if (match) ctx.reply(`🔑 String session:\n\`${match[1]}\``, { parse_mode: "Markdown" });
  } else {
    ctx.reply("❌ Failed to generate session.");
  }
}

// EXPRESS / WEBHOOK
const app = express();
const PORT = process.env.PORT || 3000;
if (process.env.MODE === "polling") {
  bot.launch();
  app.get("/", (req, res) => res.send("<h1>🤖 Bot running (polling)</h1>"));
  app.listen(PORT, () => console.log(`🌐 Status page on port ${PORT}`));
} else {
  const webhookPath = `/telegraf/${bot.secretPathComponent()}`;
  const webhookUrl = `${process.env.WEBHOOK_URL}${webhookPath}`;
  app.use(bot.webhookCallback(webhookPath));
  app.get("/", (req, res) => res.send("<h1>🤖 Telegram Bot (Webhook)</h1>"));
  app.listen(PORT, async () => {
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`✅ Webhook set to ${webhookUrl}`);
  });
}

console.log("🚀 Bot started...");
        
