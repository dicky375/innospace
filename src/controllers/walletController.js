import { getWalletBalance } from "../services/walletService.js";

export const getBalance = async (req,res)=>{

  const balance = await getWalletBalance(req.user.id);

  res.json({balance});

};