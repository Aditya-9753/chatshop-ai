const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const { authenticator } = require("otplib");
const User = require("../models/User.model");

// Accept the code from the previous/next 30s step too (clock drift)
authenticator.options = { window: 1 };

const CHALLENGE_TTL = "5m";

/**
 * Two-factor login with an authenticator app (Google Authenticator,
 * Microsoft Authenticator, 1Password…). Setup is two steps: start() makes
 * a pending secret and QR code, enable() confirms it with a first code.
 */
class TwoFactorService {
  async start(userId, platformName = "ChatShop AI") {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    if (user.twoFactor?.enabled) throw new Error("Two-factor login is already on");

    const secret = authenticator.generateSecret();
    user.twoFactor = { ...(user.twoFactor?.toObject?.() || {}), enabled: false, pendingSecret: secret };
    await user.save();

    const otpauth = authenticator.keyuri(user.email, platformName, secret);
    return { otpauth, secret, qrCode: await QRCode.toDataURL(otpauth, { margin: 1, width: 220 }) };
  }

  async enable(userId, code) {
    const user = await User.findById(userId).select("+twoFactor.pendingSecret");
    if (!user?.twoFactor?.pendingSecret) throw new Error("Start the setup again");
    if (!authenticator.verify({ token: String(code || "").replace(/\s/g, ""), secret: user.twoFactor.pendingSecret })) {
      throw new Error("That code isn't right. Check the time on your phone and try again.");
    }
    user.twoFactor = { enabled: true, secret: user.twoFactor.pendingSecret, pendingSecret: undefined };
    await user.save();
    return true;
  }

  async disable(userId, code) {
    const user = await User.findById(userId).select("+twoFactor.secret");
    if (!user?.twoFactor?.enabled) return true;
    if (!this.check(user, code)) throw new Error("That code isn't right");
    user.twoFactor = { enabled: false, secret: undefined, pendingSecret: undefined };
    await user.save();
    return true;
  }

  check(user, code) {
    return authenticator.verify({ token: String(code || "").replace(/\s/g, ""), secret: user.twoFactor.secret });
  }

  // Short-lived token proving the password step passed; it can't be used
  // as a session (the auth middleware rejects purpose: "2fa")
  challengeFor(user, adminLevel) {
    const payload = { id: user._id, purpose: "2fa" };
    if (adminLevel) payload.adminLevel = adminLevel;
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: CHALLENGE_TTL });
  }

  // Second login step: the challenge token plus a code from the app
  async verifyChallenge(challengeToken, code) {
    let decoded;
    try {
      decoded = jwt.verify(challengeToken, process.env.JWT_SECRET);
    } catch {
      throw new Error("This sign-in took too long. Please log in again.");
    }
    if (decoded.purpose !== "2fa") throw new Error("Invalid sign-in step");

    const user = await User.findById(decoded.id).select("+twoFactor.secret");
    if (!user?.twoFactor?.enabled) throw new Error("Invalid sign-in step");
    if (!this.check(user, code)) throw new Error("That code isn't right");
    return { user, adminLevel: decoded.adminLevel };
  }
}

module.exports = new TwoFactorService();
