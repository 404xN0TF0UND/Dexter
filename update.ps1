# GIAC Book Indexer - Local Update Helper
# Run this from PowerShell on your Windows dev machine to update the app on Proxmox

param(
    [Parameter(Mandatory=$true)]
    [string]$ContainerIP,
    
    [Parameter(Mandatory=$false)]
    [string]$SSHUser = "root"
)

$ErrorActionPreference = "Stop"

# Colors
$Success = "`e[32m"
$Warning = "`e[33m"
$Error = "`e[31m"
$Info = "`e[34m"
$Reset = "`e[0m"

Write-Host "${Info}GIAC Book Indexer - Update Helper${Reset}" -ForegroundColor Blue
Write-Host "================================" -ForegroundColor Blue
Write-Host ""

$ProjectPath = Get-Location
Write-Host "Project path: $ProjectPath"
Write-Host "Target container: $ContainerIP"
Write-Host ""

# Step 1: Check if running from correct directory
if (-not (Test-Path "package.json")) {
    Write-Host "${Error}✗ Error: package.json not found${Reset}"
    Write-Host "Make sure you run this from the project root directory"
    exit 1
}

# Step 2: Create archive
Write-Host "${Warning}[1/4] Creating deployment archive...${Reset}"

$ArchiveName = "giac-app-$(Get-Date -Format 'yyyyMMdd-HHmmss').tar.gz"
$Excludes = @(
    'node_modules',
    'dist',
    '.git',
    '.env.production',
    'build.log',
    '*.tar.gz'
)

$ExcludeArgs = $Excludes | ForEach-Object { "--exclude=$_" }

try {
    & tar -czf $ArchiveName @ExcludeArgs .
    $FileSize = (Get-Item $ArchiveName).Length / 1MB
    Write-Host "${Success}✓ Archive created: $ArchiveName (${FileSize:F1} MB)${Reset}"
} catch {
    Write-Host "${Error}✗ Failed to create archive: $_${Reset}"
    exit 1
}

# Step 3: Copy to Proxmox
Write-Host "${Warning}[2/4] Uploading to Proxmox...${Reset}"

try {
    & scp $ArchiveName "${SSHUser}@${ContainerIP}:/tmp/"
    Write-Host "${Success}✓ File uploaded successfully${Reset}"
} catch {
    Write-Host "${Error}✗ Upload failed: $_${Reset}"
    Write-Host "Make sure SSH is working: ssh ${SSHUser}@${ContainerIP}"
    exit 1
}

# Step 4: Deploy on Proxmox
Write-Host "${Warning}[3/4] Deploying on Proxmox...${Reset}"

$DeployScript = @"
cd /opt/giac-book-indexer
tar xzf /tmp/$ArchiveName --strip-components=1
docker-compose -f docker-compose.tunnel.yml build
docker-compose -f docker-compose.tunnel.yml up -d
docker-compose -f docker-compose.tunnel.yml logs --tail=20 app
"@

try {
    $DeployScript | & ssh "${SSHUser}@${ContainerIP}" bash
    Write-Host "${Success}✓ Deployment completed${Reset}"
} catch {
    Write-Host "${Error}✗ Deployment failed: $_${Reset}"
    exit 1
}

# Step 5: Verify
Write-Host "${Warning}[4/4] Verifying deployment...${Reset}"

$HealthCheck = @"
for i in {1..10}; do
  if curl -f http://localhost:3000/ > /dev/null 2>&1; then
    echo 'App is responding'
    exit 0
  fi
  sleep 2
done
echo 'Health check timeout'
exit 1
"@

try {
    $HealthCheck | & ssh "${SSHUser}@${ContainerIP}" bash
    Write-Host "${Success}✓ Application is healthy${Reset}"
} catch {
    Write-Host "${Warning}⚠ Health check failed, but deployment may still be running${Reset}"
    Write-Host "Check logs with: ssh ${SSHUser}@${ContainerIP}"
    Write-Host "Then: docker-compose -f docker-compose.tunnel.yml logs -f app"
}

# Clean up local archive
Remove-Item $ArchiveName -Force
Write-Host "${Success}✓ Cleaned up local archive${Reset}"

Write-Host ""
Write-Host "${Success}════════════════════════════════════════${Reset}"
Write-Host "${Success}✅ Update Complete!${Reset}"
Write-Host "${Success}════════════════════════════════════════${Reset}"
Write-Host ""
Write-Host "Your app should now be updated at: https://indexer.yourdomain.com"
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  View logs:  ssh ${SSHUser}@${ContainerIP} docker-compose -f docker-compose.tunnel.yml logs -f app"
Write-Host "  Restart:    ssh ${SSHUser}@${ContainerIP} docker-compose -f docker-compose.tunnel.yml restart app"
Write-Host "  Status:     ssh ${SSHUser}@${ContainerIP} docker-compose -f docker-compose.tunnel.yml ps"
Write-Host ""
