<#
  Foreground fullscreen probe.
  Prints "F" when the foreground window covers its monitor entirely (games / fullscreen apps),
  "N" otherwise. Without -Once it loops every 1500ms until terminated.
#>
param(
  [switch]$Once
)

$ErrorActionPreference = 'Stop'

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class FgProbe {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);
  [DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO info);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
}
"@

[void][FgProbe]::SetProcessDPIAware()

$ignoredClasses = @('Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'Windows.UI.Core.CoreWindow')

function Get-FullscreenState {
  $handle = [FgProbe]::GetForegroundWindow()
  if ($handle -eq [IntPtr]::Zero) { return 'N' }
  if (-not [FgProbe]::IsWindowVisible($handle)) { return 'N' }

  $classBuilder = New-Object System.Text.StringBuilder 256
  [void][FgProbe]::GetClassName($handle, $classBuilder, 256)
  $className = $classBuilder.ToString()
  if ($ignoredClasses -contains $className) { return 'N' }

  $windowRect = New-Object FgProbe+RECT
  if (-not [FgProbe]::GetWindowRect($handle, [ref]$windowRect)) { return 'N' }

  $monitorInfo = New-Object FgProbe+MONITORINFO
  $monitorInfo.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($monitorInfo)
  $monitor = [FgProbe]::MonitorFromWindow($handle, 2)
  if (-not [FgProbe]::GetMonitorInfo($monitor, [ref]$monitorInfo)) { return 'N' }

  $width = $windowRect.Right - $windowRect.Left
  $height = $windowRect.Bottom - $windowRect.Top
  $monitorWidth = $monitorInfo.rcMonitor.Right - $monitorInfo.rcMonitor.Left
  $monitorHeight = $monitorInfo.rcMonitor.Bottom - $monitorInfo.rcMonitor.Top

  if ($width -lt ($monitorWidth - 4)) { return 'N' }
  if ($height -lt ($monitorHeight - 4)) { return 'N' }
  if ($windowRect.Left -gt ($monitorInfo.rcMonitor.Left + 2)) { return 'N' }
  if ($windowRect.Top -gt ($monitorInfo.rcMonitor.Top + 2)) { return 'N' }
  return 'F'
}

do {
  Write-Output (Get-FullscreenState)
  [Console]::Out.Flush()
  if (-not $Once) { Start-Sleep -Milliseconds 1500 }
} while (-not $Once)
