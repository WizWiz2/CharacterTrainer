param(
  [string]$TorchVersion = "2.9.0",
  [string]$TorchVisionVersion = "0.24.0",
  [string]$CudaIndexUrl = "",
  [switch]$RebuildBase,
  [string]$ModelsDir,
  [switch]$Gpu,
  [switch]$Cpu
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Ensure commands run from repo root (one level up from scripts)
$repoRoot = (Resolve-Path "$PSScriptRoot/..\").Path
Push-Location $repoRoot
try {

function Test-ImageExists([string]$name) {
  $out = docker images --format "{{.Repository}}:{{.Tag}}" 2>$null | Where-Object { $_ -eq "$name:latest" }
  return -not [string]::IsNullOrWhiteSpace($out)
}

# Ensure .env exists
$envPath = Join-Path -Path (Resolve-Path "$PSScriptRoot\..\").Path -ChildPath ".env"
if (-not (Test-Path $envPath)) {
  "BASE_IMAGE=charactertrainer-backend-base`n" | Out-File -FilePath $envPath -Encoding ascii
} else {
  $envContent = Get-Content $envPath -Encoding UTF8
  if (-not ($envContent -match "^BASE_IMAGE=")) {
    Add-Content -Path $envPath -Value "`nBASE_IMAGE=charactertrainer-backend-base"
  }
}

# Decide backend Dockerfile (GPU vs CPU)
$useGpu = $false
if ($Gpu -and $Cpu) {
  Write-Host "Both -Gpu and -Cpu specified; defaulting to GPU." -ForegroundColor Yellow
}
if ($Gpu -or (-not $Cpu)) { $useGpu = $true }

# Update BACKEND_DOCKERFILE in .env accordingly
if (Test-Path $envPath) { $envRaw = Get-Content $envPath -Raw -Encoding UTF8 } else { $envRaw = "" }
if ($useGpu) {
  $desired = "BACKEND_DOCKERFILE=docker/backend.gpu.Dockerfile"
} else {
  $desired = "BACKEND_DOCKERFILE=docker/backend.Dockerfile"
}
if ($envRaw -match "(?m)^BACKEND_DOCKERFILE=") {
  $updated = [regex]::Replace($envRaw, "(?m)^BACKEND_DOCKERFILE=.*", $desired)
} else {
  if ($envRaw -and -not $envRaw.EndsWith("`n")) { $envRaw += "`n" }
  $updated = $envRaw + $desired + "`n"
}
Set-Content -Path $envPath -Value $updated -Encoding UTF8
Write-Host "Using backend Dockerfile: $desired" -ForegroundColor Cyan

# GPU sanity check and defaults
if ($useGpu) {
  if (-not $CudaIndexUrl) { $CudaIndexUrl = "https://download.pytorch.org/whl/cu124" }
  if (-not $TorchVersion) { $TorchVersion = "2.6.0" }
  if (-not $TorchVisionVersion) { $TorchVisionVersion = "0.21.0" }
  Write-Host "GPU requested. Verifying Docker/NVIDIA availability..." -ForegroundColor Cyan
  try {
    docker run --rm --gpus all nvidia/cuda:12.4.1-base nvidia-smi | Out-Null
  } catch {
    Write-Host "WARNING: Docker cannot access GPU. Check Docker Desktop GPU/WSL settings and NVIDIA drivers." -ForegroundColor Yellow
  }
}

# Build base image only for CPU pipeline (GPU DF installs torch inside)
if (-not $useGpu) {
  $baseImage = "charactertrainer-backend-base"
  if ($RebuildBase -or -not (Test-ImageExists $baseImage)) {
    Write-Host "Building base image '$baseImage' (Torch=$TorchVersion)" -ForegroundColor Cyan
    $args = @(
      "-f","docker/backend.base.Dockerfile",
      "-t", $baseImage
    )
    if ($TorchVersion) { $args += @("--build-arg", "TORCH_VERSION=$TorchVersion") }
    if ($TorchVisionVersion) { $args += @("--build-arg", "TORCHVISION_VERSION=$TorchVisionVersion") }
    if ($CudaIndexUrl) { $args += @("--build-arg", "TORCH_INDEX_URL=$CudaIndexUrl") }
    $args += "."
    docker build @args
  }
}

if ($ModelsDir) {
  # Normalize Windows path to forward slashes for compose
  $modelsPath = $ModelsDir -replace "\\","/"
  # Persist in .env as HOST_MODELS_DIR instead of generating override
  if (Test-Path $envPath) {
    $envRaw = Get-Content $envPath -Raw -Encoding UTF8
  } else {
    $envRaw = ""
  }
  if ($envRaw -match "(?m)^HOST_MODELS_DIR=") {
    $updated = [regex]::Replace($envRaw, "(?m)^HOST_MODELS_DIR=.*", "HOST_MODELS_DIR=$modelsPath")
  } else {
    if ($envRaw -and -not $envRaw.EndsWith("`n")) { $envRaw += "`n" }
    $updated = $envRaw + "HOST_MODELS_DIR=$modelsPath`n"
  }
  Set-Content -Path $envPath -Value $updated -Encoding UTF8
  Write-Host "Updated .env: HOST_MODELS_DIR -> $modelsPath" -ForegroundColor Cyan
}

Write-Host "Starting stack via docker compose (may build app layers)..." -ForegroundColor Cyan
docker compose up -d --build

Write-Host "Containers status:" -ForegroundColor Green
docker compose ps

} finally {
  Pop-Location
}
