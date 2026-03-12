import mongoose from "mongoose";

const registrationSchema = new mongoose.Schema({

  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  referrerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  programId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Program"
  },

  paymentStatus: {
    type: String,
    default: "pending"
  }

}, { timestamps: true });

export default mongoose.model("Registration", registrationSchema);