require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

// የአድሚን መረጃዎችን ከ .env ፋይል ማንበብ
let adminAccount = {
  username: process.env.ADMIN_USERNAME || 'yared',
  password: process.env.ADMIN_PASSWORD || '12345678'
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'hbyhtvgh@gmail.com';

// የኢሜይል መላኪያ ቅንብር (Nodemailer)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: ADMIN_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD || ''
  }
});

// የዳታ መያዣዎች
let users = []; // የተጫዋቾች ዝርዝር
let currentOTP = null;
let otpExpiry = null;

// ====================================================
// A. የአድሚን ሎጊን እና 2FA (EMAIL OTP)
// ====================================================

// 1. የአድሚን መግቢያ ደረጃ 1 (Username & Password)
app.post('/api/admin/login-step1', async (req, res) => {
  const { username, password } = req.body;

  if (username !== adminAccount.username || password !== adminAccount.password) {
    return res.status(401).json({ success: false, message: "የተሳሳተ የአድሚን ስም ወይም ፓስወርድ!" });
  }

  // ባለ 6 ዲጂት OTP ማፍለቅ
  currentOTP = Math.floor(100000 + Math.random() * 900000).toString();
  otpExpiry = Date.now() + 5 * 60 * 1000; // ለ 5 ደቂቃ የሚያገለግል

  try {
    await transporter.sendMail({
      from: `"Game Security" <${ADMIN_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: '🔐 የአድሚን 2FA ማረጋገጫ ኮድ',
      html: `
        <div style="font-family: Arial; padding: 20px; background: #f4f4f4;">
          <h2>የአድሚን ሎጊን ማረጋገጫ</h2>
          <p>ወደ አድሚን ገጽ ለመግባት የተላከው ባለ 6 ዲጂት ኮድ፡</p>
          <h1 style="color: #27ae60; letter-spacing: 5px;">${currentOTP}</h1>
          <p>⚠️ ይህ ኮድ የሚያበቃው በ 5 ደቂቃ ውስጥ ነው።</p>
        </div>
      `
    });
    res.json({ success: true, message: "የ 6 ዲጂት ማረጋገጫ ኮድ ወደ ኢሜይልዎ ተልኳል!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "ኢሜይሉን መላክ አልተቻለም! App Password መኖሩን ያረጋግጡ።" });
  }
});

// 2. የአድሚን 2FA ማረጋገጫ
app.post('/api/admin/verify-2fa', (req, res) => {
  const { otp } = req.body;

  if (!currentOTP || Date.now() > otpExpiry) {
    currentOTP = null;
    return res.status(400).json({ success: false, message: "የኮዱ ጊዜ አልፏል! ድጋሚ ይሞክሩ።" });
  }

  if (otp !== currentOTP) {
    return res.status(401).json({ success: false, message: "የተሳሳተ የ 2FA ኮድ!" });
  }

  currentOTP = null;
  res.json({ success: true, message: "በተካካይ ገብተዋል!" });
});

// ====================================================
// B. FORGOT PASSWORD SYSTEM
// ====================================================

// 1. የፓስወርድ መለወጫ ኮድ በኢሜይል መላክ
app.post('/api/admin/forgot-password', async (req, res) => {
  currentOTP = Math.floor(100000 + Math.random() * 900000).toString();
  otpExpiry = Date.now() + 5 * 60 * 1000;

  try {
    await transporter.sendMail({
      from: `"Game Security" <${ADMIN_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: '🔑 የፓስወርድ መቀየሪያ ኮድ',
      html: `
        <div style="font-family: Arial; padding: 20px; background: #fff3cd;">
          <h2>የፓስወርድ መቀየሪያ ጥያቄ</h2>
          <p>አዲስ ፓስወርድ ለማስገባት የተላከው ኮድ፡</p>
          <h1 style="color: #c0392b; letter-spacing: 5px;">${currentOTP}</h1>
        </div>
      `
    });
    res.json({ success: true, message: "የፓስወርድ መቀየሪያ ኮድ ወደ ኢሜይልዎ ተልኳል!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "ኢሜይል መላክ አልተቻለም!" });
  }
});

// 2. አዲስ ፓስወርድ ማረጋገጥና መተካት
app.post('/api/admin/reset-password', (req, res) => {
  const { otp, newPassword } = req.body;

  if (!currentOTP || Date.now() > otpExpiry) {
    return res.status(400).json({ success: false, message: "የኮዱ ጊዜ አልፏል!" });
  }

  if (otp !== currentOTP) {
    return res.status(401).json({ success: false, message: "የተሳሳተ ኮድ! ፓስወርዱ አልተቀየረም።" });
  }

  adminAccount.password = newPassword;
  currentOTP = null;
  res.json({ success: true, message: "ፓስወርዱ በተካካይ ተቀይሯል! በአዲሱ ፓስወርድ መግባት ይችላሉ።" });
});

// ====================================================
// C. የተጫዋቾች መቆጣጠሪያ (ADMIN USER MANAGEMENT)
// ====================================================

// አዲስ ተጫዋች መመዝገብ
app.post('/api/admin/create-user', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "እባክዎን ሁሉንም ቦታዎች ይሙሉ!" });
  }

  const existing = users.find(u => u.username === username);
  if (existing) {
    return res.status(400).json({ success: false, message: "ይህ የተጠቃሚ ስም አስቀድሞ ተይዟል!" });
  }

  users.push({ username, password, isActive: true });
  res.json({ success: true, message: `ተጫዋች '${username}' በተሳካ ሁኔታ ተፈጥሯል!` });
});

// ====================================================
// D. የተጫዋች ሎጊን እና የ 0-36 ጨዋታ ሎጂክ (GAME LOGIC)
// ====================================================

// የተጫዋች ሎጊን
app.post('/api/user/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ success: false, message: "የተሳሳተ የተጠቃሚ ስም ወይም ፓስወርድ!" });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: "አካውንትዎ ታግዷል! እባክዎን ክፍያ ይፈጽሙ።" });
  }

  res.json({ success: true, username: user.username });
});

// የ 0-36 ጨዋታ የሴርቨር ሎጂክ (Random Number & Percentage Calculation)
app.post('/api/game/spin', (req, res) => {
  const { entryFee, playerCount, cutPercentage } = req.body;

  const fee = Number(entryFee) || 0;
  const count = Number(playerCount) || 0;
  const cut = Number(cutPercentage) || 0;

  // 1. አሸናፊውን ቁጥር በዘከፋ (Random) መምረጥ (0 - 36)
  const winningNumber = Math.floor(Math.random() * 37);

  // 2. የገንዘብ እና የኮሚሽን ስሌት
  const totalPool = fee * count;
  const houseCut = totalPool * (cut / 100);
  const netPrize = totalPool - houseCut;

  res.json({
    success: true,
    winningNumber,
    totalPool,
    houseCut,
    netPrize
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`ባክ-ኤንድ በፖርት ${PORT} ላይ እየሰራ ነው...`));