const express = require('express');
const app = express();
app.use(express.json());

const ADMIN_TOKEN = "laam-auto-secret-2026";
const ADMIN_SECRET = "ADMIN_SECRET_123";

// ============================================
// KEY — VĨNH VIỄN + CÓ THỜI HẠN
// ============================================
const VALID_KEYS = {
    // 🔑 VĨNH VIỄN
    "LaamHub2024": { type: "forever" },
    "LaamVip":     { type: "forever" },
    "1234":        { type: "forever" },
    "KEYVIP2025":  { type: "forever" },
    
    // ⏰ 1 NGÀY
    "DAY-TRIAL":   { type: "temp", expires: "2026-12-31" },
    
    // 📅 1 TUẦN
    "WEEK-001":    { type: "temp", expires: "2026-12-31" },
    
    // 📅 1 THÁNG
    "MONTH-001":   { type: "temp", expires: "2026-12-31" },
    
    // 📅 1 NĂM
    "YEAR-001":    { type: "temp", expires: "2027-12-31" }
};

function calcExpiry(days) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(days));
    return d.toISOString().split('T')[0];
}

function genKey() {
    const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let k = "LAAM";
    for (let i = 0; i < 4; i++) {
        k += "-";
        for (let j = 0; j < 4; j++) k += c[Math.floor(Math.random() * c.length)];
    }
    return k;
}

// ============================================
// API CHECK KEY
// ============================================
app.post('/api/checkkey', (req, res) => {
    const { key } = req.body;
    if (!key) return res.json({ valid: false, message: "Thiếu key" });
    
    const kd = VALID_KEYS[key.trim()];
    if (!kd) return res.json({ valid: false, message: "Key không tồn tại" });
    
    // Key vĩnh viễn
    if (kd.type === "forever") {
        return res.json({ 
            valid: true, 
            message: "Key vĩnh viễn hợp lệ", 
            type: "forever" 
        });
    }
    
    // Key thời hạn — check expires
    const now = new Date();
    const exp = new Date(kd.expires);
    
    if (now > exp) {
        return res.json({ 
            valid: false, 
            message: "Key đã hết hạn vào " + kd.expires 
        });
    }
    
    const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    return res.json({ 
        valid: true, 
        message: `Key còn ${daysLeft} ngày`,
        type: "temp",
        expires: kd.expires,
        daysLeft: daysLeft
    });
});

// ============================================
// TẠO KEY TỰ ĐỘNG QUA LINK
// days=0 → vĩnh viễn | days=1 → 1 ngày | days=7 → 1 tuần
// days=30 → 1 tháng | days=365 → 1 năm
// ============================================
app.get('/api/auto-generate', (req, res) => {
    const { token, days } = req.query;
    if (token !== ADMIN_TOKEN) {
        return res.json({ success: false, message: "Sai token" });
    }
    
    const newKey = genKey();
    
    // Vĩnh viễn
    if (days === "0" || days === "forever") {
        VALID_KEYS[newKey] = { type: "forever" };
        return res.json({
            success: true,
            key: newKey,
            type: "forever",
            message: "Key VĨNH VIỄN đã tạo!"
        });
    }
    
    // Có thời hạn
    const numDays = parseInt(days) || 1;
    const expires = calcExpiry(numDays);
    VALID_KEYS[newKey] = { type: "temp", expires: expires };
    
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
// LIST KEY
// ============================================
app.get('/api/listkeys', (req, res) => {
    const { token } = req.query;
    if (token !== ADMIN_SECRET) {
        return res.json({ success: false, message: "Sai token" });
    }
    
    const now = new Date();
    const list = [];
    
    for (const [key, data] of Object.entries(VALID_KEYS)) {
        const item = { key, type: data.type };
        if (data.type === "temp") {
            const exp = new Date(data.expires);
            item.expires = data.expires;
            item.daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
            item.expired = now > exp;
        }
        list.push(item);
    }
    
    return res.json({ 
        success: true, 
        total: list.length,
        keys: list
    });
});

// ============================================
// WEB LẤY KEY
// ============================================
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Laam Hub - Lấy Key</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:linear-gradient(135deg,#121216,#1a1a22); color:#fff; font-family:Arial; min-height:100vh; display:flex; justify-content:center; align-items:center; padding:20px; }
.box { background:#1e1e24; padding:40px; border-radius:16px; max-width:480px; width:100%; border:1px solid #2a2a35; }
h1 { color:#4a90e2; text-align:center; font-size:26px; margin-bottom:8px; }
.sub { text-align:center; color:#888; font-size:13px; margin-bottom:25px; }
button { background:#4a90e2; color:#fff; padding:14px; border:none; border-radius:10px; cursor:pointer; font-size:15px; font-weight:600; width:100%; margin:6px 0; }
button:hover { background:#5aa0f2; }
.forever { background:#e2a04a; }
.week { background:#4ae27a; }
.key { background:#0f0f14; padding:20px; border-radius:10px; margin-top:20px; font-family:monospace; text-align:center; border:1px solid #2a2a35; word-break:break-all; }
.key b { color:#4ae27a; font-size:16px; }
.expires { color:#e2a04a; font-size:13px; margin-top:8px; }
.loading,.error { text-align:center; padding:20px; }
.loading { color:#e2a04a; }
.error { color:#ff6b6b; }
</style>
</head>
<body>
<div class="box">
<h1>🐻 Laam Hub 🇻🇳</h1>
<p class="sub">Chọn loại key bạn muốn</p>
<button onclick="getKey(1)">🔑 KEY 1 NGÀY</button>
<button class="week" onclick="getKey(7)">📅 KEY 1 TUẦN</button>
<button onclick="getKey(30)">📅 KEY 1 THÁNG</button>
<button onclick="getKey(365)">📅 KEY 1 NĂM</button>
<button class="forever" onclick="getKey(0)">♾️ KEY VĨNH VIỄN</button>
<div id="result"></div>
</div>
<script>
async function getKey(days) {
    document.getElementById('result').innerHTML = '<div class="loading">⏳ Đang tạo...</div>';
    try {
        const r = await fetch('/api/auto-generate?token=laam-auto-secret-2026&days=' + days);
        const d = await r.json();
        if (d.success) {
            let h = '<div class="key">🔑 Key:<br><b>' + d.key + '</b>';
            h += d.type === 'forever' 
                ? '<div class="expires">♾️ Vĩnh viễn</div>'
                : '<div class="expires">⏰ Hết hạn: ' + d.expires + '</div>';
            h += '</div>';
            document.getElementById('result').innerHTML = h;
        } else {
            document.getElementById('result').innerHTML = '<div class="error">❌ ' + d.message + '</div>';
        }
    } catch(e) {
        document.getElementById('result').innerHTML = '<div class="error">❌ Lỗi kết nối</div>';
    }
}
</script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🐻 Server chạy port ${PORT}`);
});
