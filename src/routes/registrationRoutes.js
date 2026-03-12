import express from "express";
import { registerStudent } from "../controllers/registrationController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/",protect,registerStudent);

export default router;