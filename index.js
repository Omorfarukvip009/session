import { Telegraf } from "telegraf";
import { exec } from "child_process";
import fs from "fs";
import fse from "fs-extra";
import fetch from "node-fetch";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const API_ID = process.env.API_ID;
const API_HASH = process.env.API_HASH;
const SESSIONS_DIR = "./sessions";
fse.ensureDirSync(SESSIONS_DIR);

const userState = {};

// ========== /start ==========
bot.start((ctx) => {
  ctx.reply(
    "👋 Welcome!\n/session → Generate new session\n/login → Upload session to login"
  );
});

// ========== /login ==========
bot.command("login", (ctx) => {
  userState[ctx.chat.id] = { waitingForSession: true };
  ctx.reply("📂 Please upload your `.session` file.");
});

bot.on("document", async (ctx) => {
  const fileName = ctx.message.document.file_name;
  if (!fileName.endsWith(".session"))
    return ctx.reply("❌ Please upload a valid .session file.");

  const filePath = `${SESSIONS_DIR}/${fileName}`;
  const link = await ctx.telegram.getFileLink(ctx.message.document.file_id);
  const res = await fetch(link.href);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  ctx.reply("⏳ Logging in using session...");
  exec(
    `API_ID=${API_ID} API_HASH=${API_HASH} python3 login.py ${filePath}`,
    { cwd: process.cwd() },
    (err, stdout, stderr) => {
      if (err) return ctx.reply(`❌ Login failed.\n${stderr || stdout}`);
      ctx.reply(`✅ Login result:\n${stdout}`);
    }
  );

  userState[ctx.chat.id] = {};
});

// ========== /session ==========
bot.command("session", (ctx) => {
  userState[ctx.chat.id] = { step: "phone" };
  ctx.reply("📱 Send your phone number (format: +123...)");
});

bot.on("text", (ctx) => {
  const userId = ctx.chat.id;
  const msg = ctx.message.text.trim();
  const state = userState[userId];
  if (!state) return;

  // Step 1: Phone
  if (state.step === "phone") {
    if (!msg.startsWith("+") || msg.length < 10)
      return ctx.reply("❌ Invalid phone number.");
    ctx.reply("⏳ Sending OTP...");

    exec(
      `python3 session.py ${API_ID} ${API_HASH} ${msg} request`,
      { cwd: process.cwd() },
      (err, stdout, stderr) => {
        console.log("stdout:", stdout);
        console.log("stderr:", stderr);

        if (err || !stdout.includes("CODE_REQUESTED"))
          return ctx.reply(
            `❌ Failed to send OTP.\nPython output:\n${stdout}\n${stderr}`
          );

        ctx.reply("✅ OTP sent! Reply with the code you received.");
        userState[userId] = { step: "otp", phone: msg };
      }
    );
    return;
  }

  // Step 2: OTP
  if (state.step === "otp") {
    const phone = state.phone;
    const otp = msg;

    exec(
      `python3 session.py ${API_ID} ${API_HASH} ${phone} otp=${otp}`,
      { cwd: process.cwd() },
      (err, stdout, stderr) => {
        console.log("stdout:", stdout);
        console.log("stderr:", stderr);

        if (err)
          return ctx.reply(`❌ OTP verification failed.\n${stderr || stdout}`);

        if (stdout.includes("NEED_2FA")) {
          userState[userId] = { step: "password", phone, otp };
          return ctx.reply("🔒 2FA enabled. Please send your password:");
        }

        handleSessionResult(ctx, phone, stdout);
        userState[userId] = {};
      }
    );
    return;
  }

  // Step 3: 2FA password
  if (state.step === "password") {
    const { phone, otp } = state;
    const password = msg;

    exec(
      `python3 session.py ${API_ID} ${API_HASH} ${phone} otp=${otp} password=${password}`,
      { cwd: process.cwd() },
      (err, stdout, stderr) => {
        console.log("stdout:", stdout);
        console.log("stderr:", stderr);

        if (err)
          return ctx.reply(
            `❌ Password verification failed.\n${stderr || stdout}`
          );

        handleSessionResult(ctx, phone, stdout);
        userState[userId] = {};
      }
    );
    return;
  }
});

// Helper
function handleSessionResult(ctx, phone, stdout) {
  if (stdout.includes("SESSION_FILE")) {
    ctx.reply("✅ Session generated!");
    const filePath = `sessions/${phone}.session`;
    if (fs.existsSync(filePath))
      ctx.replyWithDocument({ source: filePath, filename: `${phone}.session` });
    const match = stdout.match(/STRING_SESSION=(.+)/);
    if (match)
      ctx.reply(`🔑 String session:\n\`${match[1]}\``, { parse_mode: "Markdown" });
  } else {
    ctx.reply("❌ Failed to generate session.");
  }
}

// ========== EXPRESS STATUS PAGE ==========
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("<h1>🤖 Telegram Bot is running (polling mode)</h1>");
});

app.listen(PORT, () =>
  console.log(`🌐 Status page running at http://localhost:${PORT}`)
);

console.log("🚀 Bot started in polling mode");
        
