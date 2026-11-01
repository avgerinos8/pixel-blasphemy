// PixelBlasphemy Studio - Dedicated Local Server with GPL Palettes & Options API
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { spawnSync } = require('child_process');

const PORT = parseInt(process.argv[2], 10) || parseInt(process.env.PORT, 10) || 8080;
const STATIC_DIR = path.join(__dirname, 'app');
const SAVED_PALETTES_DIR = path.join(__dirname, 'temp', 'saved', 'palettes');
const SAVED_OPTIONS_DIR = path.join(__dirname, 'temp', 'saved', 'options');
const TEMP_UPSCALE_DIR = path.join(__dirname, 'temp', 'upscale');

// Ensure storage directories exist
fs.mkdirSync(SAVED_PALETTES_DIR, { recursive: true });
fs.mkdirSync(SAVED_OPTIONS_DIR, { recursive: true });
fs.mkdirSync(TEMP_UPSCALE_DIR, { recursive: true });

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

function findRealEsrganBin() {
  const candidates = [
    path.join(__dirname, 'tools', 'realesrgan', 'realesrgan-ncnn-vulkan.exe'),
    path.resolve(__dirname, '..', 'StreetsOfRegex', 'tools', 'realesrgan', 'realesrgan-ncnn-vulkan.exe'),
    'realesrgan-ncnn-vulkan.exe',
    'realesrgan-ncnn-vulkan'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function findModelsDir(realesrganBin) {
  if (realesrganBin) {
    const parentDir = path.dirname(realesrganBin);
    const models = path.join(parentDir, 'models');
    if (fs.existsSync(models)) return models;
  }
  const fallback = path.join(__dirname, 'tools', 'realesrgan', 'models');
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

function findRembgBin() {
  const candidates = [
    path.resolve(__dirname, '..', 'StreetsOfRegex', '.venv', 'Scripts', 'rembg.exe'),
    'rembg'
  ];
  for (const c of candidates) {
    if (c === 'rembg') {
      try {
        const res = spawnSync('where.exe', ['rembg'], { encoding: 'utf-8' });
        if (res.status === 0 && res.stdout.trim()) {
          return res.stdout.trim().split(/\r?\n/)[0];
        }
      } catch (e) {}
    } else if (fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

function findMagickBin() {
  const candidates = [
    'magick',
    'C:\\Program Files\\ImageMagick-7.1.2-Q16-HDRI\\magick.exe',
    'C:\\Program Files\\ImageMagick-7.1.1-Q16-HDRI\\magick.exe'
  ];
  for (const c of candidates) {
    if (c === 'magick') {
      try {
        const res = spawnSync('where.exe', ['magick'], { encoding: 'utf-8' });
        if (res.status === 0 && res.stdout.trim()) {
          return res.stdout.trim().split(/\r?\n/)[0];
        }
      } catch (e) {}
    } else if (fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

function runCmd(bin, args) {
  const res = spawnSync(bin, args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (res.status !== 0) {
    throw new Error(`Command failed: ${bin} ${args.join(' ')}\n${res.stderr || res.stdout}`);
  }
  if (res.stderr) {
    if (res.stderr.includes('vkQueueSubmit failed') || res.stderr.includes('vkWaitForFences failed')) {
      throw new Error(`Vulkan GPU failure: ${res.stderr.trim()}`);
    }
    if (res.stderr.includes('encode image') && res.stderr.includes('failed')) {
      throw new Error(`Image encoding failure: ${res.stderr.trim()}`);
    }
  }
  return res;
}

function getScalePasses(scale) {
  const s = Math.round(scale);
  if (s <= 2) return [2];
  if (s === 3) return [3];
  if (s === 4) return [4];
  if (s === 6) return [3, 2];
  if (s === 8) return [4, 2];
  if (s === 9) return [3, 3];
  if (s === 10) return [4, 3];
  if (s === 12) return [4, 3];
  if (s === 14) return [4, 4];
  if (s === 16) return [4, 4];
  if (s === 20) return [4, 4];
  if (s === 24) return [4, 3, 2];
  if (s === 32) return [4, 4, 2];
  if (s === 48) return [4, 4, 3];

  const passes = [];
  let rem = s;
  while (rem >= 4) {
    passes.push(4);
    rem = Math.round(rem / 4);
  }
  if (rem >= 2) {
    passes.push(rem);
  }
  return passes.length > 0 ? passes : [4];
}

function verifyOutputFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Output file was not created: ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (stat.size < 100) {
    throw new Error(`Output file is abnormally small (${stat.size} bytes): ${filePath}`);
  }
}

function upscaleImage(realesrganBin, modelsDir, srcPath, destPath, scale = 4, model = 'realesrgan-x4plus-anime') {
  const passes = getScalePasses(scale);

  if (passes.length === 1) {
    runCmd(realesrganBin, [
      '-i', srcPath,
      '-o', destPath,
      '-s', String(passes[0]),
      '-n', model,
      '-m', modelsDir,
      '-t', '400'
    ]);
    verifyOutputFile(destPath);
    return;
  }

  let currentSrc = srcPath;
  const tmpFiles = [];

  for (let i = 0; i < passes.length; i++) {
    const isLast = (i === passes.length - 1);
    const passDest = isLast
      ? destPath
      : destPath.replace(/\.png$/i, `_tmp_pass_${i}.png`);

    if (!isLast) {
      tmpFiles.push(passDest);
    }

    runCmd(realesrganBin, [
      '-i', currentSrc,
      '-o', passDest,
      '-s', String(passes[i]),
      '-n', model,
      '-m', modelsDir,
      '-t', '400'
    ]);

    currentSrc = passDest;
  }

  for (const tmp of tmpFiles) {
    if (fs.existsSync(tmp)) try { fs.unlinkSync(tmp); } catch (e) {}
  }

  verifyOutputFile(destPath);
}

function removeBackgroundAndTrim(srcPath, destPath) {
  const rembgBin = findRembgBin();
  const magickBin = findMagickBin();

  if (rembgBin && magickBin) {
    const tmpNobg = destPath.replace(/\.png$/i, '_tmp_nobg.png');
    runCmd(rembgBin, ['i', '-m', 'birefnet-general', srcPath, tmpNobg]);
    runCmd(magickBin, [tmpNobg, '-trim', '+repage', destPath]);
    if (fs.existsSync(tmpNobg)) try { fs.unlinkSync(tmpNobg); } catch (e) {}
    if (fs.existsSync(destPath)) return;
  } else if (rembgBin) {
    runCmd(rembgBin, ['i', '-m', 'birefnet-general', srcPath, destPath]);
    if (fs.existsSync(destPath)) return;
  }

  // Fallback: copy upscaled file directly if neural rembg is not installed
  fs.copyFileSync(srcPath, destPath);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 100 * 1024 * 1024) { // 100MB limit for high-res base64 crops
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

  // API ROUTE: GET /api/system-status or GET /api/upscale/status
  if (req.method === 'GET' && (pathname === '/api/system-status' || pathname === '/api/upscale/status')) {
    try {
      const realEsrganBin = findRealEsrganBin();
      const modelsDir = findModelsDir(realEsrganBin);
      const rembgBin = findRembgBin();
      const magickBin = findMagickBin();

      return sendJSON(res, 200, {
        success: true,
        hasRealEsrgan: Boolean(realEsrganBin),
        realEsrganBin: realEsrganBin || null,
        modelsDir: modelsDir || null,
        hasRembg: Boolean(rembgBin),
        hasMagick: Boolean(magickBin),
        gpu: realEsrganBin ? 'Real-ESRGAN Vulkan GPU (Local Machine Acceleration)' : null
      });
    } catch (err) {
      console.error('[API /api/upscale/status] Error:', err);
      return sendJSON(res, 500, { success: false, error: err.message });
    }
  }

  // API ROUTE: POST /api/upscale
  if (req.method === 'POST' && pathname === '/api/upscale') {
    try {
      const realEsrganBin = findRealEsrganBin();
      const modelsDir = findModelsDir(realEsrganBin);
      if (!realEsrganBin) {
        return sendJSON(res, 400, {
          success: false,
          error: 'Real-ESRGAN Vulkan binary not found on local computer'
        });
      }

      const body = await parseBody(req);
      const rawImage = body.image;
      if (!rawImage) {
        return sendJSON(res, 400, { success: false, error: 'No image data provided' });
      }

      const scale = parseFloat(body.scale) || 4;
      const isOpaque = Boolean(body.isOpaque);
      const name = (body.name || 'crop').trim();
      const model = body.model || 'realesrgan-x4plus-anime';

      let base64Data = rawImage;
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }
      const imgBuffer = Buffer.from(base64Data, 'base64');

      const uid = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const inPath = path.join(TEMP_UPSCALE_DIR, `input_${uid}.png`);
      const upscaledPath = path.join(TEMP_UPSCALE_DIR, `upscaled_${uid}.png`);
      const finalDestPath = path.join(TEMP_UPSCALE_DIR, `final_${uid}.png`);

      fs.writeFileSync(inPath, imgBuffer);

      // Multi-pass Real-ESRGAN Vulkan GPU upscale
      upscaleImage(realEsrganBin, modelsDir, inPath, upscaledPath, scale, model);

      if (isOpaque) {
        // Skip background removal completely (preserves solid pixels)
        fs.copyFileSync(upscaledPath, finalDestPath);
      } else {
        // Automatically run background removal and trimming
        removeBackgroundAndTrim(upscaledPath, finalDestPath);
      }

      const outBuffer = fs.readFileSync(finalDestPath);
      const outDataUrl = `data:image/png;base64,${outBuffer.toString('base64')}`;

      // Clean up temp files
      [inPath, upscaledPath, finalDestPath].forEach(f => {
        if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch (e) {}
      });

      const cleanName = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const opaquePrefix = isOpaque ? 'opaque_' : '';
      const scaleStr = Number.isInteger(scale) ? scale.toString() : parseFloat(scale.toFixed(2)).toString();
      const filename = `${scaleStr}x_${opaquePrefix}${cleanName}.png`;

      return sendJSON(res, 200, {
        success: true,
        filename,
        scale,
        isOpaque,
        dataUrl: outDataUrl,
        size: outBuffer.length
      });
    } catch (err) {
      console.error('[API POST /api/upscale] Error:', err);
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
