const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
// 🌟 السطر ده مهم جداً عشان السيرفر يفهم الداتا اللي جاية من زرار التلخيص
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// 1. مسار تقسيم الـ PDF (اللي عملناه قبل كده)
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
// 2. 🌟 مسار التلخيص الجديد (بتاع كارت الهوم)
// ==========================================
app.post('/api/summarize-lesson', async (req, res) => {
    try {
        const { title, goal } = req.body;

        if (!title) {
            return res.status(400).json({ success: false, error: "اسم الدرس مش موجود" });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `أنت خادم مدارس أحد خبير. أريد تلخيصاً جذاباً ومختصراً لدرس بعنوان "${title}" وهدفه هو "${goal}". 
        اجعل التلخيص في نقاط تشمل: 
        1- الفكرة الرئيسية (بأسلوب شيق).
        2- تطبيق عملي للأطفال.
        3- آية الدرس.
        اجعل الأسلوب روحياً ومناسباً لخادم يحضر الدرس.`;

        const result = await model.generateContent(prompt);

        res.json({ success: true, summary: result.response.text() });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "فشل التلخيص" });
    }
});

// السطر ده عشان Vercel
module.exports = app;