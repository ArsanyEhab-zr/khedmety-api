require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors()); // عشان نسمح للريأكت يكلم السيرفر

// استلام الـ PDF في الذاكرة المؤقتة
const upload = multer({ storage: multer.memoryStorage() });

// استدعاء Gemini بالمفتاح اللي في ملف .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/parse-pdf', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "مفيش ملف وصل!" });

        console.log("جاري تحليل ملف:", req.file.originalname);

        // تجهيز الملف لـ Gemini
        const pdfPart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: "application/pdf"
            }
        };

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // البرومبت السحري
        const prompt = `
        أنت مساعد ذكي. هذا ملف PDF يحتوي على منهج مدارس الأحد.
        استخرج جدول الدروس ورجعه بصيغة JSON Array فقط، بدون أي كلام إضافي أو علامات (\`\`\`json).
        كل عنصر يجب أن يكون Object يحتوي على:
        - date: تاريخ الدرس بصيغة YYYY-MM-DD (استنتجه إن وجد، أو اتركه فارغاً)
        - title: اسم الدرس
        - goal: هدف الدرس
        - page: رقم الصفحة التي يبدأ عندها هذا الدرس
        `;

        const result = await model.generateContent([prompt, pdfPart]);
        let responseText = result.response.text();
        
        // تنظيف الرد عشان نضمن إنه JSON سليم
        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        const lessons = JSON.parse(responseText);

        res.json({ success: true, lessons: lessons });

    } catch (error) {
        console.error("خطأ:", error);
        res.status(500).json({ success: false, error: "فشل في قراءة الملف." });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 السيرفر شغال على بورت ${PORT}`));