const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/parse-pdf', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "مفيش ملف وصل!" });

        // بنسحب المفتاح من بيئة Vercel
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

// السطر ده مهم جداً لـ Vercel عشان يشتغل صح
module.exports = app;