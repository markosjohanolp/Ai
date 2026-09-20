// api/proxy.js
// ============================================================
// Vercel Serverless Function — وسيط بين Mini App و Serv00
// ============================================================

const SERV00_URL = 'http://gfdxf.serv00.net:12731';

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data');

    // Preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // المسار المطلوب (بعد /api)
    let endpoint = req.url.replace(/^\/api/, '');
    if (!endpoint.startsWith('/')) {
        endpoint = '/' + endpoint;
    }

    // الـ URL الكامل على Serv00
    const targetUrl = `${SERV00_URL}/api${endpoint}`;

    try {
        // جهّز الـ headers
        const headers = {
            'Content-Type': 'application/json',
        };

        // مرّر X-Telegram-Init-Data
        if (req.headers['x-telegram-init-data']) {
            headers['X-Telegram-Init-Data'] = req.headers['x-telegram-init-data'];
        }

        // جهّز الـ body للـ POST
        let body = null;
        if (req.method === 'POST') {
            body = JSON.stringify(req.body || {});
        }

        // أرسل الطلب لـ Serv00
        const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            body,
        });

        // اقرأ الرد
        const data = await response.text();

        // رجّع الرد
        res.status(response.status);
        res.setHeader('Content-Type', 'application/json');
        return res.send(data);

    } catch (error) {
        console.error('[proxy]', error);
        return res.status(500).json({
            ok: false,
            error: `Proxy error: ${error.message}`
        });
    }
};
