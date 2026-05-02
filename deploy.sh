#!/bin/bash
set -e

# GIAC Book Indexer - Docker LXC Deployment Script
# Simple deployment to Docker container in LXC

echo "🚀 GIAC Book Indexer - Docker Deployment"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
echo -e "${YELLOW}📦 Installing Docker and Git...${NC}"
apt-get install -y \
    curl \
    wget \
    git \
    docker.io

# Install Docker Compose
echo -e "${YELLOW}📦 Installing Docker Compose...${NC}"
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Start Docker service
echo -e "${YELLOW}🐳 Starting Docker service...${NC}"
systemctl start docker
systemctl enable docker

# Create app directory
APP_DIR="/opt/giac-book-indexer"
echo -e "${YELLOW}📁 Creating app directory: $APP_DIR${NC}"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Clone or pull repository
echo -e "${YELLOW}📥 Getting application code...${NC}"
if [ -d ".git" ]; then
    echo "Repository exists, pulling latest..."
    git pull origin main 2>/dev/null || true
else
    echo "Cloning repository..."
    git clone https://github.com/yourusername/giac-book-indexer.git . 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Could not clone - ensure code is in $APP_DIR${NC}"
    }
fi

# Check for .env.production
echo -e "${YELLOW}⚙️  Checking environment configuration...${NC}"
if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}Creating .env.production template...${NC}"
    cat > .env.production <<EOF
# GIAC Book Indexer - Production Configuration

VITE_APP_ENV=production
VITE_APP_VERSION=1.0.0

# Optional: Sentry error tracking
VITE_SENTRY_DSN=

# Optional: Rollbar error tracking
VITE_ROLLBAR_ACCESS_TOKEN=
EOF
    echo -e "${YELLOW}⚠️  .env.production created. Edit if needed before proceeding.${NC}"
fi

# Build and start containers
echo -e "${YELLOW}🐳 Building Docker image...${NC}"
docker-compose build

echo -e "${YELLOW}🚀 Starting application...${NC}"
docker-compose up -d

# Wait for app to be ready
echo -e "${YELLOW}⏳ Waiting for application startup...${NC}"
sleep 5

# Check health
echo -e "${YELLOW}🏥 Checking application health...${NC}"
RETRIES=5
while [ $RETRIES -gt 0 ]; do
    if curl -f http://localhost:3000/ > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Application is healthy${NC}"
        break
    fi
    echo "Health check failed, retrying... ($RETRIES left)"
    RETRIES=$((RETRIES - 1))
    sleep 2
done

if [ $RETRIES -eq 0 ]; then
    echo -e "${RED}❌ Application health check failed${NC}"
    echo "Logs:"
    docker-compose logs app
    exit 1
fi

# Create systemd service for auto-start
echo -e "${YELLOW}📋 Creating systemd service...${NC}"
cat > /etc/systemd/system/giac-indexer.service <<EOF
[Unit]
Description=GIAC Book Indexer Docker Container
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=$APP_DIR
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable giac-indexer.service

# Display completion info
echo -e "${GREEN}"
echo "✅ Deployment Complete!"
echo "========================================"
echo "Application running on: http://localhost:3000"
echo "Container: giac-book-indexer"
echo ""
echo "Useful commands:"
echo "  View logs:       docker-compose logs -f"
echo "  Stop container:  docker-compose down"
echo "  Restart:         docker-compose restart"
echo "  Check status:    docker-compose ps"
echo ""
echo "Next steps:"
echo "1. Access: http://$(hostname -I | awk '{print $1}'):3000"
echo "2. Configure reverse proxy (HAProxy, nginx) on Proxmox host for external access"
echo "3. Set up SSL/TLS on Proxmox host level"
echo "========================================"
echo -e "${NC}"
