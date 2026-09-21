param(
  [int]$X,
  [int]$Y,
  [int]$Notches = 5,
  [int]$DelayMs = 600
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Threading;
public class WheelHelper {
  [DllImport("user32.dll")] private static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
  public static void Scroll(int x, int y, int notches) {
    SetCursorPos(x, y);
    Thread.Sleep(150);
    uint delta = notches > 0 ? unchecked((uint)(-120)) : unchecked((uint)120);
    for (int i = 0; i < Math.Abs(notches); i++) {
      mouse_event(0x0800, 0, 0, delta, UIntPtr.Zero);
      Thread.Sleep(60);
    }
  }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[void][WheelHelper]::SetProcessDPIAware()
[WheelHelper]::Scroll($X, $Y, $Notches)
Start-Sleep -Milliseconds $DelayMs
Write-Output "scrolled $Notches at ($X,$Y)"
