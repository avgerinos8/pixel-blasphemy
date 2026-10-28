@echo off
title PixelBlasphemy Studio
cd /d "%~dp0"

echo ===================================================
echo           PIXELBLASPHEMY STUDIO LAUNCHER
echo ===================================================
echo.

:: 1. Try Node.js first (full backend features + disk saving)
where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [OK] Node.js detected. Starting studio server on port 8080...
    timeout /t 1 >nul
    start "" http://localhost:8080/
    node server.js 8080
    goto end
)

:: 2. Try Python next
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [OK] Python detected. Starting static server on port 8080...
    timeout /t 1 >nul
    start "" http://localhost:8080/
    python -m http.server 8080 --directory app
    goto end
)

:: 3. Zero-dependency native Windows PowerShell HTTP server fallback
echo [INFO] No Node.js or Python detected.
echo [OK] Launching with native Windows PowerShell webserver (Zero dependencies)...
timeout /t 1 >nul
start "" http://localhost:8080/
powershell -NoProfile -ExecutionPolicy Bypass -Command "$listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:8080/'); $listener.Start(); Write-Host 'PixelBlasphemy Studio is running at http://localhost:8080/ (Close this window to stop)...'; while ($listener.IsListening) { $ctx = $listener.GetContext(); $req = $ctx.Request; $res = $ctx.Response; $rel = $req.Url.LocalPath.TrimStart('/'); if (!$rel) { $rel = 'index.html' }; $file = Join-Path 'app' $rel; if (Test-Path $file -PathType Leaf) { $bytes = [IO.File]::ReadAllBytes($file); $ext = [IO.Path]::GetExtension($file); $mime = switch ($ext) { '.html' {'text/html; charset=utf-8'} '.css' {'text/css; charset=utf-8'} '.js' {'application/javascript; charset=utf-8'} '.json' {'application/json; charset=utf-8'} '.png' {'image/png'} '.wasm' {'application/wasm'} default {'application/octet-stream'} }; $res.ContentType = $mime; $res.ContentLength64 = $bytes.Length; $res.OutputStream.Write($bytes, 0, $bytes.Length) } else { $res.StatusCode = 404 }; $res.OutputStream.Close() }"

:end
