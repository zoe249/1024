param(
  [string]$SourceRoot = (Join-Path $PSScriptRoot '..\design\晋级三选一弹窗\runtime-source'),
  [string]$OutputRoot = (Join-Path $PSScriptRoot '..\assets\resources\base\Stage')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
# 仅做运行资源的裁切、等比缩放和不透明内区规范化；源稿始终保留在 design。
$stageArtworkCode = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
public static class StageArtworkPack {
  public static void Prepare(string source, string output, int width, int height, int visibleWidth, int visibleHeight, bool solidCream) {
    using (var input = new Bitmap(source)) {
      int sw = input.Width, sh = input.Height;
      if (solidCream) {
        var outside = new bool[sw * sh];
        var queue = new int[sw * sh]; int read = 0, write = 0;
        for (int y = 0; y < sh; y++) for (int x = 0; x < sw; x++) {
          if (x != 0 && y != 0 && x != sw - 1 && y != sh - 1) continue;
          int index = y * sw + x;
          if (!outside[index] && input.GetPixel(x, y).A < 250) { outside[index] = true; queue[write++] = index; }
        }
        while (read < write) {
          int index = queue[read++], x = index % sw, y = index / sw;
          int[] neighbors = { x > 0 ? index - 1 : -1, x + 1 < sw ? index + 1 : -1, y > 0 ? index - sw : -1, y + 1 < sh ? index + sw : -1 };
          foreach (int n in neighbors) if (n >= 0 && !outside[n] && input.GetPixel(n % sw, n / sw).A < 250) { outside[n] = true; queue[write++] = n; }
        }
        for (int y = 0; y < sh; y++) for (int x = 0; x < sw; x++) {
          var color = input.GetPixel(x, y);
          if (!outside[y * sw + x] && (color.A < 250 || (color.R > 215 && color.G > 195 && color.B > 155)))
            input.SetPixel(x, y, Color.FromArgb(255, 255, 249, 237));
        }
      }
      int left = sw, top = sh, right = 0, bottom = 0;
      for (int y = 0; y < sh; y++) for (int x = 0; x < sw; x++) {
        var color = input.GetPixel(x, y);
        if (color.A <= 4) { input.SetPixel(x, y, Color.Transparent); continue; }
        left = Math.Min(left, x); top = Math.Min(top, y); right = Math.Max(right, x + 1); bottom = Math.Max(bottom, y + 1);
      }
      if (right <= left || bottom <= top) throw new Exception("素材为空");
      double scale = Math.Min((double)visibleWidth / (right - left), (double)visibleHeight / (bottom - top));
      int dw = Math.Max(1, (int)Math.Round((right - left) * scale)), dh = Math.Max(1, (int)Math.Round((bottom - top) * scale));
      using (var result = new Bitmap(width, height, PixelFormat.Format32bppArgb)) {
        using (var graphics = Graphics.FromImage(result)) {
          graphics.Clear(Color.Transparent);
          graphics.CompositingMode = CompositingMode.SourceCopy;
          graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
          graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
          graphics.DrawImage(input, new Rectangle((width - dw) / 2, (height - dh) / 2, dw, dh), new Rectangle(left, top, right - left, bottom - top), GraphicsUnit.Pixel);
        }
        result.Save(output, ImageFormat.Png);
      }
    }
  }
}
'@
Add-Type -TypeDefinition $stageArtworkCode -ReferencedAssemblies @('System.Drawing.Common','System.Drawing.Primitives','System.Private.Windows.GdiPlus','System.Private.Windows.Core')
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
$stageArtworkJobs = @(
  @{ Name='panel'; Width=720; Height=1040; VisibleWidth=710; VisibleHeight=1020; Solid=$true },
  @{ Name='diagonal'; Width=256; Height=256; VisibleWidth=220; VisibleHeight=220; Solid=$false },
  @{ Name='wildcard'; Width=256; Height=256; VisibleWidth=208; VisibleHeight=208; Solid=$false },
  @{ Name='shuffle'; Width=256; Height=256; VisibleWidth=220; VisibleHeight=220; Solid=$false },
  @{ Name='card'; Width=640; Height=180; VisibleWidth=632; VisibleHeight=172; Solid=$true },
  @{ Name='confirm'; Width=560; Height=128; VisibleWidth=552; VisibleHeight=120; Solid=$false }
)
foreach ($stageArtworkJob in $stageArtworkJobs) {
  $stageSource = Join-Path $SourceRoot ($stageArtworkJob.Name + '.png')
  $stageTarget = Join-Path $OutputRoot ($stageArtworkJob.Name + '.png')
  [StageArtworkPack]::Prepare($stageSource, $stageTarget, $stageArtworkJob.Width, $stageArtworkJob.Height, $stageArtworkJob.VisibleWidth, $stageArtworkJob.VisibleHeight, $stageArtworkJob.Solid)
  $stageResult = [System.Drawing.Bitmap]::FromFile($stageTarget)
  try {
    $stageLeft = $stageResult.Width; $stageTop = $stageResult.Height; $stageRight = 0; $stageBottom = 0
    for ($stageY=0; $stageY -lt $stageResult.Height; $stageY++) { for ($stageX=0; $stageX -lt $stageResult.Width; $stageX++) {
      if ($stageResult.GetPixel($stageX,$stageY).A -gt 4) {
        $stageLeft=[Math]::Min($stageLeft,$stageX); $stageTop=[Math]::Min($stageTop,$stageY)
        $stageRight=[Math]::Max($stageRight,$stageX+1); $stageBottom=[Math]::Max($stageBottom,$stageY+1)
      }
    } }
    [pscustomobject]@{Name=$stageArtworkJob.Name;Width=$stageResult.Width;Height=$stageResult.Height;Bytes=(Get-Item -LiteralPath $stageTarget).Length;AlphaBounds=@($stageLeft,$stageTop,$stageRight,$stageBottom);CenterAlpha=$stageResult.GetPixel([int]($stageResult.Width/2),[int]($stageResult.Height/2)).A} | ConvertTo-Json -Compress
  } finally { $stageResult.Dispose() }
}
