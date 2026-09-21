param(
  [int]$X1,
  [int]$Y1,
  [int]$X2,
  [int]$Y2,
  [int]$Steps = 12,
  [int]$DelayMs = 500
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DragDpi {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
}
"@
[void][DragDpi]::SetProcessDPIAware()
$down = 0x0002
$up = 0x0004
[void][DragDpi]::SetCursorPos($X1, $Y1)
Start-Sleep -Milliseconds 150
[DragDpi]::mouse_event($down, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
for ($i = 1; $i -le $Steps; $i++) {
  $x = [int]($X1 + ($X2 - $X1) * $i / $Steps)
  $y = [int]($Y1 + ($Y2 - $Y1) * $i / $Steps)
  [void][DragDpi]::SetCursorPos($x, $y)
  Start-Sleep -Milliseconds 25
}
Start-Sleep -Milliseconds 80
[DragDpi]::mouse_event($up, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds $DelayMs
Write-Output "dragged ($X1,$Y1) -> ($X2,$Y2)"
