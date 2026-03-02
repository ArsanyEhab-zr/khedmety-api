const express = require('express');
const cors = require('cors');

const app = express();

// إعدادات استقبال المذكرة التقيلة
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

// ==========================================
// 1. مسار تقسيم الـ PDF (بالـ Fetch المباشر - بدون مكتبات)
// ==========================================
app.post('/api/parse-pdf', async (req, res) => {
    try {
        const { pdfUrl } = req.body;
        if (!pdfUrl) return res.status(400).json({ error: "مفيش رابط ملف وصل!" });

        console.log("جاري تحميل المذكرة من السحابة...");
        const fileResponse = await fetch(pdfUrl);
        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Pdf = buffer.toString("base64");

        const prompt = `أنت مساعد ذكي لخادم مدارس أحد. اقرأ ملف الـ PDF المرفق واستخرج منه جدول الدروس.
        يجب أن ترجع النتيجة بصيغة مصفوفة JSON فقط (JSON Array).
        لا تكتب أي نص قبل أو بعد المصفوفة.
        كل درس يجب أن يحتوي على:
        "date": تاريخ الدرس (مثلا 5 مارس أو شهر مارس)
        "title": اسم الدرس
        "goal": هدف الدرس أو الآية الرئيسية
        "page": رقم الصفحة`;

        console.log("جاري إرسال الطلب لـ Gemini مباشرة...");
        const apiKey = process.env.GEMINI_API_KEY;
        
        // 🌟 الـ Fetch المباشر: بيجبر السيرفر يروح للرابط الصح 100%
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "application/pdf", data: base64Pdf } }
                    ]
                }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await geminiRes.json();

        // لو جوجل رفضت الطلب، هنمسك الإيرور بالتفصيل
        if (!geminiRes.ok) {
            console.error("Gemini API Error:", data);
            return res.status(500).json({ 
                success: false, 
                error: "مفتاح الـ API غير صالح أو الموديل غير مدعوم", 
                details: JSON.stringify(data) 
            });
        }

        const responseText = data.candidates[0].content.parts[0].text;
        const lessons = JSON.parse(responseText);

        res.json({ success: true, lessons: lessons });

    } catch (error) {
        console.error("خطأ عام:", error);
        res.status(500).json({ success: false, error: "فشل عام في السيرفر", details: error.message });
    }
});

// ==========================================
// 2. مسار التلخيص (بالـ Fetch المباشر)
// ==========================================
app.post('/api/summarize-lesson', async (req, res) => {
    try {
        const { title, goal } = req.body;
        const prompt = `أنت خادم مدارس أحد خبير. لخص درس بعنوان "${title}" وهدفه "${goal}" في نقاط تشمل: الفكرة الرئيسية بأسلوب شيق، تطبيق عملي للأطفال، وآية الدرس.`;
        
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await geminiRes.json();
        const responseText = data.candidates[0].content.parts[0].text;
        
        res.json({ success: true, summary: responseText });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = app;