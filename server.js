const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ====== CẤU HÌNH ======
const CONFIG = {
    KEY_EXPIRE_MS: (parseInt(process.env.KEY_EXPIRE_HOURS) || 24) * 60 * 60 * 1000,
    TOKEN_EXPIRE_MS: (parseInt(process.env.TOKEN_EXPIRE_MINUTES) || 5) * 60 * 1000,
    LINKVERTISE_BASE: process.env.LINKVERTISE_BASE || 'https://linkvertise.com/YOUR_LINK_ID',
    SECRET: process.env.SECRET || 'doi_thanh_secret_rieng_cua_ban',
    MAX_CHECK_PER_MINUTE: 30,      // Chống spam check-key
    LOCK_ON_FIRST_USE: true        // Khóa HWID cứng từ lần check đầu
};

// ====== LƯU TRỮ ======
const DB_FILE = path.join(__dirname, 'keys.json');

let db = {
    tokens: {},       // token -> { hwid, ip, expires }
    keys: {},         // key   -> { hwid, expires, locked, firstIp, checkCount, lastCheck }
    rateLimit: {}     // ip    -> { count, resetAt }
};

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        db.rateLimit = db.rateLimit || {};
    } catch (e) {
        console.error('Lỗi đọc DB:', e);
    }
}

let saveTimer = null;
function saveDB() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        } catch (e) {
            console.error('Lỗi ghi DB:', e);
        }
        saveTimer = null;
    }, 500);
}

// ====== TIỆN ÍCH ======
function randomHex(bytes = 16) {
    return crypto.randomBytes(bytes).toString('hex');
}

function generateKey(hwid) {
    const rand = randomHex(16);
    const sig = crypto
        .createHmac('sha256', CONFIG.SECRET)
        .update(hwid + Date.now() + rand)
        .digest('hex')
        .slice(0, 12);
    return `${rand}-${sig}`;
}

function formatDuration(ms) {
    const h = Math.floor(ms / (60 * 60 * 1000));
    const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    if (h >= 24) {
        const d = Math.floor(h / 24);
        const rh = h % 24;
        return rh > 0 ? `${d} ngày ${rh} giờ` : `${d} ngày`;
    }
    if (h > 0) return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
    return `${m} phút`;
}

function getClientIp(req) {
    return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
        .toString()
        .split(',')[0]
        .trim();
}

function checkRateLimit(ip) {
    const now = Date.now();
    const entry = db.rateLimit[ip];
    if (!entry || entry.resetAt < now) {
        db.rateLimit[ip] = { count: 1, resetAt: now + 60 * 1000 };
        return true;
    }
    if (entry.count >= CONFIG.MAX_CHECK_PER_MINUTE) return false;
    entry.count++;
    return true;
}

function cleanupExpired() {
    const now = Date.now();
    let changed = false;

    for (const t in db.tokens) {
        if (db.tokens[t].expires < now) { delete db.tokens[t]; changed = true; }
    }
    for (const k in db.keys) {
        if (db.keys[k].expires < now) { delete db.keys[k]; changed = true; }
    }
    for (const ip in db.rateLimit) {
        if (db.rateLimit[ip].resetAt < now) { delete db.rateLimit[ip]; changed = true; }
    }
    if (changed) saveDB();
}
setInterval(cleanupExpired, 60 * 1000);

// ====== ROUTES ======

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Key System API',
        keyExpire: formatDuration(CONFIG.KEY_EXPIRE_MS),
        tokenExpire: formatDuration(CONFIG.TOKEN_EXPIRE_MS),
        lockOnFirstUse: CONFIG.LOCK_ON_FIRST_USE,
        totalKeys: Object.keys(db.keys).length
    });
});

// 1. Yêu cầu link vượt
app.post('/api/request-key', (req, res) => {
    const { hwid } = req.body;
    if (!hwid) return res.status(400).json({ error: 'Thiếu hwid' });

    const ip = getClientIp(req);
    const token = randomHex(8);
    db.tokens[token] = {
        hwid,
        ip,
        expires: Date.now() + CONFIG.TOKEN_EXPIRE_MS
    };
    saveDB();

    res.json({
        link: `${CONFIG.LINKVERTISE_BASE}?token=${token}`,
        token
    });
});

