const express = require('express');
const app = express();
app.use(express.json());

// ============================================
// CẤU HÌNH
// ============================================
const ADMIN_TOKEN = "laam-auto-secret-2026";
const ADMIN_SECRET = "ADMIN_SECRET_123";

// ============================================
// KEY VĨNH VIỄN (HARD-CODE - KHÔNG MẤT KHI RESTART)
// Thêm key mới vào đây
// ============================================
const VALID_KEYS = {
    "LaamHub2024": { type: "forever", hwid: null },
    "LaamVip":     { type: "forever", hwid: null },
    "1234":        { type: "forever", hwid: null },
    "KEYVIP2025":  { type: "forever", hwid: null },
    "LAAM-7B27-RDKY-L8EQ-FWEJ": { type: "forever", hwid: null },
    "LAAM-SWYM-LBXN-AXI9-6O7E": { type: "forever", hwid: null }
};

// ============================================
// HÀM TÍNH NGÀY HẾT HẠN
// ============================================
function calculateExpiry(days) {
    const exp = new Date();
    exp.setDate(exp.getDate() + parseInt(days));
    return exp.toISOString().split('T')[0];
}

// ============================================
// HÀM TẠO KEY NGẪU NHIÊN
// ============================================
function generateRandomKey() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key = "LAAM";
    for (let i = 0; i < 4; i++) {
        key += "-";
        for (let j = 0; j < 4; j++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    }
    return key;
}

// ============================================
// HÀM KIỂM TRA KEY
// ============================================
function checkKey(key, hwid) {
    const keyData = VALID_KEYS[key];
    
    if (!keyData) {
        return { valid: false, message: "Key không tồn tại" };
    }
    
    // CHỈ check expires khi type === "temp"
    if (keyData.type === "temp") {
        if (!keyData.expires) {
            return { valid: false, message: "Key lỗi: thiếu ngày hết hạn" };
        }
        const now = new Date();
        const expires = new Date(keyData.expires);
        if (isNaN(expires.getTime())) {
            return { valid: false, message: "Key lỗi: ngày hết hạn không hợp lệ" };
        }
        if (now > expires) {
            return { 
                valid: false, 
                message: "Key đã hết hạn vào " + keyData.expires,
                expired: true
            };
        }
    }
    
    // Check HWID
    if (!hwid || hwid === "unknown") {
        return { valid: false, message: "Không lấy được HWID" };
    }
    
    // Gán HWID lần đầu
    if (keyData.hwid === null) {
        keyData.hwid = hwid;
    } else if (keyData.hwid !== hwid) {
        return { 
            valid: false, 
            message: "Key đã dùng trên máy khác!",
            hwidMismatch: true
        };
    }
    
    // Trả về kết quả
    if (keyData.type === "forever") {
        return { valid: true, message: "Key vĩnh viễn hợp lệ", type: "forever" };
    } else {
        const now = new Date();
        const expires = new Date(keyData.expires);
        const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
        return { 
            valid: true, 
            message: `Key hợp lệ - còn ${daysLeft} ngày`,
            type: "temp",
            expires: keyData.expires,
            daysLeft: daysLeft
        };
    }
}

// ============================================
// API CHECK KEY
// ============================================
app.post('/api/checkkey', (req, res) => {
    const { key, hwid } = req.body;
    if (!key || key.trim() === "") {
        return res.json({ valid: false, message: "Thiếu key" });
    }
    const result = checkKey(key.trim(), hwid);
    console.log(`[${result.valid ? 'OK' : 'FAIL'}] ${key} | ${result.message}`);
    return res.json(result);
});

