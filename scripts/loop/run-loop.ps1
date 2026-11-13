<#
  Label Manager loop verification runner (docs/loop-engineering.md §5).
  Starts an ISOLATED copy of the app (temp working dir => temp SQLite file, port 18080),
  drives it with headless Chrome through the DevTools protocol, and writes a JSON report.

  Usage:
    powershell -ExecutionPolicy Bypass -File scripts/loop/run-loop.ps1 -Ops 120 -Seed 1
#>
param(
  [int]$Ops = 120,
  [int]$Seed = 1,
  [int]$Chunk = 30,          # ops between page reloads (OP-14)
  [int]$Port = 18080,
  [int]$CdpPort = 19222,
  [int]$Width = 1280,        # viewport width (390 = phone layout)
  [switch]$SkipBuild,
  [switch]$KeepData
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$outDir = Join-Path $root 'target\loop'
New-Item -ItemType Directory -Force $outDir | Out-Null
$work = Join-Path $outDir "run-$Seed"
if ((Test-Path $work) -and -not $KeepData) { Remove-Item -Recurse -Force $work }
New-Item -ItemType Directory -Force $work | Out-Null
$profileDir = Join-Path $work 'chrome-profile'

if (-not $SkipBuild) {
  Write-Host '[loop] building jar...'
  Push-Location $root
  & mvn -q -DskipTests package
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'mvn package failed' }
  Pop-Location
}
$jar = Get-ChildItem (Join-Path $root 'target') -Filter 'label-manager-*.jar' | Where-Object { $_.Name -notlike '*.original' } | Select-Object -First 1
if (-not $jar) { throw 'jar not found' }

$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw 'Chrome/Edge not found' }

$app = $null; $browser = $null; $ws = $null
$report = [ordered]@{ seed = $Seed; ops = $Ops; started = (Get-Date).ToString('s'); chunks = @(); phaseErrors = @(); cdpExceptions = @() }

function Wait-Http($url, $seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $url | Out-Null; return } catch { Start-Sleep -Milliseconds 300 }
  }
  throw "timeout waiting for $url"
}

$script:cdpId = 0
function Cdp-Send([string]$method, $params = @{}) {
  $script:cdpId++
  $id = $script:cdpId
  $msg = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Depth 20 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($msg)
  $seg = New-Object 'System.ArraySegment[byte]' (, $bytes)
  $ws.SendAsync($seg, 'Text', $true, [Threading.CancellationToken]::None).Wait()
  $buf = New-Object byte[] 1048576
  while ($true) {
    $ms = New-Object IO.MemoryStream
    do {
      $rseg = New-Object 'System.ArraySegment[byte]' (, $buf)
      $task = $ws.ReceiveAsync($rseg, [Threading.CancellationToken]::None)
      if (-not $task.Wait(600000)) { throw "CDP timeout on $method" }
      $ms.Write($buf, 0, $task.Result.Count)
    } while (-not $task.Result.EndOfMessage)
    $text = [Text.Encoding]::UTF8.GetString($ms.ToArray())
    $obj = $text | ConvertFrom-Json
    if ($obj.method -eq 'Runtime.exceptionThrown') {
      $script:report.cdpExceptions += $obj.params.exceptionDetails.exception.description
    }
    if ($obj.id -eq $id) {
      if ($obj.error) { throw "CDP $method error: $($obj.error.message)" }
      return $obj.result
    }
  }
}
function Eval-Js([string]$expr) {
  $r = Cdp-Send 'Runtime.evaluate' @{ expression = $expr; awaitPromise = $true; returnByValue = $true }
  if ($r.exceptionDetails) { throw "JS exception: $($r.exceptionDetails.exception.description)" }
  return $r.result.value
}
function Load-Page {
  Cdp-Send 'Page.navigate' @{ url = "http://127.0.0.1:$Port/" } | Out-Null
  $null = Eval-Js "new Promise(r => { const t = () => (document.readyState === 'complete' && document.querySelector('#theme-switch')) ? setTimeout(r, 600) : setTimeout(t, 50); t(); })"
  $harness = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'ui-loop.js')
  $null = Eval-Js $harness
}
function Mouse($type, $x, $y, $buttons = 1) {
  Cdp-Send 'Input.dispatchMouseEvent' @{ type = $type; x = $x; y = $y; button = 'left'; buttons = $buttons; clickCount = 1 } | Out-Null
}
function Theme { Eval-Js "document.documentElement.getAttribute('data-theme')" }

