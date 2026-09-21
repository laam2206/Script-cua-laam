// ============================================
// LAAM HUB KEY SERVER
// ============================================

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// DATABASE
const db = new sqlite3.Database('./keys.db');

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            hwid TEXT DEFAULT NULL,
            expires INTEGER NOT NULL,
            created INTEGER NOT NULL,
            note TEXT DEFAULT '',
            used_by TEXT DEFAULT NULL,
            used_at INTEGER DEFAULT NULL,
            active INTEGER DEFAULT 1
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT,
            hwid TEXT,
            action TEXT,
            ip TEXT,
            time INTEGER
        )
    `);
    console.log('✅ Database ready');
});

// TẠO KEY RANDOM
function generateKeyString() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const rand = (n) => {
        let s = '';
        for (let i = 0; i < n; i++) {
            s += chars[Math.floor(Math.random() * chars.length)];
        }
        return s;
    };
    return `LAAM-${rand(4)}-${rand(4)}-${rand(4)}-${rand(4)}`;
}

// ============================================
// API: TỰ ĐỘNG TẠO KEY (cho Link4m)
// ============================================
app.get('/api/auto-generate', (req, res) => {
    const { token, days } = req.query;
    
    const AUTO_TOKEN = process.env.AUTO_TOKEN || 'laam-auto-secret-2026';
    if (token !== AUTO_TOKEN) {
        return res.status(403).send('Access denied');
    }
    
    const now = Math.floor(Date.now() / 1000);
    const key = generateKeyString();
    const expires = now + ((days || 1) * 86400);
    
    db.run(
        `INSERT INTO keys (key, expires, created, note) VALUES (?, ?, ?, ?)`,
        [key, expires, now, 'Auto via Link4m'],
        function(err) {
            if (err) return res.send('Lỗi tạo key!');
            
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Laam Hub - Key Của Bạn</title>
                    <style>
                        body {
                            background: linear-gradient(135deg, #1a1a2e, #16213e);
                            color: #fff;
                            font-family: 'Segoe UI', Arial;
                            text-align: center;
                            padding: 50px;
                            min-height: 100vh;
                            margin: 0;
                        }
                        .key-box {
                            background: rgba(0,0,0,0.5);
                            padding: 40px;
                            border-radius: 20px;
                            border: 2px solid #4CAF50;
                            max-width: 600px;
                            margin: 0 auto;
                            box-shadow: 0 0 30px rgba(76, 175, 80, 0.3);
                        }
                        h1 { color: #4CAF50; }
                        .key-text {
                            font-size: 26px;
                            letter-spacing: 3px;
                            color: #FFD700;
                            word-break: break-all;
                            font-family: 'Courier New', monospace;
                            padding: 20px;
                            background: #111;
                            border-radius: 10px;
                            margin: 20px 0;
                        }
                        .copy-btn {
                            background: #4CAF50;
                            color: #fff;
                            border: none;
                            padding: 15px 40px;
                            border-radius: 10px;
                            font-size: 16px;
                            font-weight: bold;
                            cursor: pointer;
                        }
                        .copy-btn:hover { background: #45a049; }
                        .info { color: #888; margin-top: 30px; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="key-box">
                        <h1>🐻 LAAM HUB 🇻🇳</h1>
                        <p>Key của bạn đã sẵn sàng!</p>
                        <div class="key-text" id="keyText">${key}</div>
                        <button class="copy-btn" onclick="copyKey()">📋 COPY KEY</button>
                        <p class="info">⏰ Hết hạn: ${new Date(expires * 1000).toLocaleString('vi-VN')}</p>
                    </div>
                    <script>
                        function copyKey() {
                            navigator.clipboard.writeText("${key}");
                            event.target.textContent = '✅ ĐÃ COPY!';
                            setTimeout(() => event.target.textContent = '📋 COPY KEY', 2000);
                        }
                    </script>
                </body>
                </html>
            `);
        }
    );
});

// ============================================
// API: XÁC THỰC KEY (client Lua gọi)
// ============================================
app.post('/api/verify', (req, res) => {
    const { key, hwid, username } = req.body;
    
    if (!key || !hwid) {
        return res.json({ valid: false, message: 'Thiếu key hoặc HWID!' });
    }
    
    const now = Math.floor(Date.now() / 1000);
    
    db.get(`SELECT * FROM keys WHERE key = ?`, [key], (err, row) => {
        if (err || !row) {
            return res.json({ valid: false, message: 'Key không tồn tại!' });
        }
        if (row.active !== 1) {
            return res.json({ valid: false, message: 'Key đã bị vô hiệu hóa!' });
        }
        if (now > row.expires) {
            return res.json({ valid: false, message: 'Key đã hết hạn!' });
        }
        if (!row.hwid) {
            db.run(`UPDATE keys SET hwid = ?, used_by = ?, used_at = ? WHERE key = ?`,
                [hwid, username || 'Unknown', now, key]);
            const daysLeft = Math.floor((row.expires - now) / 86400);
            return res.json({
                valid: true,
                message: `Kích hoạt thành công! Còn ${daysLeft} ngày.`
            });
        }
        if (row.hwid !== hwid) {
            return res.json({ valid: false, message: 'Key đã dùng cho thiết bị khác!' });
        }
        const daysLeft = Math.floor((row.expires - now) / 86400);
        res.json({ valid: true, message: `Key hợp lệ! Còn ${daysLeft} ngày.` });
    });
});

// ============================================
// API: TẠO KEY THỦ CÔNG (admin)
// ============================================
app.post('/api/generate', (req, res) => {
    const { adminKey, days, note } = req.body;
    const ADMIN_KEY = process.env.ADMIN_KEY || 'laam-admin-secret-2026';
    
    if (adminKey !== ADMIN_KEY) {
        return res.json({ success: false, message: 'Sai admin key!' });
    }
    
    const key = generateKeyString();
    const now = Math.floor(Date.now() / 1000);
    let expires;
    if (days === 0 || days === 'forever') {
        expires = 9999999999;
    } else {
        expires = now + ((days || 7) * 86400);
    }
    
    db.run(`INSERT INTO keys (key, expires, created, note) VALUES (?, ?, ?, ?)`,
        [key, expires, now, note || ''],
        function(err) {
            if (err) return res.json({ success: false, message: 'Lỗi!' });
            res.json({
                success: true,
                key: key,
                days: days === 0 ? 'Vĩnh viễn' : (days || 7),
                expires: days === 0 ? 'Vĩnh viễn' : new Date(expires * 1000).toLocaleString('vi-VN')
            });
        });
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/', (req, res) => {
    res.json({ status: 'online', name: 'Laam Hub Key Server' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server chạy tại port ${PORT}`);
});
