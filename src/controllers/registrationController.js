import User from "../models/User.js";
import Registration from "../models/Registration.js";
import Program from "../models/Program.js";

export const registerStudent = async (req,res)=>{

  const {name,email,phone,programId} = req.body;

  let student = await User.findOne({email});

  if(!student){

    student = await User.create({
      name,
      email,
      phone
    });

  }

  const registration = await Registration.create({

    studentId: student._id,

    referrerId: req.user.id,

    programId

  });

  res.json(registration);

};