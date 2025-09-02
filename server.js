import express from "express";
import { Telegraf, Markup } from "telegraf";
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// MongoDB connect
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

// Helper: Create or get user + referral bonus
async function findOrCreateUser(userId, referredBy = null) {
  let user = await User.findOne({ userId });
  if (!user) {
    user = new User({ userId, balance: 1, referredBy });
    await user.save();

    // Log new user
    await bot.telegram.sendMessage(
      process.env.LOG_CHANNEL_ID,
      `🆕 New User Joined:\nName/ID: ${userId}\nReferred By: ${referredBy || "None"}\nBalance: $1`
    );

    if (referredBy && referredBy !== userId) {
      let refUser = await User.findOne({ userId: referredBy });
      if (refUser) {
        refUser.balance += 0.1;
        refUser.referrals += 1;
        refUser.history.push(`+0.1$ from referral ${userId}`);
        await refUser.save();

        // Log referral bonus
        await bot.telegram.sendMessage(
          process.env.LOG_CHANNEL_ID,
          `💰 Referral Bonus:\nUser: ${refUser.userId}\nReferred New User: ${userId}\nAmount: $0.1`
        );
      }
    }
  }
  return user;
}

// /start command
bot.start(async (ctx) => {
  const userId = String(ctx.from.id);
  const args = ctx.message.text.split(" ");
  const referredBy = args[1] || null;

  await findOrCreateUser(userId, referredBy);

  ctx.reply(
    `👋 Welcome ${ctx.from.first_name}!\n🎁 You got $1 signup bonus!\nStart playing now 👇`,
    Markup.inlineKeyboard([
      // Web App button (Telegram in-app browser)
      [Markup.button.webApp("▶️ Play", { url: process.env.WEBSITE_URL })]
    ])
  );
});

// /refer command
bot.command("refer", async (ctx) => {
  const userId = String(ctx.from.id);
  await findOrCreateUser(userId);

  const link = `https://t.me/${ctx.botInfo.username}?start=${userId}`;
  ctx.reply(`🔗 Your referral link:\n${link}\nShare & earn $0.1 per friend!`);
});

// /balance command
bot.command("balance", async (ctx) => {
  const userId = String(ctx.from.id);
  const user = await findOrCreateUser(userId);

  ctx.reply(
    `💰 Balance: $${user.balance.toFixed(2)}\n👥 Referrals: ${user.referrals}`,
    Markup.inlineKeyboard([
      [Markup.button.callback("💸 Withdraw", "withdraw")]
    ])
  );
});

// Withdraw button
bot.action("withdraw", async (ctx) => {
  const userId = String(ctx.from.id);
  const user = await findOrCreateUser(userId);

  if (user.balance >= 1) {
    const code = Math.random().toString(36).slice(2, 22); // 20-char random code
    user.balance -= 1;
    user.history.push(`-1$ Withdraw → Code: ${code}`);
    await user.save();

    ctx.reply(`✅ Withdrawal successful!\n🔑 Your code:\n${code}`);

    // Log withdraw to channel
    await bot.telegram.sendMessage(
      process.env.LOG_CHANNEL_ID,
      `💸 Withdraw:\nUser: ${ctx.from.first_name}\nID: ${userId}\nCode: ${code}`
    );
  } else {
    ctx.reply("❌ Minimum $1 required to withdraw!");
  }
});

// /history command
bot.command("history", async (ctx) => {
  const userId = String(ctx.from.id);
  const user = await findOrCreateUser(userId);

  ctx.reply(
    user.history.length ? `📜 History:\n${user.history.join("\n")}` : "📜 No history yet."
  );
});

// Keepalive for Render
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(10000, () => console.log("Server running on port 10000"));

// Launch bot
bot.launch();
