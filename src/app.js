import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import registrationRoutes from "./routes/registrationRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";

const app = express();

app.use(cors());

app.use(express.json());

app.get("/health",(req,res)=>{
  res.json({status:"OK"});
});

app.use("/api/auth",authRoutes);
app.use("/api/registrations",registrationRoutes);
app.use("/api/wallet",walletRoutes);

export default app;