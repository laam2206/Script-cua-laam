const express = require('express');
const app = express();
app.use(express.json());

// ============================================
// KEY VĨNH VIỄN - KHÔNG CHECK HWID
// ============================================
const VALID_KEYS = [
    "LaamHub2024",
    "LaamVip",
    "1234",
    "KEYVIP2025",
    "LAAM-7B27-RDKY-L8EQ-FWEJ",
    "LAAM-SWYM-LBXN-AXI9-6O7E"
];

// ============================================
// API CHECK KEY — KHÔNG CHECK HWID
// ============================================
app.post('/api/checkkey', (req, res) => {
    const { key } = req.body;
    
    if (!key || key.trim() === "") {
        return res.json({ valid: false, message: "Thiếu key" });
    }
    
    if (VALID_KEYS.includes(key.trim())) {
        return res.json({ 
            valid: true, 
            message: "Key vĩnh viễn hợp lệ", 
            type: "forever" 
        });
    }
    
    return res.json({ valid: false, message: "Key không tồn tại" });
});

// ============================================
// XEM DANH SÁCH KEY
// ============================================
app.get('/api/listkeys', (req, res) => {
    return res.json({ 
        success: true, 
        total: VALID_KEYS.length,
        keys: VALID_KEYS
    });
});

// ============================================
// TRANG CHỦ
// ============================================
app.get('/', (req, res) => {
    res.send('🐻 Laam Hub Key API đang chạy!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🐻 Server chạy port ${PORT}`);
    console.log(`📋 Có ${VALID_KEYS.length} key`);
});
