#!/bin/bash
set -e

# GIAC Book Indexer - Local Deployment with Cloudflare Tunnels
# This script deploys from a local file transfer (no remote repo needed)

echo "🚀 GIAC Book Indexer - Local Deployment with Cloudflare Tunnels"
echo "=============================================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN="${1:-indexer.yourdomain.com}"
TUNNEL_NAME="${2:-giac-indexer}"

if [ -z "$DOMAIN" ] || [ -z "$TUNNEL_NAME" ]; then
    echo -e "${RED}Usage: $0 <domain> <tunnel-name>${NC}"
    echo "  Example: $0 indexer.yourdomain.com giac-indexer"
    exit 1
fi

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo -e "${RED}Error: This script must run on Linux${NC}"
    exit 1
fi

# Check if user is root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    exit 1
fi

echo -e "${BLUE}Configuration:${NC}"
echo "Domain: $DOMAIN"
echo "Tunnel: $TUNNEL_NAME"
echo ""

# Step 1: Update system
echo -e "${YELLOW}[1/6] Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

# Step 2: Install Docker
echo -e "${YELLOW}[2/6] Installing Docker and Docker Compose...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

if ! command -v docker-compose &> /dev/null; then
    apt-get install -y docker-compose
fi

# Add root to docker group
usermod -aG docker root

# Step 3: Install Cloudflare CLI
echo -e "${YELLOW}[3/6] Installing cloudflared...${NC}"
if ! command -v cloudflared &> /dev/null; then
    curl -L https://pkg.cloudflare.com/cloudflare-warp-archive-key.gpg | apt-key add -
    echo "deb http://pkg.cloudflare.com/ $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/cloudflare-warp.list
    apt-get update
    apt-get install -y cloudflared
fi

# Step 4: Setup application directory
echo -e "${YELLOW}[4/6] Setting up application directory...${NC}"
APP_DIR="/opt/giac-book-indexer"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Check if application files exist (they should have been copied via SCP)
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Application files not found in $APP_DIR${NC}"
    echo "Did you copy the files via SCP?"
    echo "  Windows: tar -czf giac-app.tar.gz --exclude=node_modules --exclude=dist --exclude=.git ."
    echo "  Then: scp giac-app.tar.gz root@<container-ip>:/tmp/"
    exit 1
fi

# Create .env.production if missing
if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}Creating .env.production from template...${NC}"
    if [ -f ".env.production.example" ]; then
        cp .env.production.example .env.production
    fi
    echo -e "${RED}⚠️  Please edit .env.production with your Sentry/Rollbar credentials${NC}"
    echo "  Editor: nano /opt/giac-book-indexer/.env.production"
    exit 1
fi

# Step 5: Build and start Docker
echo -e "${YELLOW}[5/6] Building and starting Docker containers...${NC}"
docker-compose -f docker-compose.tunnel.yml build
docker-compose -f docker-compose.tunnel.yml up -d

# Wait for app to be ready
sleep 5

# Verify app is running
echo -e "${YELLOW}Verifying application...${NC}"
if curl -f http://localhost:3000/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Application is running${NC}"
else
    echo -e "${RED}✗ Application health check failed${NC}"
    docker-compose -f docker-compose.tunnel.yml logs app
    exit 1
fi

# Step 6: Setup Cloudflare Tunnel
echo -e "${YELLOW}[6/6] Setting up Cloudflare Tunnel...${NC}"

echo -e "${BLUE}"
echo "======================================"
echo "Browser authentication required"
echo "======================================"
echo "A browser window will open for you to"
echo "authorize cloudflared with your"
echo "Cloudflare account."
echo -e "${NC}"

# Authenticate with Cloudflare
cloudflared tunnel login

# Create tunnel
echo -e "${YELLOW}Creating tunnel: $TUNNEL_NAME${NC}"
cloudflared tunnel create "$TUNNEL_NAME" 2>/dev/null || echo "Tunnel already exists"

# Get UUID from credentials file
UUID=$(grep -o '"id":"[^"]*' ~/.cloudflared/"${TUNNEL_NAME}".json | cut -d'"' -f4)

if [ -z "$UUID" ]; then
    echo -e "${RED}Error: Could not get tunnel UUID${NC}"
    exit 1
fi

# Create tunnel config
echo -e "${YELLOW}Creating tunnel configuration...${NC}"
mkdir -p /etc/cloudflared

cat > /etc/cloudflared/config.yml <<EOF
tunnel: $TUNNEL_NAME
credentials-file: /root/.cloudflared/${UUID}.json

ingress:
  - hostname: $DOMAIN
    service: http://localhost:3000
  - service: http_status:404
EOF

# Create systemd service
echo -e "${YELLOW}Creating systemd service...${NC}"
cat > /etc/systemd/system/cloudflared.service <<'EOF'
[Unit]
Description=Cloudflare Tunnel
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStart=/usr/bin/cloudflared tunnel run giac-indexer
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable cloudflared
systemctl start cloudflared

# Wait for tunnel to establish
sleep 3

# Verify tunnel is running
if systemctl is-active --quiet cloudflared; then
    echo -e "${GREEN}✓ Cloudflare Tunnel is running${NC}"
else
    echo -e "${RED}✗ Cloudflare Tunnel failed to start${NC}"
    systemctl status cloudflared
    exit 1
fi

# Display success message
echo ""
echo -e "${GREEN}"
echo "════════════════════════════════════════"
echo "✅ Deployment Complete!"
echo "════════════════════════════════════════"
echo -e "${NC}"
echo ""
echo "🔗 Tunnel Information:"
echo "   Name: $TUNNEL_NAME"
echo "   UUID: $UUID"
echo ""
echo "📋 Next Steps:"
echo "1. Go to Cloudflare Dashboard:"
echo "   https://dash.cloudflare.com/ > Workers > Tunnels"
echo ""
echo "2. Create a CNAME DNS record:"
echo "   Type:    CNAME"
echo "   Name:    indexer"
echo "   Content: ${TUNNEL_NAME}.cfargotunnel.com"
echo "   Proxy:   Proxied (Cloudflare)"
echo ""
echo "3. Wait 1-2 minutes for DNS to propagate"
echo ""
echo "4. Test your app:"
echo "   curl https://$DOMAIN"
echo ""
echo "📊 Monitoring:"
echo "   Logs:    sudo journalctl -u cloudflared -f"
echo "   Status:  systemctl status cloudflared"
echo "   App:     docker-compose -f docker-compose.tunnel.yml logs -f app"
echo ""
echo "🌐 Your app will be live at: https://$DOMAIN"
echo ""
