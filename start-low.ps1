$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$log = Join-Path $root "bot.log"
$errLog = Join-Path $root "bot-error.log"
$sessionDir = (Join-Path $root ".wwebjs_auth") -replace "\\", "\"

$existing = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match "index\.js" })
if ($existing.Count -gt 0) {
  Write-Host "Ya hay un proceso del bot corriendo (PIDs: $($existing.ProcessId -join ',')). Detenelo antes."
  exit 1
}

$proc = Start-Process -FilePath "node" -ArgumentList @("index.js") -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $errLog -PassThru

try {
  $proc.PriorityClass = "BelowNormal"
  Write-Host "Bot iniciado. Prioridad node: BelowNormal"
} catch {
  Write-Host "No se pudo bajar la prioridad de node: $($_.Exception.Message)"
}

function Set-BotChromeBelowNormal {
  Get-Process chrome -ErrorAction SilentlyContinue | Where-Object {
    try { $_.Path } catch { return $false }
    try {
      (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine -match "wwebjs_auth"
    } catch { return $false }
  } | ForEach-Object {
    try {
      if ($_.PriorityClass -ne "BelowNormal") {
        $_.PriorityClass = "BelowNormal"
        Write-Host ("[chrome $($_.Id)] -> BelowNormal")
      }
    } catch { }
  }
}

while (-not $proc.HasExited) {
  Set-BotChromeBelowNormal
  Start-Sleep -Seconds 10
}
Write-Host "El bot terminÃ³. Revisa $errLog si terminÃ³ con error."
