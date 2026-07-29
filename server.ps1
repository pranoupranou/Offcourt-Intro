param([int]$Port = 4175)
$Root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "OFFCOURT serving $Root at http://localhost:$Port/"
$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".mp4"  = "video/mp4"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".ico"  = "image/x-icon"
  ".woff2"= "font/woff2"
  ".json" = "application/json"
}
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrEmpty($path)) { $path = "index.html" }
    $full = [System.IO.Path]::GetFullPath((Join-Path $Root ($path -replace '/', '\')))
    if (-not $full.StartsWith([System.IO.Path]::GetFullPath($Root)) -or -not (Test-Path $full -PathType Leaf)) {
      $res.StatusCode = 404
      $res.Close()
      continue
    }
    $ext = [System.IO.Path]::GetExtension($full).ToLower()
    $ct = $mime[$ext]
    if (-not $ct) { $ct = "application/octet-stream" }
    $res.ContentType = $ct
    $res.Headers.Add("Accept-Ranges", "bytes")
    $res.Headers.Add("Cache-Control", "no-cache")
    $fs = New-Object System.IO.FileStream($full, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, ([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete))
    try {
    $len = $fs.Length
    $range = $req.Headers["Range"]
    if ($range -and $range.StartsWith("bytes=")) {
      $parts = $range.Substring(6).Split('-')
      $start = [long]0
      $end = $len - 1
      if ($parts[0] -ne "") { $start = [long]$parts[0] }
      if ($parts.Length -gt 1 -and $parts[1] -ne "") { $end = [long]$parts[1] }
      if ($end -ge $len) { $end = $len - 1 }
      if ($start -gt $end) { $start = 0; $end = $len - 1 }
      $res.StatusCode = 206
      $res.Headers.Add("Content-Range", "bytes $start-$end/$len")
      $count = $end - $start + 1
      $res.ContentLength64 = $count
      [void]$fs.Seek($start, 'Begin')
      $buf = New-Object byte[] 65536
      $remaining = $count
      while ($remaining -gt 0) {
        $chunk = [int][Math]::Min([long]$buf.Length, $remaining)
        $read = $fs.Read($buf, 0, $chunk)
        if ($read -le 0) { break }
        $res.OutputStream.Write($buf, 0, $read)
        $remaining -= $read
      }
    }
    else {
      $res.ContentLength64 = $len
      $fs.CopyTo($res.OutputStream)
    }
    }
    finally { $fs.Close() }
    $res.Close()
  }
  catch {
    try { $ctx.Response.Abort() } catch {}
  }
}
