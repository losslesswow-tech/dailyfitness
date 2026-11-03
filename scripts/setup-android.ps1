$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$toolsPath = Join-Path $projectRoot '.tools'
New-Item -ItemType Directory -Path $toolsPath -Force | Out-Null
function Fetch([string]$Url, [string]$Output) {
  if (-not (Test-Path -LiteralPath $Output)) {
    & curl.exe -L --fail --retry 1 --max-time 300 $Url -o $Output
    if ($LASTEXITCODE -ne 0) { throw "Download failed: $Url. Remove the incomplete file before retrying." }
  }
}
function Hash-Sha1([string]$File) {
  $stream = [IO.File]::OpenRead($File)
  try { return [BitConverter]::ToString([Security.Cryptography.SHA1]::Create().ComputeHash($stream)).Replace('-','').ToLowerInvariant() } finally { $stream.Dispose() }
}
$indexPath = Join-Path $toolsPath 'repository.xml'
Fetch 'https://dl.google.com/android/repository/repository2-1.xml' $indexPath
$repoXml = [xml](Get-Content -LiteralPath $indexPath -Raw)
foreach ($spec in @(@('platforms;android-35','platform35.zip','platform'),@('build-tools;35.0.0','build-tools35.zip','build-tools'))) {
  $pkg = $repoXml.SelectSingleNode("//*[local-name()='remotePackage' and @path='$($spec[0])']")
  $archive = @($pkg.archives.archive | Where-Object { -not $_.'host-os' -or $_.'host-os' -eq 'windows' })[0].complete
  if (-not $archive.url) { throw "SDK not found in official index: $($spec[0])" }
  $zipPath = Join-Path $toolsPath $spec[1]
  Fetch ('https://dl.google.com/android/repository/' + $archive.url) $zipPath
  if ((Hash-Sha1 $zipPath) -ne [string]$archive.checksum) { throw "SDK checksum mismatch: $zipPath" }
  $destination = Join-Path $toolsPath $spec[2]
  if (-not (Test-Path -LiteralPath $destination)) { Expand-Archive -LiteralPath $zipPath -DestinationPath $destination }
}
$jdkZip = Join-Path $toolsPath 'jdk17.zip'
Fetch 'https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip' $jdkZip
$jdkDestination = Join-Path $toolsPath 'jdk'
if (-not (Test-Path -LiteralPath $jdkDestination)) { Expand-Archive -LiteralPath $jdkZip -DestinationPath $jdkDestination }
Write-Output 'Portable Android toolchain ready. Run npm run build:android.'
