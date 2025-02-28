import Jwt from "jsonwebtoken";
import { catchAsyncError } from "../../middleWare/catchAsyncError.js";
import { userModel } from "../../../dataBase/models/user.model.js";
import { AppError } from "../../utilities/AppError.js";
import bcrypt from "bcrypt";
import sendEmail from "../../utilities/sendEmail.js";

export const signup = catchAsyncError(async (req, res, next) => {
  let isFound = await userModel.findOne({ email: req.body.email });
  if (isFound) return next(new AppError("email already exists", 409));
  let user = new userModel(req.body);
  await user.save();
  res.json({ message: "success", user });
});

export const signin = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;
  let isFound = await userModel.findOne({ email });
  const match = await bcrypt.compare(password, isFound.password);
  if (isFound && match) {
    let token = Jwt.sign(
      { name: isFound.name, userId: isFound._id, role: isFound.role },
      "mynameisRoqaya",
      { expiresIn: "3d" }
    );
    return res.json({ message: "success", token });
  }
  next(new AppError("incorrect email or password", 401));
});

export const forgetPassword = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;
  const user = await userModel.findOne({ email });

  if (!user) {
    return next(new AppError("Invalid email", 401));
  }

  let token = Jwt.sign(
    { name: user.name, userId: user._id, role: user.role },
    "mynameisRoqaya"
  );

  const resetLink = `http://localhost:3000/api/v1/users/resetpassword/${token}`;
  const message = `<a href="${resetLink}">Click to reset password</a>`;

  const emailIsSent = await sendEmail({
    to: email,
    message,
    subject: "Reset Your Password",
  });

  if (!emailIsSent) {
    return next(new AppError("Sending email failed", 500));
  }

  res.json({ message: "Please check Link your email" });
});

export const allowedTo = (...roles) => {
  return catchAsyncError(async (req, res, next) => {
    if (!roles.includes(req.user.role))
      return next(
        new AppError(
          "you are not autorized to access this route" + req.user.role,
          401
        )
      );
    next();
  });
};

export const resetPasword = catchAsyncError(async (req, res, next) => {
  let { token } = req.headers;
  const { newpassword } = req.body;
  if (!token) return next(new AppError("Token not provided", 401));
  let decoded = Jwt.verify(token, "mynameisRoqaya");
  if (!decoded?._id) {
    return next(new AppError("Token decodin fail", 400));
  }
  const hashpassword = bcrypt.hashSync(newpassword, 7);
  const user = await userModel.findOneAndUpdate({
    _id: decoded._id,
    password: hashpassword,
  });
  if (!user) {
    return next(new AppError("fail to reset", 400));
  }
  res.status(200).json({ message: "done" });
});
export const protectRoutes = catchAsyncError(async (req, res, next) => {
  let { token } = req.headers;

  if (!token) return next(new AppError("Token not provided", 401));
  let decoded = Jwt.verify(token, "mynameisRoqaya");

  let user = await userModel.findById(decoded.userId);
  if (!user) return next(new AppError("User not found"));
  if (user.passwordChangedAt) {
    let changePasswordDate = parseInt(user.passwordChangedAt.getTime() / 1000);
    if (changePasswordDate > decoded.iat)
      return next(new AppError("Password changed", 404));
  }
  req.user = user;
  next();
});
