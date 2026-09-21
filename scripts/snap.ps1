param(
  [string]$Out = 'D:\Projects\deepseek-ball\snap.png',
  [int]$CropX = -1,
  [int]$CropY = 0,
  [int]$CropW = 0,
  [int]$CropH = 0,
  [int]$Scale = 1
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class SnapDpi { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }
"@
[void][SnapDpi]::SetProcessDPIAware()
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
$full = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$g = [System.Drawing.Graphics]::FromImage($full)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$g.Dispose()

if ($CropX -ge 0 -and $CropW -gt 0 -and $CropH -gt 0) {
  $rect = New-Object System.Drawing.Rectangle($CropX, $CropY, $CropW, $CropH)
  $outW = [int]($CropW * $Scale)
  $outH = [int]($CropH * $Scale)
  $crop = New-Object System.Drawing.Bitmap($outW, $outH)
  $g2 = [System.Drawing.Graphics]::FromImage($crop)
  $dest = New-Object System.Drawing.Rectangle(0, 0, $outW, $outH)
  $g2.DrawImage($full, $dest, $rect, [System.Drawing.GraphicsUnit]::Pixel)
  $crop.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g2.Dispose()
  $crop.Dispose()
} else {
  $full.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
}
$full.Dispose()
Write-Output "saved $Out"
