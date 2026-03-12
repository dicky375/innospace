import express from "express";
import { getBalance } from "../controllers/walletController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/balance",protect,getBalance);

export default router;