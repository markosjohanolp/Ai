// api/proxy.js
// ============================================================
// Vercel Serverless Function — وسيط بين Mini App و Serv00
// ============================================================

const SERV00_URL = 'http://gfdxf.serv00.net:12731';

// Helper: اقرأ الـ body
function getRequestBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            resolve(body || null);
        });
    });
}

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // المسار: Vercel يعطينا req.url مثل /stats أو /channels
    // نضيف /api قبلها
    let path = req.url;
    if (path.startsWith('/api')) {
        path = path.substring(4);
    }
    if (!path.startsWith('/')) {
        path = '/' + path;
    }

    const targetUrl = `${SERV00_URL}/api${path}`;

    try {
        // Headers
        const headers = {
            'Content-Type': 'application/json',
        };
        if (req.headers['x-telegram-init-data']) {
            headers['X-Telegram-Init-Data'] = req.headers['x-telegram-init-data'];
        }

        // Body
        let body = null;
        if (req.method === 'POST' || req.method === 'PUT') {
            body = await getRequestBody(req);
        }

        // الطلب
        const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            body: body,
        });

        const data = await response.text();

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
