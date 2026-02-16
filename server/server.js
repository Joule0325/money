const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const OpenAI = require('openai'); // 引入 OpenAI SDK

const app = express();
const PORT = 3000;

// ==========================================
// ⚠️ 配置区域
// ==========================================
const QWEN_API_KEY = 'sk-a58a350342364d6781b5519175a7cd58'; // 建议放入环境变量
const MONGO_URI = 'mongodb://127.0.0.1:27017/life_os_db';

// 初始化千问客户端
const client = new OpenAI({
    apiKey: QWEN_API_KEY,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
});

// 中间件配置
app.use(cors()); // 允许跨域
app.use(express.json()); // 解析 JSON 请求体
const upload = multer({ dest: 'uploads/' }); // 文件上传配置

// ==========================================
// 📦 数据库模型
// ==========================================
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB 连接成功'))
    .catch(err => console.error('❌ MongoDB 连接失败:', err));

const RecordSchema = new mongoose.Schema({
    type: { type: String, required: true }, // 'expense' or 'income'
    amount: { type: Number, required: true },
    note: { type: String, default: '' },
    date: { type: Date, default: Date.now }
});
const Record = mongoose.model('Record', RecordSchema);

// ==========================================
// 🚀 核心接口 (AI & 普通记账)
// ==========================================

/**
 * 1. AI 识图记账接口
 */
app.post('/api/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ code: 400, msg: '未接收到图片' });
        
        console.log('🤖 收到图片，正在请求 AI 分析...');
        
        // 图片转 Base64
        const imagePath = req.file.path;
        const bitmap = fs.readFileSync(imagePath);
        const base64Image = Buffer.from(bitmap).toString('base64');
        const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

        // 调用千问 Qwen-VL-Max
        const completion = await client.chat.completions.create({
            model: "qwen-vl-max",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "你是一个专业的记账助手。请分析这张图片。提取：1.总金额(数字) 2.类型(expense或income) 3.备注(简短商品名)。直接返回纯JSON，不要Markdown。格式: {\"amount\": 25.5, \"type\": \"expense\", \"note\": \"早餐\"}" },
                        { type: "image_url", image_url: { url: dataUrl } }
                    ]
                }
            ],
        });

        let resultText = completion.choices[0].message.content;
        // 清理 Markdown 标记
        resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        console.log('🤖 AI 返回:', resultText);
        
        const aiData = JSON.parse(resultText);

        // 存入数据库
        const newRecord = await Record.create({
            type: aiData.type || 'expense',
            amount: Number(aiData.amount),
            note: aiData.note || 'AI 自动记账'
        });

        fs.unlinkSync(imagePath); // 删除临时文件

        res.json({ code: 200, msg: '成功', data: newRecord });

    } catch (error) {
        console.error('❌ AI 处理失败:', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ code: 500, msg: '识别失败: ' + error.message });
    }
});

/**
 * 2. 获取账单列表 (GET)
 * 你的代码之前可能缺少了这个，导致列表也是空的
 */
app.get('/api/records', async (req, res) => {
    try {
        // 按时间倒序排列
        const records = await Record.find().sort({ date: -1 });
        // 格式化日期方便前端显示
        const formatted = records.map(r => ({
            ...r._doc,
            _id: r._id,
            amount: r.amount,
            // 转成 YYYY-MM-DD HH:mm 格式
            dateStr: new Date(r.date).toLocaleString('zh-CN', { 
                year: 'numeric', month: '2-digit', day: '2-digit', 
                hour: '2-digit', minute: '2-digit', hour12: false 
            }).replace(/\//g, '-')
        }));
        res.json({ code: 200, data: formatted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: '获取失败' });
    }
});

/**
 * 3. 新增一笔账单 (POST)
 * 🔥🔥 你的代码之前就是缺少了这个接口，导致点“确认”报错 🔥🔥
 */
app.post('/api/records', async (req, res) => {
    try {
        const { type, amount, note } = req.body;
        
        console.log('📝 收到记账请求:', req.body);

        if (!amount) {
            return res.json({ code: 400, msg: '金额不能为空' });
        }

        const newRecord = await Record.create({
            type,
            amount: Number(amount), // 确保转为数字
            note
        });

        res.json({ code: 200, msg: '记账成功', data: newRecord });
    } catch (err) {
        console.error('❌ 记账失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误: ' + err.message });
    }
});

/**
 * 4. 删除账单 (DELETE)
 */
app.delete('/api/records/:id', async (req, res) => {
    try {
        await Record.findByIdAndDelete(req.params.id);
        res.json({ code: 200, msg: '删除成功' });
    } catch (err) {
        res.status(500).json({ code: 500, msg: '删除失败' });
    }
});

// ==========================================
// 🚀 启动服务
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 服务已启动！`);
    console.log(`📡 手机请确保连接同一 WiFi`);
    console.log(`🔗 接口地址前缀: http://<你的电脑IP>:${PORT}/api`);
});