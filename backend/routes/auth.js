const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');
const config = require('../config/validateEnv');
const logger = require('../config/logger');
const crypto = require('crypto');
const { sendEmail } = require('../config/mailer');

const router = express.Router();

/**
 * Generate a short-lived access token (15 min) and a long-lived refresh token (7 days).
 */
function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, config.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

// ── POST /register ───────────────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      email,
      password: hashedPassword
    });

    await user.save();
    logger.info('New user registered', { email: user.email });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    res.status(201).json({
      user: {
        id: user._id,
        email: user.email
      },
      token: accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /login ──────────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    logger.info('User logged in', { email: user.email });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    res.json({
      user: {
        id: user._id,
        email: user.email
      },
      token: accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /refresh — Exchange a valid refresh token for a new access token ────
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    // Ensure user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    // Issue new access token (refresh token stays the same until it expires)
    const accessToken = jwt.sign({ userId: user._id }, config.JWT_SECRET, { expiresIn: '15m' });

    logger.debug('Access token refreshed', { userId: user._id });

    res.json({ token: accessToken });
  } catch (error) {
    next(error);
  }
});

// ── GET /me — Get current user ───────────────────────────────────────────────
router.get('/me', auth, async (req, res, next) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        email: req.user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /forgot-password — Request password reset link ──────────────────────
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    // Always return 200/success to prevent user enumeration
    const successResponse = {
      message: 'If a matching account exists, a password reset link has been sent.',
    };

    if (!user) {
      logger.info('Password reset requested for non-existent user email', { email });
      return res.json(successResponse);
    }

    // Generate random token and expiry (1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = Date.now() + 3600000; // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetExpires;
    await user.save();

    const resetLink = `${config.CORS_ORIGIN}/auth?mode=reset&token=${resetToken}`;

    const mailText = `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
      `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
      `${resetLink}\n\n` +
      `If you did not request this, please ignore this email and your password will remain unchanged.\n`;

    const mailHtml = `<div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color: #4f46e5; margin-bottom: 20px;">Password Reset Request</h2>
      <p>You are receiving this because you (or someone else) requested a password reset for your DocuSearch OCR account.</p>
      <p>To reset your password, please click the button below:</p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all;"><a href="${resetLink}" style="color: #4f46e5;">${resetLink}</a></p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 12px; color: #6b7280;">If you did not request this email, you can safely ignore it. The link will expire in 1 hour.</p>
    </div>`;

    await sendEmail({
      to: user.email,
      subject: 'DocuSearch OCR - Password Reset',
      text: mailText,
      html: mailHtml,
    });

    res.json(successResponse);
  } catch (error) {
    next(error);
  }
});

// ── POST /reset-password — Reset password using token ───────────────────────
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    // Find user with matching, non-expired token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save user & clean up reset token fields
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    logger.info('Password successfully reset', { email: user.email });

    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
