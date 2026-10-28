const http = require('http');
const fs = require('fs');
const path = require('path');

// Test against server.js running or spun up in-memory
const { spawn } = require('child_process');

async function runServerTests() {
  console.log('=== RUNNING SERVER API INTEGRATION TESTS ===\n');

  // Start test server on port 8999
  const serverProc = spawn('node', ['server.js', '8999'], { cwd: 'c:/dev/pixel-blasphemy' });
  
  await new Promise(r => setTimeout(r, 1200));

  function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        host: 'localhost',
        port: 8999,
        path: path,
        method: method,
        headers: body ? { 'Content-Type': 'application/json' } : {}
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  let passed = 0;
  let failed = 0;

  function assert(name, cond) {
    if (cond) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}`);
      failed++;
    }
  }

  try {
    // 1. GET /api/palettes
    const r1 = await request('GET', '/api/palettes');
    assert('GET /api/palettes returns 200 and success', r1.status === 200 && r1.data.success === true);
    assert('GET /api/palettes returns array', Array.isArray(r1.data.palettes));

    // 2. POST /api/palettes
    const r2 = await request('POST', '/api/palettes', {
      name: 'Test Server Palette',
      colors: [[255, 0, 0], [0, 255, 0]]
    });
    assert('POST /api/palettes creates palette', r2.status === 200 && r2.data.success === true);
    assert('POST /api/palettes creates GPL and returns palette info', r2.data.palette && r2.data.palette.name === 'Test Server Palette');

    // 3. GET /api/options
    const r3 = await request('GET', '/api/options');
    assert('GET /api/options returns 200 and success', r3.status === 200 && r3.data.success === true);
    assert('GET /api/options returns array', Array.isArray(r3.data.profiles));

    // 4. POST /api/options
    const r4 = await request('POST', '/api/options', {
      name: 'Test Preset',
      options: { brightness: 10, contrast: 5 }
    });
    assert('POST /api/options saves preset', r4.status === 200 && r4.data.success === true);

    // 5. Static file request
    const r5 = await request('GET', '/index.html');
    assert('GET /index.html serves HTML file', r5.status === 200 && r5.raw.includes('<!DOCTYPE html>'));

    // 6. Security 404
    const r6 = await request('GET', '/non_existent_file_xyz.txt');
    assert('GET non-existent file returns 404', r6.status === 404);

  } catch (err) {
    console.error('Server integration test error:', err);
    failed++;
  } finally {
    serverProc.kill();
    // Clean up test palette if created
    const testGpl = 'c:/dev/pixel-blasphemy/temp/saved/palettes/test_server_palette.gpl';
    const testJson = 'c:/dev/pixel-blasphemy/temp/saved/palettes/test_server_palette.json';
    const testPreset = 'c:/dev/pixel-blasphemy/temp/saved/options/test_preset.json';
    if (fs.existsSync(testGpl)) fs.unlinkSync(testGpl);
    if (fs.existsSync(testJson)) fs.unlinkSync(testJson);
    if (fs.existsSync(testPreset)) fs.unlinkSync(testPreset);
  }

  console.log(`\nSERVER TESTS PASSED: ${passed} | FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

runServerTests();
