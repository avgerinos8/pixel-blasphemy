// PixelBlasphemy Studio - Dedicated Local Server with GPL Palettes & Options API
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.argv[2], 10) || parseInt(process.env.PORT, 10) || 8080;
const STATIC_DIR = path.join(__dirname, 'app');
const SAVED_PALETTES_DIR = path.join(__dirname, 'temp', 'saved', 'palettes');
const SAVED_OPTIONS_DIR = path.join(__dirname, 'temp', 'saved', 'options');

// Ensure storage directories exist
fs.mkdirSync(SAVED_PALETTES_DIR, { recursive: true });
fs.mkdirSync(SAVED_OPTIONS_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.gpl': 'text/plain; charset=utf-8'
};

function parseGPL(content, filename) {
  const lines = content.split(/\r?\n/);
  let name = path.basename(filename, '.gpl');
  const colors = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.toLowerCase().startsWith('name:')) {
      name = line.substring(5).trim();
      continue;
    }
    if (line.startsWith('#') || line.startsWith('GIMP') || line.toLowerCase().startsWith('columns:')) {
      continue;
    }
    // Match 3 integers: R G B
    const match = line.match(/^(\d+)\s+(\d+)\s+(\d+)/);
    if (match) {
      colors.push([
        Math.min(255, Math.max(0, parseInt(match[1]))),
        Math.min(255, Math.max(0, parseInt(match[2]))),
        Math.min(255, Math.max(0, parseInt(match[3])))
      ]);
    }
  }

  return { name, colors };
}

function generateGPL(name, colors) {
  let gpl = `GIMP Palette\nName: ${name}\nColumns: 8\n#\n`;
  for (let c of colors) {
    const r = Math.min(255, Math.max(0, Math.round(c[0])));
    const g = Math.min(255, Math.max(0, Math.round(c[1])));
    const b = Math.min(255, Math.max(0, Math.round(c[2])));
    const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    gpl += `${r.toString().padStart(3, ' ')} ${g.toString().padStart(3, ' ')} ${b.toString().padStart(3, ' ')}\t${hex}\n`;
  }
  return gpl;
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // API ROUTE: GET /api/palettes
  if (req.method === 'GET' && pathname === '/api/palettes') {
    try {
      const files = fs.readdirSync(SAVED_PALETTES_DIR);
      const palettes = [];

      for (let file of files) {
        const filePath = path.join(SAVED_PALETTES_DIR, file);
        if (file.endsWith('.gpl')) {
          const content = fs.readFileSync(filePath, 'utf8');
          const parsed = parseGPL(content, file);
          const id = path.basename(file, '.gpl');
          palettes.push({
            id: 'saved_' + id,
            name: parsed.name || id,
            filename: file,
            colors: parsed.colors
          });
        } else if (file.endsWith('.json')) {
          const gplTwin = file.replace('.json', '.gpl');
          if (!files.includes(gplTwin)) {
            try {
              const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              palettes.push({
                id: 'saved_' + path.basename(file, '.json'),
                name: data.name || path.basename(file, '.json'),
                filename: file,
                colors: data.colors || []
              });
            } catch (e) {}
          }
        }
      }
      return sendJSON(res, 200, { success: true, palettes });
    } catch (err) {
      console.error('[API /api/palettes] Error:', err);
      return sendJSON(res, 500, { success: false, error: err.message });
    }
  }

  // API ROUTE: POST /api/palettes
  if (req.method === 'POST' && pathname === '/api/palettes') {
    try {
      const body = await parseBody(req);
      const rawName = (body.name || 'custom_palette').trim();
      const safeId = rawName.replace(/[^a-zA-Z0-9_\-\u0370-\u03FF]/g, '_').toLowerCase() || 'palette';
      const colors = Array.isArray(body.colors) ? body.colors : [];

      if (colors.length === 0) {
        return sendJSON(res, 400, { success: false, error: 'Cannot save empty palette' });
      }

      const gplContent = generateGPL(rawName, colors);
      const gplPath = path.join(SAVED_PALETTES_DIR, `${safeId}.gpl`);
      const jsonPath = path.join(SAVED_PALETTES_DIR, `${safeId}.json`);

      fs.writeFileSync(gplPath, gplContent, 'utf8');
      fs.writeFileSync(jsonPath, JSON.stringify({ name: rawName, id: safeId, colors, savedAt: new Date().toISOString() }, null, 2), 'utf8');

      return sendJSON(res, 200, {
        success: true,
        palette: {
          id: 'saved_' + safeId,
          name: rawName,
          filename: `${safeId}.gpl`,
          colors
        }
      });
    } catch (err) {
      console.error('[API POST /api/palettes] Error:', err);
      return sendJSON(res, 500, { success: false, error: err.message });
    }
  }

  // API ROUTE: GET /api/options
  if (req.method === 'GET' && pathname === '/api/options') {
    try {
      const files = fs.readdirSync(SAVED_OPTIONS_DIR);
      const profiles = [];

      for (let file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(SAVED_OPTIONS_DIR, file);
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            profiles.push({
              id: path.basename(file, '.json'),
              name: data.name || path.basename(file, '.json'),
              filename: file,
              savedAt: data.savedAt || null,
              options: data.options || data
            });
          } catch (e) {}
        }
      }
      return sendJSON(res, 200, { success: true, profiles });
    } catch (err) {
      console.error('[API /api/options] Error:', err);
      return sendJSON(res, 500, { success: false, error: err.message });
    }
  }

  // API ROUTE: POST /api/options
  if (req.method === 'POST' && pathname === '/api/options') {
    try {
      const body = await parseBody(req);
      const rawName = (body.name || 'preset_' + Date.now()).trim();
      const safeId = rawName.replace(/[^a-zA-Z0-9_\-\u0370-\u03FF]/g, '_').toLowerCase() || 'preset';
      const options = body.options || {};

      const filePath = path.join(SAVED_OPTIONS_DIR, `${safeId}.json`);
      fs.writeFileSync(filePath, JSON.stringify({ name: rawName, id: safeId, options, savedAt: new Date().toISOString() }, null, 2), 'utf8');

      return sendJSON(res, 200, {
        success: true,
        profile: {
          id: safeId,
          name: rawName,
          filename: `${safeId}.json`,
          options
        }
      });
    } catch (err) {
      console.error('[API POST /api/options] Error:', err);
      return sendJSON(res, 500, { success: false, error: err.message });
    }
  }

  // STATIC FILE SERVING FROM app/
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(STATIC_DIR, reqPath);

  // Security check: stay within STATIC_DIR
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`[PixelBlasphemy Studio] Server listening at http://localhost:${PORT}`);
});
