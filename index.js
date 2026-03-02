const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
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
        
        // 🌟 شلنا السطر اللي كان عامل مشكلة وحطناه جوه البرومبت نفسه بشكل أقوى
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const pdfPart = {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType: "application/pdf"
            }
        };

        const prompt = `أنت مساعد ذكي. هذا ملف PDF يحتوي على منهج مدارس الأحد.
        استخرج جدول الدروس ورجعه بصيغة JSON Array فقط.
        ممنوع كود أو نصوص خارج المصفوفة.
        العناصر المطلوبة لكل درس:
        - date: تاريخ الدرس (مثلا 'مارس' أو رقم الدرس)
        - title: عنوان الدرس
        - goal: هدف الدرس أو الآية
        - page: رقم الصفحة الموجود بها الدرس`;

        const result = await model.generateContent([prompt, pdfPart]);
        let responseText = result.response.text();
        
        // 🧹 تنظيف الرد عشان نضمن إنه JSON سليم 100%
        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        
        const lessons = JSON.parse(responseText);
        res.json({ success: true, lessons: lessons });

    } catch (error) {
        console.error("خطأ:", error);
        res.status(500).json({ 
            success: false, 
            error: "فشل الذكاء الاصطناعي في التقسيم",
            details: error.message 
        });
    }
});

// مسار التلخيص (كما هو)
app.post('/api/summarize-lesson', async (req, res) => {
    try {
        const { title, goal } = req.body;
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `أنت خادم مدارس أحد خبير. لخص درس "${title}" وهدفه "${goal}" في نقاط تشمل: الفكرة الرئيسية، تطبيق عملي، وآية الدرس.`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, summary: result.response.text() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = app;