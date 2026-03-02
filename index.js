const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// 🌟 1. توسيع مساحة الاستقبال لـ 50 ميجا عشان السيرفر ميضربش 413
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 🌟 2. إعدادات الـ CORS
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.options('*', cors());

// 🌟 3. توسيع مساحة الـ Multer (المسئول عن استلام الـ PDF) لـ 10 ميجا
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // الحد الأقصى 10 ميجا
});

// ==========================================
// 1. مسار تقسيم الـ PDF
// ==========================================
app.post('/api/parse-pdf', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "مفيش ملف وصل!" });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const pdfPart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: "application/pdf"
            }
        };

        const prompt = `أنت مساعد ذكي. هذا ملف PDF يحتوي على منهج مدارس الأحد. استخرج جدول الدروس ورجعه بصيغة JSON Array فقط بدون أي نص إضافي. العناصر المطلوبة لكل درس: date, title, goal, page.`;

        const result = await model.generateContent([prompt, pdfPart]);
        let responseText = result.response.text();

        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        const lessons = JSON.parse(responseText);

        res.json({ success: true, lessons: lessons });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "فشل الذكاء الاصطناعي في التقسيم" });
    }
});

// ==========================================
// 2. مسار التلخيص الجديد
// ==========================================
// ==========================================
// 1. مسار تقسيم الـ PDF (النسخة الذكية باللينك)
// ==========================================
app.post('/api/parse-pdf', async (req, res) => {
    try {
        const { pdfUrl } = req.body;

        if (!pdfUrl) return res.status(400).json({ error: "مفيش رابط ملف وصل!" });

        console.log("جاري تحميل الملف من فايربيز للسيرفر...");
        
        // 🌟 السيرفر بيحمل الملف من اللينك اللي الريأكت بعته
        const fileResponse = await fetch(pdfUrl);
        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const pdfPart = {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType: "application/pdf"
            }
        };

        const prompt = `أنت مساعد ذكي. هذا ملف PDF يحتوي على منهج مدارس الأحد. استخرج جدول الدروس ورجعه بصيغة JSON Array فقط بدون أي نص إضافي. العناصر المطلوبة لكل درس: date, title, goal, page.`;

        const result = await model.generateContent([prompt, pdfPart]);
        let responseText = result.response.text();

        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        const lessons = JSON.parse(responseText);

        res.json({ success: true, lessons: lessons });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "فشل الذكاء الاصطناعي في التقسيم" });
    }
});

module.exports = app;