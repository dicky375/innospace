import mongoose from "mongoose";

const programSchema = new mongoose.Schema({

  title: String,

  price: Number,

  commissionPercent: {
    type: Number,
    default: 5
  }

});

export default mongoose.model("Program", programSchema);