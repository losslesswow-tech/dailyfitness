param([string]$ToolsRoot = (Join-Path $PSScriptRoot '..\.tools'))
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$toolsPath = [IO.Path]::GetFullPath($ToolsRoot)
$jdkDir = Get-ChildItem -LiteralPath (Join-Path $toolsPath 'jdk') -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin\javac.exe') } | Select-Object -First 1
$sdkPlatform = Get-ChildItem -LiteralPath (Join-Path $toolsPath 'platform') -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'android.jar') } | Select-Object -First 1
$buildTools = Get-ChildItem -LiteralPath (Join-Path $toolsPath 'build-tools') -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'aapt2.exe') } | Select-Object -First 1
if (-not $jdkDir -or -not $sdkPlatform -or -not $buildTools) { throw 'Missing portable JDK17 / SDK35. See README.md.' }
$java = Join-Path $jdkDir.FullName 'bin\java.exe'
$javac = Join-Path $jdkDir.FullName 'bin\javac.exe'
$jar = Join-Path $jdkDir.FullName 'bin\jar.exe'
$androidJar = Join-Path $sdkPlatform.FullName 'android.jar'
$outDir = Join-Path $projectRoot 'artifacts'
$workDir = Join-Path $projectRoot '.local\android-build'
$classesDir = Join-Path $workDir 'classes'
$dexDir = Join-Path $workDir 'dex'
$signingDir = Join-Path $projectRoot '.local\signing'
New-Item -ItemType Directory -Path $outDir,$classesDir,$dexDir,$signingDir -Force | Out-Null
function Check-Exit([string]$Step) { if ($LASTEXITCODE -ne 0) { throw "$Step failed (exit $LASTEXITCODE)" } }
$resources = Join-Path $workDir 'resources.zip'
$unsigned = Join-Path $workDir 'unsigned.apk'
$aligned = Join-Path $workDir 'aligned.apk'
$signed = Join-Path $outDir 'dailyfitness-demo-0.3.apk'
& (Join-Path $buildTools.FullName 'aapt2.exe') compile --dir (Join-Path $projectRoot 'android\res') -o $resources
Check-Exit 'Resource compilation'
& (Join-Path $buildTools.FullName 'aapt2.exe') link -o $unsigned -I $androidJar --manifest (Join-Path $projectRoot 'android\AndroidManifest.xml') -A (Join-Path $projectRoot 'web') --min-sdk-version 26 --target-sdk-version 35 $resources
Check-Exit 'Resource linking'
# Windows aapt2 can emit backslashes for nested asset entries. Android's
# AssetManager resolves forward-slash names, so normalize before dex/signing.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$assetArchive = [IO.Compression.ZipFile]::Open($unsigned, [IO.Compression.ZipArchiveMode]::Update)
try {
  foreach ($entry in @($assetArchive.Entries)) {
    if ($entry.FullName.StartsWith('assets/') -and $entry.FullName.Contains('\')) {
      $normalizedName = $entry.FullName.Replace('\','/')
      if ($assetArchive.GetEntry($normalizedName)) { throw "Duplicate normalized asset: $normalizedName" }
      $memory = New-Object IO.MemoryStream
      $inputStream = $entry.Open()
      try { $inputStream.CopyTo($memory) } finally { $inputStream.Dispose() }
      $replacement = $assetArchive.CreateEntry($normalizedName, [IO.Compression.CompressionLevel]::Optimal)
      $outputStream = $replacement.Open()
      try { $bytes = $memory.ToArray(); $outputStream.Write($bytes,0,$bytes.Length) } finally { $outputStream.Dispose(); $memory.Dispose() }
      $entry.Delete()
    }
  }
} finally { $assetArchive.Dispose() }
$sources = @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'android\src') -Filter '*.java' -Recurse | ForEach-Object { $_.FullName })
& $javac -encoding UTF-8 -source 8 -target 8 -classpath $androidJar -d $classesDir @sources
Check-Exit 'Java compilation'
$classFiles = @(Get-ChildItem -LiteralPath $classesDir -Filter '*.class' -Recurse | ForEach-Object { $_.FullName })
& $java -cp (Join-Path $buildTools.FullName 'lib\d8.jar') com.android.tools.r8.D8 --min-api 26 --lib $androidJar --output $dexDir @classFiles
Check-Exit 'Dex compilation'
& $jar uf $unsigned -C $dexDir 'classes.dex'
Check-Exit 'Dex packaging'
& (Join-Path $buildTools.FullName 'zipalign.exe') -f -p 4 $unsigned $aligned
Check-Exit 'APK alignment'
$keystore = Join-Path $signingDir 'demo.keystore'
if (-not (Test-Path -LiteralPath $keystore)) {
  & (Join-Path $jdkDir.FullName 'bin\keytool.exe') -genkeypair -keystore $keystore -storepass android -keypass android -alias demo -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=DailyFitness Demo,O=Local Demo,C=CN'
  Check-Exit 'Demo key generation'
}
& $java -jar (Join-Path $buildTools.FullName 'lib\apksigner.jar') sign --ks $keystore --ks-key-alias demo --ks-pass pass:android --key-pass pass:android --out $signed $aligned
Check-Exit 'APK signing'
& $java -jar (Join-Path $buildTools.FullName 'lib\apksigner.jar') verify --verbose $signed
Check-Exit 'Signature verification'
$verifyArchive = [IO.Compression.ZipFile]::OpenRead($signed)
try {
  $webRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'web'))
  $assetCount = 0
  foreach ($sourceFile in (Get-ChildItem -LiteralPath $webRoot -Recurse -File)) {
    $relativeAsset = $sourceFile.FullName.Substring($webRoot.Length + 1).Replace('\','/')
    $packaged = $verifyArchive.GetEntry('assets/' + $relativeAsset)
    if (-not $packaged) { throw "Missing packaged asset: $relativeAsset" }
    $sourceStream = [IO.File]::OpenRead($sourceFile.FullName)
    $packagedStream = $packaged.Open()
    try {
      $sourceHash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($sourceStream))
      $packagedHash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($packagedStream))
      if ($sourceHash -ne $packagedHash) { throw "Stale packaged asset: $relativeAsset" }
    } finally { $sourceStream.Dispose(); $packagedStream.Dispose() }
    $assetCount++
  }
  Write-Output "Verified all $assetCount packaged web assets against source."
} finally { $verifyArchive.Dispose() }
& (Join-Path $buildTools.FullName 'aapt.exe') dump badging $signed | Select-Object -First 12
Check-Exit 'Manifest verification'
$hashStream = [IO.File]::OpenRead($signed)
try { $apkHash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($hashStream)).Replace('-','').ToLowerInvariant() } finally { $hashStream.Dispose() }
Write-Output "SHA256: $apkHash"
Write-Output "APK: $signed"
