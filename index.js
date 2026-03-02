const express = require('express');
const pdfParse = require('pdf-parse');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 🌟 ميدان الـ CORS المدرع (علشان المتصفح ميبكيش)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.post('/api/parse-pdf', async (req, res) => {
    try {
        const { pdfUrl } = req.body;
        if (!pdfUrl) return res.status(400).json({ error: "مفيش رابط" });

        const fileResponse = await fetch(pdfUrl);
        const buffer = Buffer.from(await fileResponse.arrayBuffer());

        const pdfData = await pdfParse(buffer);
        const extractedText = pdfData.text.substring(0, 20000); // قللنا الحروف للسرعة

        const prompt = `أنت مساعد ذكي. اقرأ النص واستخرج جدول الدروس كمصفوفة JSON فقط.
        مطلوب لكل درس: "date", "title", "goal", "page".
        النص: ${extractedText}`;

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "llama3-70b-8192",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1
            })
        });

        const data = await groqRes.json();
        let responseText = data.choices[0].message.content;
        
        const jsonStart = responseText.indexOf('[');
        const jsonEnd = responseText.lastIndexOf(']') + 1;
        const cleanJson = responseText.slice(jsonStart, jsonEnd);

        res.json({ success: true, lessons: JSON.parse(cleanJson) });
    } catch (error) {
        console.error(error);
        // حتى لو فشل هيبعتلك إيرور سليم مش CORS
        res.status(500).json({ success: false, error: "فشل السيرفر", details: error.message });
    }
});

module.exports = app;