// ============================================
// API AUTO-GENERATE
// days=0 hoặc forever → key vĩnh viễn
// days=1 → 1 ngày, days=7 → 1 tuần, days=30 → 1 tháng, days=365 → 1 năm
// ============================================
app.get('/api/auto-generate', (req, res) => {
    const { token, days } = req.query;
    
    if (token !== ADMIN_TOKEN) {
        return res.json({ success: false, message: "Sai token" });
    }
    
    const newKey = generateRandomKey();
    
    // Key vĩnh viễn
    if (days === "0" || days === "forever" || days === "lifetime") {
        VALID_KEYS[newKey] = { type: "forever", hwid: null };
        console.log(`[AUTO] Tạo key VĨNH VIỄN: ${newKey}`);
        return res.json({
            success: true,
            key: newKey,
            type: "forever",
            message: "Key VĨNH VIỄN đã tạo!"
        });
    }
    
    // Key có thời hạn
    const numDays = parseInt(days) || 1;
    const expires = calculateExpiry(numDays);
    VALID_KEYS[newKey] = {
        type: "temp",
        expires: expires,
        duration: numDays + "day",
        hwid: null
    };
    console.log(`[AUTO] Tạo key ${numDays} ngày: ${newKey}`);
    return res.json({
        success: true,
        key: newKey,
        type: "temp",
        duration: numDays + " ngày",
        expires: expires,
        message: `Key ${numDays} ngày đã tạo!`
    });
});

// ============================================
// API TẠO KEY (ADMIN)
// ============================================
app.post('/api/createkey', (req, res) => {
    const { adminToken, newKey, duration, expires } = req.body;
    
    if (adminToken !== ADMIN_SECRET) {
        return res.json({ success: false, message: "Sai admin token" });
    }
    if (!newKey || newKey.trim() === "") {
        return res.json({ success: false, message: "Key trống" });
    }
    if (VALID_KEYS[newKey]) {
        return res.json({ success: false, message: "Key đã tồn tại" });
    }
    
    // Key vĩnh viễn
    if (duration === "lifetime" || duration === "forever") {
        VALID_KEYS[newKey.trim()] = { type: "forever", hwid: null };
        return res.json({ 
            success: true, 
            message: "Đã tạo key VĨNH VIỄN!", 
            key: newKey,
            type: "forever"
        });
    }
    
    // Key có thời hạn
    let expDate;
    if (expires) {
        const check = new Date(expires);
        if (isNaN(check.getTime())) {
            return res.json({ success: false, message: "Ngày không hợp lệ!" });
        }
        expDate = expires;
    } else if (duration) {
        const daysMap = {
            "1day": 1, "1week": 7, "1month": 30,
            "3month": 90, "6month": 180, "1year": 365
        };
        expDate = calculateExpiry(daysMap[duration] || 7);
    } else {
        return res.json({ success: false, message: "Thiếu duration hoặc expires" });
    }
    
    VALID_KEYS[newKey.trim()] = { 
        type: "temp", 
        expires: expDate,
        duration: duration || "custom",
        hwid: null 
    };
    return res.json({ 
        success: true, 
        message: `Đã tạo key (hết hạn: ${expDate})!`, 
        key: newKey,
        type: "temp",
        expires: expDate
    });
});

// ============================================
// API RESET HWID
// ============================================
app.post('/api/resethwid', (req, res) => {
    const { adminToken, key } = req.body;
    if (adminToken !== ADMIN_SECRET) {
        return res.json({ success: false, message: "Sai admin token" });
    }
    if (!VALID_KEYS[key]) {
        return res.json({ success: false, message: "Key không tồn tại" });
    }
    VALID_KEYS[key].hwid = null;
    return res.json({ success: true, message: `Đã gỡ khóa HWID cho key ${key}` });
});

// ============================================
// API XÓA KEY
// ============================================
app.post('/api/deletekey', (req, res) => {
    const { adminToken, key } = req.body;
    if (adminToken !== ADMIN_SECRET) {
        return res.json({ success: false, message: "Sai admin token" });
    }
    if (VALID_KEYS[key]) {
        delete VALID_KEYS[key];
        return res.json({ success: true, message: "Đã xóa key!" });
    }
    return res.json({ success: false, message: "Key không tồn tại" });
});