try {
  Write-Host "[loop] starting isolated app on :$Port (data dir $work)"
  $app = Start-Process -FilePath 'java' -ArgumentList @('-jar', "`"$($jar.FullName)`"", "--server.port=$Port", '--server.address=127.0.0.1') `
    -WorkingDirectory $work -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $work 'app.out.log') -RedirectStandardError (Join-Path $work 'app.err.log')
  Wait-Http "http://127.0.0.1:$Port/api/shelves" 90

  $browser = Start-Process -FilePath $chrome -PassThru -ArgumentList @(
    '--headless=new', "--remote-debugging-port=$CdpPort", "--user-data-dir=`"$profileDir`"",
    "--window-size=$Width,2400", '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank')
  Wait-Http "http://127.0.0.1:$CdpPort/json/version" 30
  $target = (Invoke-RestMethod "http://127.0.0.1:$CdpPort/json") | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
  Cdp-Send 'Page.enable' | Out-Null
  Cdp-Send 'Runtime.enable' | Out-Null
  Cdp-Send 'Emulation.setDeviceMetricsOverride' @{ width = $Width; height = 2400; deviceScaleFactor = 1; mobile = $false } | Out-Null
  Load-Page

  # ---- Phase A: real-input theme switch checks (trusted events, OP-13) ----
  Write-Host '[loop] phase A: theme switch with real mouse/keyboard input'
  $rect = Eval-Js "(() => { const r = document.querySelector('#theme-switch').getBoundingClientRect(); return {x:r.left, y:r.top, w:r.width, h:r.height}; })()"
  $cy = $rect.y + $rect.h / 2
  $t0 = Theme
  Mouse 'mousePressed' ($rect.x + $rect.w / 2) $cy; Mouse 'mouseReleased' ($rect.x + $rect.w / 2) $cy 0
  Start-Sleep -Milliseconds 500
  $t1 = Theme
  if ($t1 -eq $t0) { $report.phaseErrors += "A1 click did not toggle ($t0)" }
  # drag knob across (should toggle exactly once, the trailing click must be suppressed)
  $from = if ($t1 -eq 'dark') { $rect.x + $rect.w - 14 } else { $rect.x + 14 }
  $to   = if ($t1 -eq 'dark') { $rect.x + 3 } else { $rect.x + $rect.w - 3 }
  Mouse 'mousePressed' $from $cy
  for ($i = 1; $i -le 6; $i++) { Mouse 'mouseMoved' ($from + ($to - $from) * $i / 6) $cy }
  Mouse 'mouseReleased' $to $cy 0
  Start-Sleep -Milliseconds 600
  $t2 = Theme
  if ($t2 -eq $t1) { $report.phaseErrors += "A2 drag did not toggle ($t1)" }
  # short drag (< half) should snap back without change
  $from = if ($t2 -eq 'dark') { $rect.x + $rect.w - 14 } else { $rect.x + 14 }
  $mid  = if ($t2 -eq 'dark') { $from - 8 } else { $from + 8 }
  Mouse 'mousePressed' $from $cy; Mouse 'mouseMoved' $mid $cy; Mouse 'mouseReleased' $mid $cy 0
  Start-Sleep -Milliseconds 600
  $t3 = Theme
  if ($t3 -ne $t2) { $report.phaseErrors += "A3 short drag changed theme ($t2 -> $t3)" }
  # keyboard: focus + Space
  $null = Eval-Js "document.querySelector('#theme-switch').focus()"
  Cdp-Send 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32; text = ' ' } | Out-Null
  Cdp-Send 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Start-Sleep -Milliseconds 400
  $t4 = Theme
  if ($t4 -eq $t3) { $report.phaseErrors += "A4 Space did not toggle ($t3)" }
  Cdp-Send 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = 'Enter'; code = 'Enter'; windowsVirtualKeyCode = 13; text = "`r" } | Out-Null
  Cdp-Send 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = 'Enter'; code = 'Enter'; windowsVirtualKeyCode = 13 } | Out-Null
  Start-Sleep -Milliseconds 400
  $t5 = Theme
  if ($t5 -eq $t4) { $report.phaseErrors += "A5 Enter did not toggle ($t4)" }
  # screenshots of both themes
  foreach ($th in @('light', 'dark')) {
    $null = Eval-Js "(() => { if (document.documentElement.getAttribute('data-theme') !== '$th') document.querySelector('#theme-switch').click(); })()"
    Start-Sleep -Milliseconds 900
    $shot = Cdp-Send 'Page.captureScreenshot' @{ format = 'png'; clip = @{ x = 0; y = 0; width = $Width; height = 900; scale = 1 } }
    [IO.File]::WriteAllBytes((Join-Path $outDir "shot-$Seed-$Width-$th.png"), [Convert]::FromBase64String($shot.data))
  }
  $inv = Eval-Js "window.__loop.checkInvariants()"
  if ($inv) { $report.phaseErrors += @($inv | ForEach-Object { "A-inv $_" }) }

  # ---- Phase B: randomized operation loop, reloading between chunks (OP-14) ----
  $done = 0; $c = 0
  while ($done -lt $Ops) {
    $n = [Math]::Min($Chunk, $Ops - $done)
    $chunkSeed = $Seed * 1000 + $c
    Write-Host "[loop] chunk $c : $n ops (seed $chunkSeed)"
    $res = Eval-Js "window.__loop.runChunk($chunkSeed, $n)"
    $report.chunks += $res
    $done += $n; $c++
    $snapJson = Eval-Js "JSON.stringify(window.__loop.snapshot())"
    Load-Page
    $after = Eval-Js "window.__loop.verifySnapshot($snapJson)"
    if ($after) { $report.phaseErrors += @($after | ForEach-Object { "reload after chunk $($c - 1): $_" }) }
  }
}
catch {
  $report.phaseErrors += "runner: $($_.Exception.Message)"
}
finally {
  if ($ws) { try { $ws.Dispose() } catch {} }
  if ($browser -and -not $browser.HasExited) { try { Stop-Process -Id $browser.Id -Force } catch {} }
  Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$profileDir*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force } catch {} }
  if ($app -and -not $app.HasExited) { try { Stop-Process -Id $app.Id -Force } catch {} }
  # 'java' on PATH may be a launcher stub that spawns the real JVM; kill by command line too
  Get-CimInstance Win32_Process -Filter "Name='java.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*--server.port=$Port*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force } catch {} }
}

