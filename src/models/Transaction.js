import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  type: {
    type: String,
    enum: ["payment", "commission", "withdrawal"]
  },
  amount: Number,
  reference: String,
  status: String
}, { timestamps: true });

export default mongoose.model("Transaction", transactionSchema);