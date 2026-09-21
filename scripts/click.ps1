param(
  [int]$X,
  [int]$Y,
  [switch]$RightClick,
  [int]$DelayMs = 700
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ClickDpi {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
}
"@
[void][ClickDpi]::SetProcessDPIAware()
[void][ClickDpi]::SetCursorPos($X, $Y)
Start-Sleep -Milliseconds 120
$down = 0x0002
$up = 0x0004
if ($RightClick) { $down = 0x0008; $up = 0x0010 }
[ClickDpi]::mouse_event($down, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 60
[ClickDpi]::mouse_event($up, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds $DelayMs
Write-Output "clicked ($X,$Y) right=$RightClick"
