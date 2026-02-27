const express = require("express");
const { run, get } = require("../data/db");
const { createId, nowIso, isExpired, sanitizeContact } = require("../utils/helpers");
const { isValidEmail, isValidPhone } = require("../utils/validators");

const router = express.Router();

async function findUserByEmailOrPhone(email, phone) {
  const cleanEmail = email ? sanitizeContact(email) : null;
  const cleanPhone = phone ? sanitizeContact(phone) : null;
  if (cleanEmail && cleanPhone) {
    return get(`SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1`, [cleanEmail, cleanPhone]);
  }
  if (cleanEmail) {
    return get(`SELECT id FROM users WHERE email = ? LIMIT 1`, [cleanEmail]);
  }
  return get(`SELECT id FROM users WHERE phone = ? LIMIT 1`, [cleanPhone]);
}

router.post("/signup", async (req, res) => {
  const { fullName, email, phone, referralCode } = req.body;

  if (!fullName || (!email && !phone)) {
    return res.status(400).json({
      success: false,
      message: "fullName and either email or phone are required."
    });
  }

  if (email && !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format."
    });
  }

  if (phone && !isValidPhone(phone)) {
    return res.status(400).json({
      success: false,
      message: "Invalid phone format. Use 10-15 digits, optional + prefix."
    });
  }

  try {
    const duplicate = await findUserByEmailOrPhone(email, phone);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Duplicate email or phone. User already exists."
      });
    }

    let referralResult = { accepted: false, reason: null };
    if (referralCode) {
      const ref = await get(
        `SELECT code, is_active AS isActive, expires_at AS expiresAt
         FROM referrals
         WHERE code = ? COLLATE NOCASE
         LIMIT 1`,
        [String(referralCode)]
      );
      if (!ref || !ref.isActive || isExpired(ref.expiresAt)) {
        referralResult = { accepted: false, reason: "Invalid or expired referral code." };
      } else {
        referralResult = { accepted: true, reason: null };
      }
    }

    const userId = createId("user");
    const cleanEmail = email ? sanitizeContact(email) : null;
    const cleanPhone = phone ? sanitizeContact(phone) : null;
    const createdAt = nowIso();
    const updatedAt = nowIso();
    await run(
      `INSERT INTO users (id, full_name, email, phone, role, is_verified, referral_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        String(fullName).trim(),
        cleanEmail,
        cleanPhone,
        "customer",
        0,
        referralCode || null,
        createdAt,
        updatedAt
      ]
    );

    const otpCode = "123456";
    const verificationSessionId = createId("verify");
    await run(
      `INSERT INTO verification_sessions
       (id, user_id, contact, otp_code, attempts_remaining, expires_at, verified, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        verificationSessionId,
        userId,
        cleanEmail || cleanPhone,
        otpCode,
        3,
        new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        0,
        nowIso()
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Signup successful. Verify account with OTP.",
      data: {
        userId,
        isVerified: false,
        verificationSessionId,
        otpHint: "Use 123456 for simulation only.",
        referralResult
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Signup failed.",
      error: error.message
    });
  }
});

router.post("/verify", async (req, res) => {
  const { userId, otp } = req.body;
  if (!userId || !otp) {
    return res.status(400).json({
      success: false,
      message: "userId and otp are required."
    });
  }

  try {
    const user = await get(`SELECT id FROM users WHERE id = ? LIMIT 1`, [userId]);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Signup may have been abandoned."
      });
    }

    const latestSession = await get(
      `SELECT id, otp_code AS otpCode, attempts_remaining AS attemptsRemaining, expires_at AS expiresAt
       FROM verification_sessions
       WHERE user_id = ? AND verified = 0
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (!latestSession) {
      return res.status(400).json({
        success: false,
        message: "No active verification session for this user."
      });
    }

    if (isExpired(latestSession.expiresAt)) {
      return res.status(410).json({
        success: false,
        message: "OTP is expired. Please request a new verification code."
      });
    }

    if (latestSession.attemptsRemaining <= 0) {
      return res.status(429).json({
        success: false,
        message: "Maximum OTP attempts reached."
      });
    }

    if (String(otp) !== latestSession.otpCode) {
      const remaining = latestSession.attemptsRemaining - 1;
      await run(`UPDATE verification_sessions SET attempts_remaining = ? WHERE id = ?`, [
        remaining,
        latestSession.id
      ]);
      return res.status(400).json({
        success: false,
        message: "Invalid OTP.",
        attemptsRemaining: remaining
      });
    }

    await run(`UPDATE verification_sessions SET verified = 1 WHERE id = ?`, [latestSession.id]);
    await run(`UPDATE users SET is_verified = 1, updated_at = ? WHERE id = ?`, [nowIso(), userId]);

    return res.status(200).json({
      success: true,
      message: "Account verified successfully.",
      data: {
        userId: user.id,
        isVerified: true
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Verification failed.",
      error: error.message
    });
  }
});

module.exports = router;
