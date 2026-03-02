const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// 🌟 1. إعدادات استقبال البيانات
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 🌟 2. إعدادات الـ CORS عشان الريأكت يكلمه براحته
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.options('*', cors());

// ==========================================
// 1. مسار تقسيم الـ PDF (النسخة الذكية باللينك من Cloudinary)
// ==========================================
app.post('/api/parse-pdf', async (req, res) => {
    try {
        const { pdfUrl } = req.body;

        if (!pdfUrl) return res.status(400).json({ error: "مفيش رابط ملف وصل!" });

        console.log("جاري تحميل الملف من السحابة للسيرفر...");
        
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

// ==========================================
// 2. 🌟 مسار التلخيص (بتاع كارت الهوم اللي كان ممسوح)
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