// 2. Callback sinh key
app.get('/api/callback', (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send('Thiếu token');

    const entry = db.tokens[token];
    if (!entry || entry.expires < Date.now()) {
        return res.status(400).send('Token không hợp lệ hoặc đã hết hạn');
    }

    const key = generateKey(entry.hwid);
    db.keys[key] = {
        hwid: entry.hwid,
        expires: Date.now() + CONFIG.KEY_EXPIRE_MS,
        locked: true,              // Khóa cứng HWID ngay từ đầu
        firstIp: entry.ip,
        checkCount: 0,
        lastCheck: null
    };
    delete db.tokens[token];
    saveDB();

    const durationText = formatDuration(CONFIG.KEY_EXPIRE_MS);

    res.send(`
        <html>
        <head>
            <title>Key của bạn</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family:sans-serif;text-align:center;padding:50px;background:#111;color:#0f0;margin:0;">
            <h2>Key của bạn đã sẵn sàng</h2>
            <p style="font-size:20px;background:#222;padding:20px;border-radius:8px;display:inline-block;word-break:break-all;max-width:90%;">
                ${key}
            </p>
            <p style="color:#888;font-size:12px;">Key có hiệu lực ${durationText}.</p>
            <p style="color:#f80;font-size:12px;">⚠️ Key này chỉ dùng được trên 1 máy duy nhất (HWID đã khóa).</p>
            <button onclick="navigator.clipboard.writeText('${key}');this.innerText='Đã copy ✓'"
                style="margin-top:16px;padding:10px 24px;font-size:14px;border:none;border-radius:6px;background:#0f0;color:#000;cursor:pointer;font-weight:bold;">
                Copy Key
            </button>
        </body>
        </html>
    `);
});

// 3. Check key (khóa HWID cứng)
app.post('/api/check-key', (req, res) => {
    const { key, hwid } = req.body;
    if (!key || !hwid) {
        return res.status(400).json({ valid: false, error: 'Thiếu key hoặc hwid' });
    }

    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ valid: false, reason: 'Quá nhiều request, thử lại sau' });
    }

    const entry = db.keys[key];
    if (!entry) return res.json({ valid: false, reason: 'Key không tồn tại' });

    if (entry.expires < Date.now()) {
        delete db.keys[key];
        saveDB();
        return res.json({ valid: false, reason: 'Key đã hết hạn' });
    }

    // 🔒 KHÓA CỨNG HWID
    if (entry.hwid !== hwid) {
        console.warn(`[CẢNH BÁO] Key ${key.slice(0, 12)}... bị dùng sai HWID! IP: ${ip}`);
        return res.json({
            valid: false,
            reason: 'Key này đã khóa vào máy khác. Mỗi key chỉ dùng 1 máy.'
        });
    }

    // Cập nhật thống kê
    entry.checkCount = (entry.checkCount || 0) + 1;
    entry.lastCheck = Date.now();
    saveDB();

    const remaining = entry.expires - Date.now();
    res.json({
        valid: true,
        expires: entry.expires,
        remaining: formatDuration(remaining),
        checkCount: entry.checkCount
    });
});

// 4. Admin unbind HWID (khi user đổi máy)
app.post('/api/admin/unbind', (req, res) => {
    const { key, newHwid, secret } = req.body;
    if (secret !== CONFIG.SECRET) return res.status(403).json({ error: 'Sai secret' });

    const entry = db.keys[key];
    if (!entry) return res.json({ success: false, reason: 'Key không tồn tại' });

    if (newHwid) entry.hwid = newHwid;
    entry.locked = false;
    saveDB();

    res.json({ success: true, key, newHwid: entry.hwid });
});

// 5. Admin tạo key thủ công
app.post('/api/admin/generate', (req, res) => {
    const { hwid, secret } = req.body;
    if (secret !== CONFIG.SECRET) return res.status(403).json({ error: 'Sai secret' });

    const key = generateKey(hwid || 'manual');
    db.keys[key] = {
        hwid: hwid || 'manual',
        expires: Date.now() + CONFIG.KEY_EXPIRE_MS,
        locked: !!hwid,
        firstIp: getClientIp(req),
        checkCount: 0,
        lastCheck: null
    };
    saveDB();
    res.json({ key, expires: db.keys[key].expires });
});

// 6. Admin xem danh sách key
app.post('/api/admin/list', (req, res) => {
    const { secret } = req.body;
    if (secret !== CONFIG.SECRET) return res.status(403).json({ error: 'Sai secret' });

    const list = Object.entries(db.keys).map(([key, data]) => ({
        key: key.slice(0, 16) + '...',
        hwid: data.hwid,
        expires: data.expires,
        remaining: formatDuration(data.expires - Date.now()),
        checkCount: data.checkCount,
        firstIp: data.firstIp
    }));
    res.json({ total: list.length, keys: list });
});

// ====== START ======
app.listen(PORT, () => {
    console.log(`✅ Key API đang chạy tại port ${PORT}`);
    console.log(`   Key sống: ${formatDuration(CONFIG.KEY_EXPIRE_MS)}`);
    console.log(`   Token sống: ${formatDuration(CONFIG.TOKEN_EXPIRE_MS)}`);
    console.log(`   Khóa 1 key = 1 máy: ${CONFIG.LOCK_ON_FIRST_USE ? 'BẬT' : 'TẮT'}`);
});
