#!/bin/bash
set -e

# GIAC Book Indexer - Proxmox Deployment Script
# This script deploys the app to a Proxmox LXC container

echo "🚀 GIAC Book Indexer - Proxmox Deployment"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${1:-indexer.yourdomain.com}"
EMAIL="${2:-admin@yourdomain.com}"
REPO_URL="${3:-https://github.com/yourusername/giac-book-indexer.git}"

echo -e "${YELLOW}Configuration:${NC}"
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo "Repository: $REPO_URL"

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

# Update system
echo -e "${YELLOW}📦 Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
apt-get install -y \
    curl \
    wget \
    git \
    certbot \
    docker.io \
    docker-compose

# Add user to docker group
echo -e "${YELLOW}👤 Configuring Docker permissions...${NC}"
usermod -aG docker root

# Create app directory
APP_DIR="/opt/giac-book-indexer"
echo -e "${YELLOW}📁 Creating app directory: $APP_DIR${NC}"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Clone repository
echo -e "${YELLOW}📥 Cloning repository...${NC}"
if [ -d ".git" ]; then
    git pull origin main
else
    git clone "$REPO_URL" .
fi

# Create SSL directory
echo -e "${YELLOW}🔐 Setting up SSL directories...${NC}"
mkdir -p certbot/{conf,www}
chmod -R 755 certbot

# Obtain SSL certificate
echo -e "${YELLOW}🔐 Obtaining SSL certificate from Let's Encrypt...${NC}"
certbot certonly --webroot \
    -w "$APP_DIR/certbot/www" \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --staging  # Remove --staging for production

# Create .env.production
echo -e "${YELLOW}⚙️  Creating .env.production...${NC}"
if [ ! -f ".env.production" ]; then
    cp .env.production.example .env.production
    echo -e "${YELLOW}⚠️  Please edit .env.production with your configuration${NC}"
    exit 1
fi

# Update nginx.conf domain
echo -e "${YELLOW}⚙️  Updating Nginx configuration...${NC}"
sed -i "s/indexer.yourdomain.com/$DOMAIN/g" nginx.conf

# Build and start containers
echo -e "${YELLOW}🐳 Building Docker image...${NC}"
docker-compose build

echo -e "${YELLOW}🚀 Starting containers...${NC}"
docker-compose up -d

# Wait for app to be ready
echo -e "${YELLOW}⏳ Waiting for application to be ready...${NC}"
sleep 10

# Check health
echo -e "${YELLOW}🏥 Checking application health...${NC}"
if curl -f http://localhost:3000/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Application is running${NC}"
else
    echo -e "${RED}❌ Application health check failed${NC}"
    docker-compose logs app
    exit 1
fi

# Setup auto-renewal for SSL
echo -e "${YELLOW}🔄 Setting up SSL auto-renewal...${NC}"
certbot renew --dry-run  # Test renewal

# Add to crontab for auto-renewal
CRON_CMD="0 2 * * * /usr/bin/certbot renew --quiet && docker-compose -f $APP_DIR/docker-compose.yml exec -T nginx nginx -s reload"
(crontab -l 2>/dev/null | grep -v "$APP_DIR" ; echo "$CRON_CMD") | crontab -

# Create systemd service for auto-start
echo -e "${YELLOW}📋 Creating systemd service...${NC}"
cat > /etc/systemd/system/giac-indexer.service <<EOF
[Unit]
Description=GIAC Book Indexer
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable giac-indexer.service

echo -e "${GREEN}"
echo "✅ Deployment Complete!"
echo "=========================================="
echo "Application URL: https://$DOMAIN"
echo "API Health Check: https://$DOMAIN/api/health"
echo ""
echo "Next steps:"
echo "1. Update Cloudflare DNS to point $DOMAIN to this server's IP"
echo "2. Monitor logs: docker-compose logs -f"
echo "3. Update .env.production with production credentials"
echo "=========================================="
echo -e "${NC}"
