param(
  [int]$MaxSize = 1920,
  [int]$Quality = 82
)

Add-Type -AssemblyName System.Drawing

# Source files (in images/neu) -> destination paths relative to repo root.
# We use clean, descriptive ASCII filenames so HTML/URLs stay simple.
$plan = @(
  # --- Gnadenwald (Dorf, Landschaft, Jahreszeiten) -> images/Gnadenwald ---
  @{ Src = 'Das-Dorf-Gnadenwald-in-der-Region-Hall-Wattens-4*.jpg'; Dst = 'images/Gnadenwald/Dorf-Gnadenwald.jpg' },
  @{ Src = 'herbst-in-der-region-hall-wattens-in-tirol-9*.jpg';     Dst = 'images/Gnadenwald/Herbst-Hall-Wattens.jpg' },
  @{ Src = 'herbst-morgenstimmung-gnadenwald-st*.jpg';               Dst = 'images/Gnadenwald/Herbst-Morgenstimmung-Gnadenwald.jpg' },
  @{ Src = 'Sommer-in-Gnadenwald-Erholungsdorf*.jpg';                Dst = 'images/Gnadenwald/Sommer-in-Gnadenwald.jpg' },
  @{ Src = 'Wandern-auf-der-Walderalm-in-Gnadenwald*.jpg';           Dst = 'images/Gnadenwald/Wandern-Walderalm-Karwendel.jpg' },
  @{ Src = 'Winter-Gnadenwald-in-der-Region-Hall-Wattens-2*.jpg';    Dst = 'images/Gnadenwald/Winter-Gnadenwald.jpg' },

  # --- Kloster St. Martin (Profi-Aufnahmen) -> images/St.Martin/neu ---
  @{ Src = 'Kloster-St.-Martin-Gnadenwald-Kraftort-hall-wattens.at-3*.jpg'; Dst = 'images/St.Martin/neu/Kloster-St-Martin-3.jpg' },
  @{ Src = 'Kloster-St.-Martin-Gnadenwald-Kraftort-hall-wattens.at-5*.jpg'; Dst = 'images/St.Martin/neu/Kloster-St-Martin-5.jpg' },
  @{ Src = 'Kloster-St.-Martin-Gnadenwald-Kraftort-hall-wattens.at-6*.jpg'; Dst = 'images/St.Martin/neu/Kloster-St-Martin-6.jpg' },
  @{ Src = 'Kloster-St.-Martin-Gnadenwald-Kraftort-hall-wattens.at-9*.jpg'; Dst = 'images/St.Martin/neu/Kloster-St-Martin-9.jpg' },

  # --- Maria Larch Wallfahrtskapelle -> images/Maria Larch/neu (fuer spaeter) ---
  @{ Src = 'hd-Maria-Larch-Wallfahrtskapelle*tourismus*.jpg'; Dst = 'images/Maria Larch/neu/Maria-Larch-Wallfahrtskapelle-1.jpg'; Index = 0 },
  @{ Src = 'hd-Maria-Larch-Wallfahrtskapelle-2*.jpg';         Dst = 'images/Maria Larch/neu/Maria-Larch-Wallfahrtskapelle-2.jpg' },
  @{ Src = 'hd-Maria-Larch-Wallfahrtskapelle-3*.jpg';         Dst = 'images/Maria Larch/neu/Maria-Larch-Wallfahrtskapelle-3.jpg' },
  @{ Src = 'hd-Maria-Larch-Wallfahrtskapelle-5*.jpg';         Dst = 'images/Maria Larch/neu/Maria-Larch-Wallfahrtskapelle-5.jpg' }
)

# Get JPEG encoder for quality control
$jpegEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality
)

$repo = (Resolve-Path '.').Path
$srcDir = Join-Path $repo 'images/neu'

foreach ($item in $plan) {
  # Match exactly one source file. If multiple match the unrestricted pattern,
  # the first variant should be the one with NO numeric suffix.
  $candidates = Get-ChildItem -Path $srcDir -Filter $item.Src -File
  if ($candidates.Count -eq 0) {
    Write-Warning ("Keine Datei gefunden fuer Muster: {0}" -f $item.Src)
    continue
  }
  # For the bare "hd-Maria-Larch-Wallfahrtskapelle*tourismus*.jpg" pattern we
  # want only the variant WITHOUT a -2/-3/-5 suffix.
  if ($item.ContainsKey('Index')) {
    $candidates = $candidates | Where-Object { $_.Name -notmatch 'Wallfahrtskapelle-\d' }
    if ($candidates.Count -eq 0) {
      Write-Warning ("Maria-Larch Hauptbild nicht gefunden: {0}" -f $item.Src); continue
    }
  }
  $src = $candidates | Select-Object -First 1

  $dstPath = Join-Path $repo $item.Dst
  $dstDir  = Split-Path $dstPath -Parent
  if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }

  try {
    $img = [System.Drawing.Image]::FromFile($src.FullName)
    $w = $img.Width; $h = $img.Height
    $longest = [Math]::Max($w, $h)
    if ($longest -gt $MaxSize) {
      $scale = $MaxSize / $longest
      $newW = [int][Math]::Round($w * $scale)
      $newH = [int][Math]::Round($h * $scale)
    } else {
      $newW = $w; $newH = $h
    }

    $bmp = New-Object System.Drawing.Bitmap($newW, $newH)
    $bmp.SetResolution(72, 72)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($img, 0, 0, $newW, $newH)
    $g.Dispose()

    if (Test-Path $dstPath) { Remove-Item $dstPath -Force }
    $bmp.Save($dstPath, $jpegEncoder, $encParams)
    $bmp.Dispose()
    $img.Dispose()

    $oldKb = [Math]::Round($src.Length / 1KB, 0)
    $newKb = [Math]::Round((Get-Item $dstPath).Length / 1KB, 0)
    "{0,5} KB -> {1,5} KB  ({2,4}x{3,4})  {4}" -f $oldKb, $newKb, $newW, $newH, $item.Dst
  } catch {
    Write-Warning ("Fehler bei {0}: {1}" -f $src.Name, $_.Exception.Message)
  }
}
