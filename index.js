const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// إعدادات استقبال البيانات الكبيرة (مظبوطة عندك وزي الفل)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

// ==========================================
// 1. مسار تقسيم الـ PDF (النسخة المدرعة)
// ==========================================
app.post('/api/parse-pdf', async (req, res) => {
    try {
        const { pdfUrl } = req.body;
        if (!pdfUrl) return res.status(400).json({ error: "مفيش رابط ملف وصل!" });

        console.log("جاري تحميل المذكرة من السحابة...");
        const fileResponse = await fetch(pdfUrl);
        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // 🌟 ده الموديل الوحيد الثابت اللي بيقرأ PDFs حالياً
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const pdfPart = {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType: "application/pdf"
            }
        };

        // 🌟 برومبت صارم جداً عشان ميستهبلش
        const prompt = `أنت مساعد ذكي لخادم مدارس أحد. اقرأ ملف الـ PDF المرفق واستخرج منه جدول الدروس.
        يجب أن ترجع النتيجة بصيغة مصفوفة JSON فقط (JSON Array).
        لا تكتب أي نص قبل أو بعد المصفوفة نهائياً.
        كل درس يجب أن يحتوي على هذه المفاتيح فقط:
        "date": تاريخ الدرس (مثلا 5 مارس أو شهر مارس)
        "title": اسم الدرس
        "goal": هدف الدرس أو الآية الرئيسية
        "page": رقم الصفحة`;

        console.log("جاري قراءة المذكرة بالذكاء الاصطناعي...");
        const result = await model.generateContent([prompt, pdfPart]);
        let responseText = result.response.text();
        
        // تنظيف وحشي لأي كلام زيادة
        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        
        let lessons;
        try {
            lessons = JSON.parse(responseText);
        } catch (jsonError) {
            // لو جيميني اتفلسف ومبعتش JSON صح، هنمسكه هنا بدل ما السيرفر يقع
            console.error("جيميني مبعتش JSON سليم:", responseText);
            return res.status(500).json({
                success: false,
                error: "الذكاء الاصطناعي أرسل بيانات غير مفهومة",
                details: responseText
            });
        }

        res.json({ success: true, lessons: lessons });

    } catch (error) {
        console.error("خطأ عام:", error);
        res.status(500).json({ 
            success: false, 
            error: "فشل الاتصال بالذكاء الاصطناعي", 
            details: error.message 
        });
    }
});

// ==========================================
// 2. مسار التلخيص (شغال طلقة)
// ==========================================
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