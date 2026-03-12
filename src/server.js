import dotenv from "dotenv";
import app from "./app.js";
import jwt from "jsonwebtoken";
import { connectDB } from "./config/db.js";

dotenv.config();

connectDB();

const PORT = process.env.PORT || 5000;
const token = jwt.sign({ id: "123" }, process.env.JWT_SECRET);

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});