param(
  [int]$X = 0,
  [int]$Y = 0,
  [int]$Width = 800,
  [int]$Height = 600,
  [string]$Out = "shot.png"
)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ShotDpi {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[ShotDpi]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap($Width, $Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($X, $Y, 0, 0, (New-Object System.Drawing.Size($Width, $Height)))
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output ("shot " + $Width + "x" + $Height + " -> " + $Out)
