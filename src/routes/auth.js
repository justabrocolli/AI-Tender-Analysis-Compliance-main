import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";
import logger from "../utils/logger.js";

const router = express.Router();

// Helper: Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// Helper: Set Cookie
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);

  const options = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true, // Prevent client-side JS from accessing token
    secure: process.env.NODE_ENV === "production", // Use HTTPS in production
    sameSite: "strict", // CSRF protection
  };

  res.status(statusCode)
    .cookie("jwt", token, options) // <--- Set the cookie
    .json({
      _id: user._id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.role,
      // No token here! It's in the cookie.
    });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 */
router.post("/register", async (req, res) => {
  try {
    const { first_name, last_name, email, password, phone, role } = req.body;
    logger.info(`👤 [Auth] Registration attempt for: ${email}`);

    const userExists = await User.findOne({ email });
    if (userExists) {
      logger.warn(`⚠️ [Auth] Registration failed: ${email} already exists.`);
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      first_name,
      last_name,
      email,
      password,
      phone,
      role,
    });

    if (user) {
      logger.info(`✅ [Auth] New user registered: ${email} (${role})`);
      sendTokenResponse(user, 201, res);
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (err) {
    logger.error(`❌ [Auth] Registration Error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
});

/**
 * @desc    Login user & get token
 * @route   POST /api/auth/login
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      logger.info(`🔓 [Auth] Login successful: ${email}`);
      sendTokenResponse(user, 200, res);
    } else {
      logger.warn(`⛔ [Auth] Failed login attempt for: ${email}`);
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (err) {
    logger.error(`❌ [Auth] Login Error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
});

/**
 * @desc    Get current user profile (Session Check)
 * @route   GET /api/auth/profile
 * @access  Private
 */
router.get("/profile", protect, async (req, res) => {
  try {
    // req.user is already set by the 'protect' middleware via the cookie
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        phone: user.phone,
        role: user.role,
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    logger.error(`❌ [Auth] Profile Fetch Error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
});

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private (Requires Cookie)
 */
router.put("/profile", protect, async (req, res) => {
  try {
    // req.user is set by the 'protect' middleware
    const user = await User.findById(req.user._id);

    if (user) {
      // Update fields if they exist in the body, otherwise keep current
      user.first_name = req.body.first_name || user.first_name;
      user.last_name = req.body.last_name || user.last_name;
      user.email = req.body.email || user.email;
      user.phone = req.body.phone || user.phone;
      
      // Handle Notification Preferences (Merge with existing)
      if (req.body.notification_preferences) {
        user.notification_preferences = {
          ...user.notification_preferences, // keep existing
          ...req.body.notification_preferences // overwrite new
        };
      }

      // Handle Password (only if provided)
      if (req.body.password) {
        // The User.js pre('save') hook will automatically hash this!
        user.password = req.body.password;
        logger.info(`🔐 [Auth] Password changed for user: ${user.email}`);
      }

      const updatedUser = await user.save();
      logger.info(`✏️ [Auth] Profile updated: ${user.email}`);

      res.json({
        _id: updatedUser._id,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        notification_preferences: updatedUser.notification_preferences
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    logger.error(`❌ [Auth] Update Error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
});

/**
 * @desc    Logout user / clear cookie
 * @route   POST /api/auth/logout
 */
router.post("/logout", (req, res) => {
  logger.info(`👋 [Auth] User logged out.`);
  // Clear the cookie by setting it to a past date
  res.cookie("jwt", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  
  res.status(200).json({ message: "Logged out successfully" });
});

export default router;