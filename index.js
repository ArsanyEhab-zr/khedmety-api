const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// إعدادات استقبال البيانات الكبيرة
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// إعدادات CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

app.post('/api/parse-pdf', async (req, res) => {
    try {
        const { pdfUrl } = req.body;
        if (!pdfUrl) return res.status(400).json({ error: "مفيش رابط ملف وصل!" });

        const fileResponse = await fetch(pdfUrl);
        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // 🌟 الموديل ده هو الوحيد اللي بيفهم PDF وشغال طلقة حالياً
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const pdfPart = {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType: "application/pdf"
            }
        };

        const prompt = `أنت مساعد ذكي لخادم مدارس أحد. اقرأ ملف الـ PDF المرفق واستخرج منه جدول الدروس.
        رجع النتيجة بصيغة JSON Array فقط.
        مطلوب لكل درس:
        - date: تاريخ الدرس (مثلا 5 مارس أو 12 مارس)
        - title: اسم الدرس
        - goal: هدف الدرس أو الآية الرئيسية
        - page: رقم الصفحة الموجود فيها الدرس في الـ PDF
        ممنوع أي نصوص أو شرح خارج الـ JSON.`;

        const result = await model.generateContent([prompt, pdfPart]);
        const responseText = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        
        const lessons = JSON.parse(responseText);
        res.json({ success: true, lessons: lessons });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ 
            success: false, 
            error: "فشل الذكاء الاصطناعي", 
            details: error.message 
        });
    }
});

app.post('/api/summarize-lesson', async (req, res) => {
    try {
        const { title, goal } = req.body;
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `أنت خادم مدارس أحد خبير. لخص درس بعنوان "${title}" وهدفه هو "${goal}" في نقاط تشمل: الفكرة الرئيسية بأسلوب شيق، تطبيق عملي للأطفال، وآية الدرس.`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, summary: result.response.text() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = app;