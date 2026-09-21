Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear([System.Drawing.Color]::Transparent)

$rect = New-Object System.Drawing.Rectangle(6, 6, 244, 244)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $rect,
  [System.Drawing.Color]::FromArgb(255, 90, 130, 255),
  [System.Drawing.Color]::FromArgb(255, 58, 85, 224),
  45.0
)
$g.FillEllipse($brush, $rect)

$glow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(46, 255, 255, 255))
$g.FillEllipse($glow, 52, 34, 152, 96)

$font = New-Object System.Drawing.Font('Segoe UI', 96, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$textRect = New-Object System.Drawing.RectangleF(0, 8, 256, 256)
$g.DrawString('AI', $font, [System.Drawing.Brushes]::White, $textRect, $format)

$bmp.Save('D:\Projects\deepseek-ball\resources\icon.png', [System.Drawing.Imaging.ImageFormat]::Png)

$font.Dispose()
$format.Dispose()
$brush.Dispose()
$glow.Dispose()
$g.Dispose()
$bmp.Dispose()
Write-Output 'icon.png generated'
