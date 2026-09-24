require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// የአድሚን መረጃዎችን ከ .env ፋይል ማንበብ
let adminAccount = {
  username: process.env.ADMIN_USERNAME || 'yared',
  password: process.env.ADMIN_PASSWORD || '12345678'
};

// የዳታ መያዣዎች
let users = []; // የተጫዋቾች ዝርዝር

// ====================================================
// A. የአድሚን ሎጊን (ያለ ኢሜይል / 2FA ኮድ)
// ====================================================

// 1. የአድሚን መግቢያ
app.post('/api/admin/login-step1', (req, res) => {
  const { username, password } = req.body;

  if (username !== adminAccount.username || password !== adminAccount.password) {
    return res.status(401).json({ success: false, message: "የተሳሳተ የአድሚን ስም ወይም ፓስወርድ!" });
  }

  // ያለ ምንም ኢሜይል ቀጥታ መግባት
  res.json({ success: true, message: "በተሳካ ሁኔታ ገብተዋል! ወደ ዳሽቦርድ በመግባት ላይ..." });
});

// 2. የድሮ ፍሮንት-ኤንድ ጥሪዎች ካሉ እንዳይሰበሩ የተደረገ (Verify 2FA Stub)
app.post('/api/admin/verify-2fa', (req, res) => {
  res.json({ success: true, message: "በተሳካ ሁኔታ ገብተዋል!" });
});

// ====================================================
// B. FORGOT PASSWORD SYSTEM (ያለ ኢሜይል ኮድ)
// ====================================================

// 1. የፓስወርድ መለወጫ ጥያቄ
app.post('/api/admin/forgot-password', (req, res) => {
  res.json({ success: true, message: "እባክዎን አዲሱን ፓስወርድ ያስገቡ!" });
});

// 2. አዲስ ፓስወርድ ማረጋገጥና መተካት
app.post('/api/admin/reset-password', (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ success: false, message: "እባክዎን አዲስ ፓስወርድ ያስገቡ!" });
  }

  adminAccount.password = newPassword;
  res.json({ success: true, message: "ፓስወርዱ በተሳካ ሁኔታ ተቀይሯል! በአዲሱ ፓስወርድ መግባት ይችላሉ።" });
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
