const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = path.resolve(__dirname);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.apk': 'application/vnd.android.package-archive',
    '.part0': 'application/octet-stream',
    '.part1': 'application/octet-stream',
    '.part2': 'application/octet-stream',
    '.part3': 'application/octet-stream',
    '.part4': 'application/octet-stream',
    '.part5': 'application/octet-stream',
    '.part6': 'application/octet-stream',
    '.part7': 'application/octet-stream',
};

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') {
        reqPath = '/apk.html';
    }

    const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(ROOT, safePath);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // If file doesn't exist, try serving apk.html as fallback
            const fallbackPath = path.join(ROOT, 'apk.html');
            fs.readFile(fallbackPath, (err2, data) => {
                if (err2) {
                    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('404 Not Found');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(data);
                }
            });
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stats.size,
            'Cache-Control': 'no-cache',
        });

        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
