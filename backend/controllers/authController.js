const Admin = require("../models/Admin");
const Member = require("../models/Member");
const Committee = require("../models/Committee");
const generateToken = require("../utils/generateToken");

// @route  POST /api/auth/admin/register
// @desc   Create an admin account. Any admin can then create and own
//         multiple committees — there's no limit to one committee per admin.
//         Protected by a shared secret (ADMIN_REGISTRATION_SECRET) so
//         random people can't create admin accounts on a public server.
//         Give this secret only to the people you want to let become
//         admins — for example, other family members running committees.
async function registerAdmin(req, res, next) {
  try {
    const { name, email, password, registrationSecret } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "name, email and password are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }
    const expectedSecret = process.env.ADMIN_REGISTRATION_SECRET;
    if (expectedSecret && registrationSecret !== expectedSecret) {
      return res.status(403).json({ success: false, message: "Invalid registration secret." });
    }
    const exists = await Admin.findOne({ email });
    if (exists) {
      return res.status(409).json({ success: false, message: "An admin with this email already exists." });
    }
    const admin = await Admin.create({ name, email, password });
    const token = generateToken({ id: admin._id, role: "admin" });
    res.status(201).json({
      success: true,
      token,
      user: { id: admin._id, name: admin.name, email: admin.email, role: "admin" },
    });
  } catch (err) {
    next(err);
  }
}

// @route  POST /api/auth/admin/login
async function loginAdmin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email and password are required." });
    }
    const admin = await Admin.findOne({ email });
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    const previousLogin = admin.lastLogin;
    admin.lastLogin = new Date();
    await admin.save();
    const token = generateToken({ id: admin._id, role: "admin" });
    res.json({
      success: true,
      token,
      user: { id: admin._id, name: admin.name, email: admin.email, role: "admin", lastLogin: previousLogin },
    });
  } catch (err) {
    next(err);
  }
}

// @route  POST /api/auth/member/login
// @desc   Members log in with their committee's join code, their phone
//         number, and the 4-digit PIN the admin set for them. The code is
//         what lets the same phone number exist in two unrelated committees
//         without any ambiguity about which one you're signing into.
async function loginMember(req, res, next) {
  try {
    const { committeeCode, phone, pin } = req.body;
    if (!committeeCode || !phone || !pin) {
      return res.status(400).json({ success: false, message: "committeeCode, phone and pin are required." });
    }
    const committee = await Committee.findOne({ code: committeeCode.trim().toUpperCase() });
    if (!committee) {
      return res.status(404).json({ success: false, message: "No committee found with that code." });
    }
    const member = await Member.findOne({ committee: committee._id, phone });
    if (!member || !(await member.comparePin(pin))) {
      return res.status(401).json({ success: false, message: "Invalid phone number or PIN." });
    }
    const previousLogin = member.lastLogin;
    member.lastLogin = new Date();
    await member.save();
    const token = generateToken({ id: member._id, role: "member", committee: committee._id });
    res.json({
      success: true,
      token,
      user: { id: member._id, name: member.name, phone: member.phone, role: "member", lastLogin: previousLogin },
      committee: { id: committee._id, name: committee.name, code: committee.code },
    });
  } catch (err) {
    next(err);
  }
}

// @route  GET /api/auth/me
// @desc   Returns the logged-in user's own profile, admin or member.
async function getMe(req, res, next) {
  try {
    if (req.user.role === "admin") {
      const admin = await Admin.findById(req.user.id).select("-password");
      if (!admin) return res.status(404).json({ success: false, message: "Admin not found." });
      return res.json({ success: true, user: { ...admin.toObject(), role: "admin" } });
    }
    const member = await Member.findById(req.user.id).select("-pin").populate("committee", "name code");
    if (!member) return res.status(404).json({ success: false, message: "Member not found." });
    res.json({ success: true, user: { ...member.toObject(), role: "member" } });
  } catch (err) {
    next(err);
  }
}

module.exports = { registerAdmin, loginAdmin, loginMember, getMe };
