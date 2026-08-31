const rateLimit = require("express-rate-limit");

// Member PINs are only 4 digits (10,000 combinations) — without a strict
// limit here, a bot could guess a member's PIN in minutes. This allows
// only 8 attempts per 15 minutes per IP address for member login.
const memberLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { success: false, message: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin passwords are stronger, but still worth slowing down repeated
// guesses. A bit more generous than the member limiter.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { success: false, message: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Registering a new admin account should be rare — a low limit here makes
// it impractical to mass-create accounts even if someone has the
// registration secret.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many registration attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// A locked-out member's PIN-reset request is public (no token), so it
// needs the same kind of protection as the login endpoints — otherwise
// someone could hammer it to enumerate phone numbers in a committee.
const pinResetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: { success: false, message: "Too many requests. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { memberLoginLimiter, adminLoginLimiter, registerLimiter, pinResetRequestLimiter };
