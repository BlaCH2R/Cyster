$ErrorActionPreference = 'Stop'
$base = "https://raw.githubusercontent.com/Cytoid/cytoid/main/"
$root = "V:\cytoid storyboarder\reference"
$files = @(
  "engines/unity/Assets/Scripts/Storyboard/Storyboard.cs",
  "engines/unity/Assets/Scripts/Storyboard/StoryboardModel.cs",
  "engines/unity/Assets/Scripts/Storyboard/StoryboardConfig.cs",
  "engines/unity/Assets/Scripts/Storyboard/GenericStateParser.cs",
  "engines/unity/Assets/Scripts/Storyboard/StoryboardComponentRenderer.cs",
  "engines/unity/Assets/Scripts/Storyboard/StoryboardRenderer.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/ControllerEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/ControllerStateParser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/ControllerRenderer.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/CameraEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/ScannerPositionEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/BackgroundDimEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/StoryboardOpacityEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/UiOpacityEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/ScannerOpacityEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/ScannerSmoothingEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/NoteOpacityEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/GlobalNoteFillColorEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/GlobalNoteRingColorEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/ArcadeEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/BloomEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/ChromaticalEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/ColorAdjustmentEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/ColorFilterEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/DreamEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/FisheyeEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/FocusEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/GlitchEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/GrayScaleEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/NoiseEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/RadialBlurEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/SepiaEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/ShockwaveEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Controllers/TapeEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Sprites/SpriteEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Sprites/SpriteRenderer.cs",
  "engines/unity/Assets/Scripts/Storyboard/Sprites/SpriteStateParser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Texts/TextEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Texts/TextRenderer.cs",
  "engines/unity/Assets/Scripts/Storyboard/Texts/TextStateParser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Lines/LineEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Lines/LineRenderer.cs",
  "engines/unity/Assets/Scripts/Storyboard/Lines/LineStateParser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Videos/VideoEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Videos/VideoRenderer.cs",
  "engines/unity/Assets/Scripts/Storyboard/Videos/VideoStateParser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Notes/NoteControllerEaser.cs",
  "engines/unity/Assets/Scripts/Storyboard/Notes/NoteControllerRenderer.cs",
  "engines/unity/Assets/Scripts/Storyboard/Notes/NoteControllerStateParser.cs",
  "engines/unity/Assets/Scripts/Storyboard/PostProcess/StoryboardEffects.cs",
  "engines/unity/Assets/Scripts/Storyboard/PostProcess/FallbackStoryboardEffects.cs",
  "engines/unity/Assets/Scripts/Storyboard/PostProcess/StoryboardEffectsChannels.cs",
  "engines/unity/Assets/Scripts/Game/Chart/ChartModel.cs",
  "engines/unity/Assets/Scripts/Game/Chart/Chart.cs",
  "engines/unity/Assets/Scripts/Game/Chart/PositionFunction.cs",
  "engines/unity/Assets/Scripts/Game/Elements/Scanner.cs"
)
foreach ($f in $files) {
  $out = Join-Path $root ($f -replace "engines/unity/Assets/Scripts/", "")
  $dir = Split-Path $out
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Invoke-WebRequest -Uri ($base + $f) -UseBasicParsing -TimeoutSec 60 -OutFile $out
  Write-Host "OK $f"
}
