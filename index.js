const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({ origin: '*' }));
app.options('*', cors());

app.post('/api/parse-pdf', async (req, res) => {
    try {
        const { pdfUrl } = req.body;
        if (!pdfUrl) return res.status(400).json({ error: "مفيش رابط" });

        const fileResponse = await fetch(pdfUrl);
        const buffer = Buffer.from(await fileResponse.arrayBuffer());

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // الموديل الرسمي للـ PDFs
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const pdfPart = {
            inlineData: { data: buffer.toString("base64"), mimeType: "application/pdf" }
        };

        const prompt = `أنت مساعد ذكي لخادم مدارس أحد. استخرج جدول الدروس ورجعه كمصفوفة JSON فقط.
        لا تكتب أي نص قبل أو بعد المصفوفة.
        كل درس يجب أن يحتوي على:
        "date": تاريخ الدرس أو الشهر
        "title": اسم الدرس
        "goal": هدف الدرس
        "page": رقم الصفحة`;

        const result = await model.generateContent([prompt, pdfPart]);
        const responseText = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        
        res.json({ success: true, lessons: JSON.parse(responseText) });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "فشل", details: error.message });
    }
});

app.post('/api/summarize-lesson', async (req, res) => {
    try {
        const { title, goal } = req.body;
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `لخص درس مدارس أحد بعنوان "${title}" وهدفه "${goal}" في نقاط: الفكرة الرئيسية، تطبيق عملي، وآية الدرس.`;
        const result = await model.generateContent(prompt);
        res.json({ success: true, summary: result.response.text() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = app;