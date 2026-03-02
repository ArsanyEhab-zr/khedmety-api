const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'Accept'] }));
app.options('*', cors());

app.post('/api/parse-pdf', async (req, res) => {
    try {
        const { pdfUrl } = req.body;
        if (!pdfUrl) return res.status(400).json({ error: "مفيش رابط ملف وصل!" });

        const fileResponse = await fetch(pdfUrl);
        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // 🌟 التغيير الجذري هنا: هنستخدم "gemini-1.5-flash-latest" ده أضمن اسم موديل حالياً
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const pdfPart = {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType: "application/pdf"
            }
        };

        const prompt = `أنت مساعد ذكي. استخرج جدول دروس مدارس الأحد من ملف PDF هذا ورجعه بصيغة JSON Array فقط.
        ممنوع أي نصوص خارج المصفوفة.
        كل كائن يجب أن يحتوي على:
        - date: تاريخ الدرس أو اسم الشهر
        - title: عنوان الدرس
        - goal: الهدف والآية
        - page: رقم الصفحة`;

        const result = await model.generateContent([prompt, pdfPart]);
        const responseText = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        
        res.json({ success: true, lessons: JSON.parse(responseText) });
    } catch (error) {
        console.error("Error details:", error);
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
        // 🌟 نغيره هنا كمان للأمان
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const prompt = `أنت خادم مدارس أحد. لخص درس "${title}" وهدفه "${goal}" في نقاط تشمل: الفكرة الرئيسية، تطبيق عملي، وآية الدرس.`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, summary: result.response.text() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = app;