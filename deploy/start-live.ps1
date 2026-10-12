# Живий сайт на цьому комп'ютері + безкоштовний доступ з інтернету через Cloudflare Tunnel.
# Тимчасове рішення, поки немає сервера: сайт працює, доки увімкнений комп'ютер і відкрите це вікно.
#
#   powershell -ExecutionPolicy Bypass -File deploy\start-live.ps1           # зібрати й запустити
#   powershell -ExecutionPolicy Bypass -File deploy\start-live.ps1 -NoBuild  # запустити без перезбирання
#   ... -NoTunnel  # лише локально, на http://localhost:5200 (для перевірки)
#
# Окремо від розробки: своя база (mamyna_shafa_live), свої фото (data\uploads), свій пароль кабінету
# (secrets\admin-password.txt). Ключ OpenAI береться з user-secrets, як і в розробці.

param([switch]$NoBuild, [switch]$NoTunnel, [int]$Port = 5200)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot\..").Path
$publish = Join-Path $root 'publish\api'
$data = Join-Path $root 'data'
$hashFile = Join-Path $root 'secrets\admin-password-hash.txt'

if (-not (Test-Path $hashFile)) {
    throw "Немає secrets\admin-password-hash.txt. Створіть пароль: dotnet run --project src\SiteMym.Api -- hash-password `"пароль`" > secrets\admin-password-hash.txt"
}

if (-not $NoBuild) {
    Write-Host '== Збираю сайт (client/dist)…' -ForegroundColor Cyan
    npm --prefix (Join-Path $root 'client') run build
    if ($LASTEXITCODE -ne 0) { throw 'npm run build завершився з помилкою' }

    Write-Host '== Публікую API (Release)…' -ForegroundColor Cyan
    dotnet publish (Join-Path $root 'src\SiteMym.Api') -c Release -o $publish --nologo -v q
    if ($LASTEXITCODE -ne 0) { throw 'dotnet publish завершився з помилкою' }
}

New-Item -ItemType Directory -Force (Join-Path $data 'uploads') | Out-Null

$env:ASPNETCORE_ENVIRONMENT = 'Production'
$env:ASPNETCORE_URLS = "http://localhost:$Port"
$env:ConnectionStrings__Database = 'Host=localhost;Port=5432;Database=mamyna_shafa_live;Username=postgres'
$env:Admin__PasswordHash = (Get-Content $hashFile -Raw).Trim()
$env:Storage__LocalPath = Join-Path $data 'uploads'
$env:Client__DistPath = Join-Path $root 'client\dist'

Write-Host "== Запускаю сайт на http://localhost:$Port…" -ForegroundColor Cyan
$api = Start-Process -FilePath (Join-Path $publish 'SiteMym.Api.exe') -WorkingDirectory $publish -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $data 'api.log') -RedirectStandardError (Join-Path $data 'api-errors.log')

try {
    $ok = $false
    foreach ($i in 1..40) {
        Start-Sleep -Milliseconds 500
        try {
            if ((Invoke-WebRequest "http://localhost:$Port/api/health" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { $ok = $true; break }
        } catch { }
        if ($api.HasExited) { break }
    }
    if (-not $ok) { throw "Сайт не запустився — дивіться data\api.log і data\api-errors.log" }
    Write-Host "== Сайт працює: http://localhost:$Port (кабінет: /admin)" -ForegroundColor Green

    if ($NoTunnel) {
        Write-Host 'Натисніть Enter, щоб зупинити.'
        [void](Read-Host)
        return
    }

    if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
        throw 'Немає cloudflared. Встановіть: winget install --id Cloudflare.cloudflared, і відкрийте нове вікно PowerShell.'
    }

    Write-Host ''
    Write-Host '== Відкриваю доступ з інтернету. Адреса з’явиться нижче — рядок із https://….trycloudflare.com' -ForegroundColor Cyan
    Write-Host '   Адреса змінюється при кожному запуску. Щоб зупинити — Ctrl+C.' -ForegroundColor Yellow
    cloudflared tunnel --no-autoupdate --url "http://localhost:$Port"
}
finally {
    if (-not $api.HasExited) { Stop-Process -Id $api.Id -Force }
    Write-Host '== Сайт зупинено.'
}
