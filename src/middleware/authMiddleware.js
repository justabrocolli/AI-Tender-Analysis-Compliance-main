import jwt from "jsonwebtoken";
import User from "../models/User.js";
import logger from "../utils/logger.js";

export const protect = async (req, res, next) => {
  let token;

  // 1. Read the token from the HTTP-Only cookie
  token = req.cookies.jwt;

  if (token) {
    try {
      // 2. Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Get user from the token ID (exclude password)
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        logger.warn(`⚠️ [Auth] Token valid, but user ID ${decoded.id} not found in DB.`);
         return res.status(401).json({ message: "Not authorized, user not found" });
      }

      // logger.info(`🔓 [Auth] User verified: ${req.user.email}`); // Optional: Can be noisy

      next(); // Proceed to the route
    } catch (error) {
      logger.error(`❌ [Auth] Token verification failed: ${error.message}`);
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    // logger.warn("⚠️ [Auth] No token provided in cookies."); // Optional: noisy for public routes
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

export const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    logger.warn(`⛔ [Auth] Access denied. User ${req.user.email} attempted Admin action.`);
    res.status(403).json({ message: "Not authorized as an admin" });
  }
};