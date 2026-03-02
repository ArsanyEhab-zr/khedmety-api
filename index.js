const express = require('express');
const cors = require('cors');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.options('*', cors());

// ==========================================
// 1. مسار تقسيم الـ PDF (الخطة الدفاعية الشاملة)
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

        const apiKey = process.env.GEMINI_API_KEY;
        
        // 🌟 قايمة بكل الموديلات.. السيرفر هيجربهم كلهم في ثواني لحد ما واحد يشتغل
        const modelsToTry = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-1.5-pro",
            "gemini-1.5-pro-latest",
            "gemini-2.0-flash",
            "gemini-1.5-flash-001",
            "gemini-1.5-flash-002"
        ];

        let data = null;
        let lastError = "";

        // 🌟 لوب الهجوم: هيخبط عليهم واحد واحد
        for (const modelName of modelsToTry) {
            try {
                console.log(`نجرب الموديل: ${modelName}...`);
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
                
                const response = await fetch(url, {
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

                if (response.ok) {
                    data = await response.json();
                    console.log(`✅ الموديل ${modelName} اشتغل بنجاح وتم الاختراق!`);
                    break; // 💥 الموديل اشتغل! نوقف اللوب ونكمل
                } else {
                    const errData = await response.json();
                    lastError = errData.error?.message || "خطأ غير معروف";
                    console.error(`❌ الموديل ${modelName} فشل:`, lastError);
                }
            } catch (e) {
                console.error(`❌ خطأ في الاتصال بالموديل ${modelName}`);
            }
        }

        // لو كل الموديلات فشلت (وده شبه مستحيل يحصل دلوقتي)
        if (!data) {
            return res.status(500).json({ 
                success: false, 
                error: "مفتاح الـ API مغلق عليه كل الموديلات الذكية", 
                details: lastError
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
// 2. مسار التلخيص (نفس خطة الهجوم)
// ==========================================
app.post('/api/summarize-lesson', async (req, res) => {
    try {
        const { title, goal } = req.body;
        const prompt = `أنت خادم مدارس أحد خبير. لخص درس بعنوان "${title}" وهدفه "${goal}" في نقاط تشمل: الفكرة الرئيسية بأسلوب شيق، تطبيق عملي للأطفال، وآية الدرس.`;
        
        const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-2.0-flash"];
        let data = null;

        for (const modelName of modelsToTry) {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            if (response.ok) {
                data = await response.json();
                break;
            }
        }

        if(!data) throw new Error("جميع الموديلات فشلت");

        const responseText = data.candidates[0].content.parts[0].text;
        res.json({ success: true, summary: responseText });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = app;