// ============================================
// API LIỆT KÊ KEY
// ============================================
app.get('/api/listkeys', (req, res) => {
    const { token } = req.query;
    if (token !== ADMIN_SECRET) {
        return res.json({ success: false, message: "Sai admin token" });
    }
    
    const list = [];
    const now = new Date();
    
    for (const [key, data] of Object.entries(VALID_KEYS)) {
        const item = {
            key: key,
            type: data.type,
            duration: data.duration || "vĩnh viễn",
            hwid: data.hwid ? (data.hwid.substring(0, 8) + "...") : "chưa khóa"
        };
        if (data.type === "temp") {
            const expires = new Date(data.expires);
            item.expires = data.expires;
            item.daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
            item.expired = now > expires;
        }
        list.push(item);
    }
    
    return res.json({ 
        success: true, 
        total: Object.keys(VALID_KEYS).length,
        keys: list
    });
});

// ============================================
// TRANG WEB LẤY KEY
// ============================================
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Laam Hub - Lấy Key</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            background: linear-gradient(135deg, #121216 0%, #1a1a22 100%);
            color: #fff; font-family: Arial, sans-serif;
            min-height: 100vh; display: flex;
            justify-content: center; align-items: center; padding: 20px;
        }
        .box { 
            background: #1e1e24; padding: 40px; border-radius: 16px;
            max-width: 480px; width: 100%;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            border: 1px solid #2a2a35;
        }
        h1 { color: #4a90e2; text-align: center; font-size: 28px; margin-bottom: 10px; }
        .subtitle { text-align: center; color: #888; font-size: 13px; margin-bottom: 30px; }
        button { 
            background: #4a90e2; color: #fff; padding: 14px 24px;
            border: none; border-radius: 10px; cursor: pointer;
            font-size: 15px; font-weight: 600; width: 100%;
            margin: 8px 0; transition: all 0.2s;
        }
        button:hover { background: #5aa0f2; transform: translateY(-2px); }
        button.forever { background: #e2a04a; }
        button.forever:hover { background: #f2b05a; }
        button.week { background: #4ae27a; }
        button.week:hover { background: #5af28a; }
        .key { 
            background: #0f0f14; padding: 20px; border-radius: 10px;
            margin-top: 20px; font-family: monospace; word-break: break-all;
            border: 1px solid #2a2a35; text-align: center;
        }
        .key b { color: #4ae27a; font-size: 16px; letter-spacing: 1px; }
        .key .expires { color: #e2a04a; font-size: 13px; margin-top: 8px; }
        .loading { color: #e2a04a; text-align: center; padding: 20px; }
        .error { color: #ff6b6b; text-align: center; padding: 20px; }
    </style>
</head>
<body>
    <div class="box">
        <h1>🐻 Laam Hub 🇻🇳</h1>
        <p class="subtitle">Chọn loại key bạn muốn lấy</p>
        <button onclick="getKey(1)">🔑 KEY 1 NGÀY</button>
        <button class="week" onclick="getKey(7)">📅 KEY 1 TUẦN</button>
        <button onclick="getKey(30)">📅 KEY 1 THÁNG</button>
        <button onclick="getKey(365)">📅 KEY 1 NĂM</button>
        <button class="forever" onclick="getKey(0)">♾️ KEY VĨNH VIỄN</button>
        <div id="result"></div>
    </div>
    <script>
        async function getKey(days) {
            document.getElementById('result').innerHTML = '<div class="loading">⏳ Đang tạo key...</div>';
            try {
                const res = await fetch('/api/auto-generate?token=laam-auto-secret-2026&days=' + days);
                const data = await res.json();
                if (data.success) {
                    let html = '<div class="key">🔑 Key của bạn:<br><b>' + data.key + '</b>';
                    if (data.type === 'forever') {
                        html += '<div class="expires">♾️ Vĩnh viễn - không hết hạn</div>';
                    } else {
                        html += '<div class="expires">⏰ Hết hạn: ' + data.expires + '</div>';
                    }
                    html += '</div>';
                    document.getElementById('result').innerHTML = html;
                } else {
                    document.getElementById('result').innerHTML = '<div class="error">❌ ' + data.message + '</div>';
                }
            } catch (e) {
                document.getElementById('result').innerHTML = '<div class="error">❌ Lỗi kết nối server</div>';
            }
        }
    </script>
</body>
</html>`);
});

// ============================================
// START
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🐻 Laam Hub Key API chạy port ${PORT}`);
    console.log(`📋 Có ${Object.keys(VALID_KEYS).length} key`);
});