$opErrors = 0; $total = 0
foreach ($ch in $report.chunks) { $opErrors += @($ch.errors).Count; $total += $ch.ops }
$report.totalOps = $total
$report.opErrorCount = $opErrors
$report.phaseErrorCount = @($report.phaseErrors).Count
$report.cdpExceptionCount = @($report.cdpExceptions).Count
$appErr = Join-Path $work 'app.out.log'
$report.serverErrorLines = @()
if (Test-Path $appErr) { $report.serverErrorLines = @(Select-String -Path $appErr -Pattern ' ERROR ' | Select-Object -First 20 | ForEach-Object { $_.Line }) }
$report.pass = ($opErrors -eq 0 -and $report.phaseErrorCount -eq 0 -and $report.cdpExceptionCount -eq 0 -and $report.serverErrorLines.Count -eq 0 -and $total -ge $Ops)
$path = Join-Path $outDir "report-$Seed.json"
$report | ConvertTo-Json -Depth 12 | Out-File -Encoding utf8 $path
Write-Host "[loop] ops=$total opErrors=$opErrors phaseErrors=$($report.phaseErrorCount) jsExceptions=$($report.cdpExceptionCount) serverErrors=$($report.serverErrorLines.Count) PASS=$($report.pass)"
Write-Host "[loop] report: $path"
if (-not $report.pass) { exit 1 }
