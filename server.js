// ============================================
// LAAM HUB 🇻🇳 KEY SERVER
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
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
                            color: #fff;
                            font-family: 'Segoe UI', Arial, sans-serif;
                            text-align: center;
                            padding: 50px 20px;
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        .key-box {
                            background: rgba(0,0,0,0.6);
                            padding: 45px 35px;
                            border-radius: 24px;
                            border: 2px solid #da251d;
                            max-width: 600px;
                            width: 100%;
                            box-shadow: 0 0 40px rgba(218, 37, 29, 0.4);
                            position: relative;
                        }
                        .flag {
                            font-size: 48px;
                            margin-bottom: 15px;
                        }
                        h1 {
                            color: #ffcd00;
                            font-size: 28px;
                            margin-bottom: 8px;
                            letter-spacing: 1px;
                        }
                        .subtitle {
                            color: #aaa;
                            font-size: 14px;
                            margin-bottom: 30px;
                        }
                        .key-label {
                            color: #888;
                            font-size: 13px;
                            margin-bottom: 10px;
                            text-transform: uppercase;
                            letter-spacing: 2px;
                        }
                        .key-text {
                            font-size: 24px;
                            letter-spacing: 3px;
                            color: #ffcd00;
                            word-break: break-all;
                            font-family: 'Courier New', monospace;
                            padding: 20px;
                            background: #0a0a0a;
                            border-radius: 12px;
                            margin: 15px 0 25px;
                            border: 1px solid #333;
                            font-weight: bold;
                        }
                        .copy-btn {
                            background: linear-gradient(135deg, #da251d, #ffcd00);
                            color: #fff;
                            border: none;
                            padding: 16px 45px;
                            border-radius: 12px;
                            font-size: 16px;
                            font-weight: bold;
                            cursor: pointer;
                            transition: transform 0.2s, box-shadow 0.2s;
                            letter-spacing: 1px;
                        }
                        .copy-btn:hover {
                            transform: translateY(-2px);
                            box-shadow: 0 10px 25px rgba(218, 37, 29, 0.5);
                        }
                        .copy-btn:active {
                            transform: translateY(0);
                        }
                        .info {
                            color: #888;
                            margin-top: 25px;
                            font-size: 13px;
                            line-height: 1.6;
                        }
                        .info .highlight {
                            color: #ffcd00;
                            font-weight: bold;
                        }
                        .steps {
                            background: rgba(255,255,255,0.05);
                            padding: 20px;
                            border-radius: 12px;
                            margin-top: 25px;
                            text-align: left;
                            border-left: 3px solid #da251d;
                        }
                        .steps h3 {
                            color: #ffcd00;
                            margin-bottom: 12px;
                            font-size: 15px;
                        }
                        .steps ol {
                            padding-left: 20px;
                            color: #ccc;
                            font-size: 13px;
                            line-height: 1.8;
                        }
                        .steps li { margin: 5px 0; }
                    </style>
                </head>
                <body>
                    <div class="key-box">
                        <div class="flag">🇻🇳</div>
                        <h1>LAAM HUB</h1>
                        <p class="subtitle">Key của bạn đã sẵn sàng!</p>
                        
                        <p class="key-label">🔑 Key của bạn</p>
                        <div class="key-text" id="keyText">${key}</div>
                        
                        <button class="copy-btn" onclick="copyKey()">📋 COPY KEY</button>
                        
                        <p class="info">
                            ⏰ Hết hạn: <span class="highlight">${new Date(expires * 1000).toLocaleString('vi-VN')}</span>
                        </p>
                        
                        <div class="steps">
                            <h3>📖 Hướng dẫn sử dụng:</h3>
                            <ol>
                                <li>Bấm "COPY KEY" ở trên</li>
                                <li>Mở Laam Hub trong Roblox</li>
                                <li>Dán key vào ô "Nhập key"</li>
                                <li>Bấm "XÁC NHẬN KEY" để vào menu</li>
                            </ol>
                        </div>
                    </div>
                    
                    <script>
                        function copyKey() {
                            const key = "${key}";
                            const btn = event.target;
                            
                            navigator.clipboard.writeText(key).then(() => {
                                btn.textContent = '✅ ĐÃ COPY!';
                                btn.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
                                setTimeout(() => {
                                    btn.textContent = '📋 COPY KEY';
                                    btn.style.background = 'linear-gradient(135deg, #da251d, #ffcd00)';
                                }, 2000);
                            }).catch(() => {
                                // Fallback nếu clipboard không hoạt động
                                const temp = document.createElement('textarea');
                                temp.value = key;
                                document.body.appendChild(temp);
                                temp.select();
                                document.execCommand('copy');
                                document.body.removeChild(temp);
                                btn.textContent = '✅ ĐÃ COPY!';
                                setTimeout(() => btn.textContent = '📋 COPY KEY', 2000);
                            });
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
