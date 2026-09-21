$ErrorActionPreference = 'Stop'

$targetDir = Join-Path $PSScriptRoot '..\node_modules\7zip-bin\win\x64'
$targetDir = [System.IO.Path]::GetFullPath($targetDir)
$realExe = Join-Path $targetDir '7za-real.exe'
$shimExe = Join-Path $targetDir '7za.exe'

if (-not (Test-Path $realExe)) {
  if (-not (Test-Path $shimExe)) { throw "7za.exe not found in $targetDir" }
  Move-Item $shimExe $realExe
  Write-Output 'backed up original 7za.exe -> 7za-real.exe'
}

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { throw "csc.exe not found at $csc" }

$sourcePath = Join-Path $env:TEMP 'dsball-7za-shim.cs'
$source = @'
using System;
using System.Diagnostics;
using System.IO;
using System.Text;

internal static class Shim
{
    private static int Main(string[] args)
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string real = Path.Combine(baseDir, "7za-real.exe");
        if (!File.Exists(real)) real = Path.Combine(baseDir, "7za-real.exe");

        StringBuilder sb = new StringBuilder();
        bool isExtract = false;
        foreach (string arg in args)
        {
            if (string.Equals(arg, "x", StringComparison.OrdinalIgnoreCase)) isExtract = true;
            sb.Append(Quote(arg)).Append(' ');
        }
        if (isExtract) sb.Append("-x!darwin ");

        ProcessStartInfo info = new ProcessStartInfo(real, sb.ToString().TrimEnd());
        info.UseShellExecute = false;
        Process process = Process.Start(info);
        process.WaitForExit();
        return process.ExitCode;
    }

    private static string Quote(string value)
    {
        if (value.Length > 0 && value.IndexOfAny(new[] { ' ', '\t', '"' }) < 0) return value;
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }
}
'@
Set-Content -LiteralPath $sourcePath -Value $source -Encoding ASCII

& $csc /nologo /target:exe "/out:$shimExe" $sourcePath | Out-Null
if (-not (Test-Path $shimExe)) { throw 'failed to compile 7za shim' }
Write-Output "compiled 7za shim -> $shimExe"
