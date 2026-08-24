$ErrorActionPreference = 'Stop'
$base = "https://raw.githubusercontent.com/Cytoid/cytoid/v2.0.2/"
$root = "V:\cytoid storyboarder\reference\v2.0.2"
$files = @(
  "Assets/Scripts/Utils/Easings.cs",
  "Assets/Scripts/Storyboard/Storyboard.cs",
  "Assets/Scripts/Storyboard/StoryboardModel.cs",
  "Assets/Scripts/Storyboard/GenericStateParser.cs",
  "Assets/Scripts/Storyboard/StoryboardConfig.cs",
  "Assets/Scripts/Storyboard/StoryboardRenderer.cs",
  "Assets/Scripts/Storyboard/StoryboardRendererEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/ControllerEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/ControllerStateParser.cs",
  "Assets/Scripts/Storyboard/Controllers/ControllerRenderer.cs",
  "Assets/Scripts/Storyboard/Controllers/CameraEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/ScannerPositionEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/ScannerSmoothingEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/StoryboardOpacityEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/BackgroundDimEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/UiOpacityEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/ScannerOpacityEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/NoteOpacityEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/GlobalNoteFillColorEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/GlobalNoteRingColorEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/ScannerColorEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/ArcadeEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/BloomEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/ChromaticalEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/ColorAdjustmentEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/ColorFilterEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/DreamEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/FisheyeEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/FocusEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/GlitchEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/GrayScaleEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/NoiseEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/RadialBlurEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/SepiaEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/ShockwaveEaser.cs",
  "Assets/Scripts/Storyboard/Controllers/TapeEaser.cs",
  "Assets/Scripts/Storyboard/Sprites/SpriteEaser.cs",
  "Assets/Scripts/Storyboard/Sprites/SpriteRenderer.cs",
  "Assets/Scripts/Storyboard/Sprites/SpriteStateParser.cs",
  "Assets/Scripts/Storyboard/Texts/TextEaser.cs",
  "Assets/Scripts/Storyboard/Texts/TextRenderer.cs",
  "Assets/Scripts/Storyboard/Texts/TextStateParser.cs",
  "Assets/Scripts/Storyboard/Lines/LineEaser.cs",
  "Assets/Scripts/Storyboard/Lines/LineRenderer.cs",
  "Assets/Scripts/Storyboard/Lines/LineStateParser.cs",
  "Assets/Scripts/Storyboard/Videos/VideoEaser.cs",
  "Assets/Scripts/Storyboard/Videos/VideoRenderer.cs",
  "Assets/Scripts/Storyboard/Videos/VideoStateParser.cs",
  "Assets/Scripts/Storyboard/Notes/NoteControllerEaser.cs",
  "Assets/Scripts/Storyboard/Notes/NoteControllerRenderer.cs",
  "Assets/Scripts/Storyboard/Notes/NoteControllerStateParser.cs",
  "Assets/Scripts/Game/Chart/Chart.cs",
  "Assets/Scripts/Game/Chart/ChartModel.cs",
  "Assets/Scripts/Game/Elements/Scanner.cs"
)
foreach ($f in $files) {
  $out = Join-Path $root $f
  $dir = Split-Path $out
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Invoke-WebRequest -Uri ($base + $f) -UseBasicParsing -TimeoutSec 60 -OutFile $out
  Write-Host "OK $f"
}
