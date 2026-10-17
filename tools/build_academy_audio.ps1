# Rebuild bundled offline narration with Windows SAPI voices and MP3 compression.
# Requires Python imageio_ffmpeg (already available in the development environment).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskOutput = Join-Path $taskRoot 'assets/audio/academy'
New-Item -ItemType Directory -Force -Path $taskOutput | Out-Null
$taskEncoder = (& python -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())').Trim()
$taskSegments = Get-Content -Encoding UTF8 (Join-Path $PSScriptRoot 'academy-speech.json') | ConvertFrom-Json
$taskSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$taskFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$taskWav = Join-Path ([System.IO.Path]::GetTempPath()) ('academy-voice-' + [guid]::NewGuid().ToString() + '.wav')
try {
  foreach ($taskSegment in $taskSegments) {
    $taskVoice = if ($taskSegment.lang -eq 'en-US') { 'Microsoft Zira Desktop' } else { 'Microsoft Huihui Desktop' }
    $taskSynth.SelectVoice($taskVoice)
    $taskSynth.Rate = -2
    $taskSynth.SetOutputToWaveFile($taskWav, $taskFormat)
    $taskSynth.Speak($taskSegment.text)
    $taskSynth.SetOutputToNull()
    $taskMp3 = Join-Path $taskOutput ($taskSegment.id + '.mp3')
    & $taskEncoder -hide_banner -loglevel error -y -i $taskWav -codec:a libmp3lame -b:a 40k $taskMp3
    if ($LASTEXITCODE -ne 0) { throw "Audio encoding failed: $($taskSegment.id)" }
  }
} finally {
  $taskSynth.Dispose()
  if (Test-Path -LiteralPath $taskWav) { Remove-Item -LiteralPath $taskWav }
}
Write-Output "Generated $($taskSegments.Count) offline voice clips."
