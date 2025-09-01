import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  balance: { type: Number, default: 0 },
  referrals: { type: Number, default: 0 },
  referredBy: { type: String, default: null },
  history: { type: [String], default: [] }
});

export default mongoose.model("User", userSchema);
