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

// ==========================================
// 1. مسار تقسيم الـ PDF (النسخة المدرعة)
// ==========================================
app.post('/api/parse-pdf', async (req, res) => {
    try {
        const { pdfUrl } = req.body;
        if (!pdfUrl) return res.status(400).json({ error: "مفيش رابط ملف وصل!" });

        console.log("جاري تحميل الملف من اللينك...");
        const fileResponse = await fetch(pdfUrl);
        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // 🌟 السر هنا: بنجبره يرجع JSON بس بدون أي فلكسة أو كلام زيادة
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json" } 
        });

        const pdfPart = {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType: "application/pdf"
            }
        };

        // 🌟 ظبطنا البرومبت عشان ميتلخبطش لو ملقاش تواريخ
        const prompt = `أنت مساعد ذكي. هذا ملف PDF يحتوي على منهج مدارس الأحد.
        استخرج جدول الدروس ورجعه بصيغة JSON Array فقط.
        العناصر المطلوبة لكل درس:
        - date: تاريخ الدرس (إذا لم تجد تاريخ محدد، اكتب الشهر مثلا 'مارس' أو رقم الدرس)
        - title: عنوان الدرس (مثل: رموز الصليب، الابن الضال، إلخ)
        - goal: هدف الدرس أو الآية
        - page: رقم الصفحة الموجود بها الدرس`;

        console.log("جاري إرسال الملف للذكاء الاصطناعي...");
        const result = await model.generateContent([prompt, pdfPart]);
        const responseText = result.response.text();
        
        console.log("رد الذكاء الاصطناعي:", responseText);
        const lessons = JSON.parse(responseText);

        res.json({ success: true, lessons: lessons });
    } catch (error) {
        console.error("خطأ قاتل:", error);
        // 🌟 هنا بقى لو حصل إيرور هيبعتلك سببه بالظبط عشان نعرفه
        res.status(500).json({ 
            success: false, 
            error: "فشل الذكاء الاصطناعي في التقسيم",
            details: error.message || error.toString() // السطر ده هيكشفلنا المستور
        });
    }
});

// ==========================================
// 2. مسار التلخيص 
// ==========================================
app.post('/api/summarize-lesson', async (req, res) => {
    try {
        const { title, goal } = req.body;
        if (!title) return res.status(400).json({ success: false, error: "اسم الدرس مش موجود" });

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

module.exports = app;