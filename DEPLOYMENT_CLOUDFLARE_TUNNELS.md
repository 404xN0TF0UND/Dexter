# Cloudflare Tunnels + Local Deployment Guide

## Architecture with Cloudflare Tunnels

Instead of exposing your IP directly, you use a tunnel that connects from inside your network:

```
Your App (Proxmox)          Cloudflare          Internet Users
    |                           |                     |
    | (cloudflared daemon)       |                     |
    |--------HTTPS Tunnel--------|                     |
    |        (outbound only)      |                     |
    |                      | (routes traffic)          |
    |                      |--------HTTPS---------->  [Users]
    
Benefits:
✅ No static IP needed
✅ No port forwarding required
✅ No firewall holes
✅ Dynamic IP compatible
✅ Works behind NAT/router
✅ Automatic SSL via Cloudflare
```

## Step-by-Step Deployment with Cloudflare Tunnels

### Phase 1: Proxmox Container Setup (Same as before)

1. **Create LXC Container in Proxmox**
   - Ubuntu 22.04
   - 4GB RAM, 30GB disk
   - Static IP (internal only needed)

2. **SSH into Container**
   ```bash
   ssh root@<container-ip>
   ```

3. **Install Docker & Dependencies**
   ```bash
   # Update system
   sudo apt-get update && sudo apt-get upgrade -y
   
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # Add user to docker group
   sudo usermod -aG docker root
   
   # Install Docker Compose
   sudo apt-get install -y docker-compose
   
   # Install Cloudflare CLI
   curl -L https://pkg.cloudflare.com/cloudflare-warp-archive-key.gpg | sudo apt-key add -
   echo "deb http://pkg.cloudflare.com/ $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflare-warp.list
   sudo apt-get update
   sudo apt-get install -y cloudflared
   ```

### Phase 2: Transfer Application Code

Your repository is available at `https://github.com/404xN0TF0UND/Dexter`, but if the target machine does not have Git CLI access, use the local transfer method below.

**Option A: SCP from Dev Machine** (Recommended)

On your Windows dev machine (PowerShell):
```powershell
# Compress the project
cd c:\Users\ronni\OneDrive\School\Dexter
tar -czf giac-app.tar.gz --exclude=node_modules --exclude=dist --exclude=.git .

# Copy to Proxmox container
scp giac-app.tar.gz root@<container-ip>:/tmp/

# SSH and extract
ssh root@<container-ip>
cd /opt
tar xzf /tmp/giac-app.tar.gz
mv Dexter giac-book-indexer  # Rename if needed
cd giac-book-indexer
```

If you cannot push from the current machine, you can also upload the archive via GitHub, a file share, or a USB transfer and then extract it on the container.

**Option B: Git Clone (If you can push from your local machine)**

If you can push your code from Windows, GitHub Desktop, or the browser upload flow, then on the Proxmox container clone directly:
```bash
git clone https://github.com/404xN0TF0UND/Dexter.git /opt/giac-book-indexer
cd /opt/giac-book-indexer
```

If Git CLI is unavailable on the container, the archive transfer remains the simplest supported path.

### Phase 3: Configure Application

```bash
cd /opt/giac-book-indexer

# Create production environment file
cp .env.production.example .env.production
nano .env.production

# Fill in your values:
# VITE_SENTRY_DSN=...
# VITE_ROLLBAR_ACCESS_TOKEN=...
# VITE_APP_VERSION=1.0.0
```

### Phase 4: Start Docker Application (No Nginx, No SSL Cert Needed!)

Update `docker-compose.yml` for Cloudflare Tunnels:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: giac-book-indexer
    ports:
      - "localhost:3000:3000"  # Only expose to localhost
    environment:
      - NODE_ENV=production
      - VITE_SENTRY_DSN=${VITE_SENTRY_DSN}
      - VITE_ROLLBAR_ACCESS_TOKEN=${VITE_ROLLBAR_ACCESS_TOKEN}
      - VITE_APP_ENV=production
      - VITE_APP_VERSION=${VITE_APP_VERSION}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
```

Note: 
- **No Nginx needed** - Cloudflare handles reverse proxy
- **No SSL cert needed** - Cloudflare provides SSL automatically
- **Port only to localhost** - Not exposed to internet

Start the app:
```bash
docker-compose build
docker-compose up -d
docker-compose ps
```

### Phase 5: Install & Configure Cloudflare Tunnel

**Step 1: Authenticate cloudflared**

```bash
# This opens a browser-based login
cloudflared tunnel login

# You'll see:
# Please open the browser and go to:
# https://dash.cloudflare.com/argotunnel?aud=...
# 
# Click "Authorize" - it will download a certificate
```

**Step 2: Create the tunnel**

```bash
cloudflared tunnel create giac-indexer
```

This creates:
- Tunnel ID
- Credentials file at `~/.cloudflared/<UUID>.json`

**Step 3: Create tunnel config file**

```bash
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
```

Add this content:

```yaml
tunnel: giac-indexer
credentials-file: /root/.cloudflared/YOUR-UUID.json

ingress:
  - hostname: indexer.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

Replace `YOUR-UUID` with your actual UUID from the credentials file.

**Step 4: Test the tunnel**

```bash
cloudflared tunnel run giac-indexer
```

You should see:
```
INF Starting tunnel with ID xyz
INF Registered tunnel connection connid=0
INF Looking up ingress rule for requests to indexer.yourdomain.com
```

Press `Ctrl+C` to stop.

**Step 5: Create systemd service for auto-start**

```bash
sudo nano /etc/systemd/system/cloudflared.service
```

Add:

```ini
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
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

### Phase 6: Configure Cloudflare DNS (Different from A records!)

**In Cloudflare Dashboard:**

1. **Go to DNS > Records**
2. **Create CNAME record** (NOT A record)
   - **Type:** CNAME
   - **Name:** `indexer`
   - **Content:** `giac-indexer.cfargotunnel.com` (your tunnel name)
   - **TTL:** Auto
   - **Proxy:** Proxied (Cloudflare manages SSL)

3. **Verify DNS**
   ```bash
   dig indexer.yourdomain.com
   # Should show: indexer.yourdomain.com. CNAME giac-indexer.cfargotunnel.com.
   ```

4. **Test tunnel is working**
   ```bash
   curl https://indexer.yourdomain.com
   # Should return your app's HTML
   ```

### Phase 7: Verify Everything Works

```bash
# Check tunnel status
cloudflared tunnel info giac-indexer

# View tunnel logs
sudo journalctl -u cloudflared -f

# Test application
curl https://indexer.yourdomain.com

# Monitor app
docker-compose logs -f app
```

---

## Complete Deployment Script (Local Version)

Create `deploy-tunnel.sh`:

```bash
#!/bin/bash
set -e

DOMAIN="${1:-indexer.yourdomain.com}"
TUNNEL_NAME="${2:-giac-indexer}"

echo "🚀 GIAC Book Indexer - Cloudflare Tunnel Deployment"
echo "===================================================="

# Install dependencies
echo "📦 Installing Docker and cloudflared..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker root

curl -L https://pkg.cloudflare.com/cloudflare-warp-archive-key.gpg | sudo apt-key add -
echo "deb http://pkg.cloudflare.com/ $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflare-warp.list
sudo apt-get update
sudo apt-get install -y docker-compose cloudflared

# Setup application
echo "📁 Setting up application..."
mkdir -p /opt/giac-book-indexer
cd /opt/giac-book-indexer

# Create .env.production if it doesn't exist
if [ ! -f ".env.production" ]; then
    cp .env.production.example .env.production
    echo "⚠️  Created .env.production - please edit it with your credentials"
    exit 1
fi

# Build and start Docker containers
echo "🐳 Building Docker image..."
docker-compose build

echo "🚀 Starting application..."
docker-compose up -d
sleep 5

# Verify app is running
if curl -f http://localhost:3000/ > /dev/null 2>&1; then
    echo "✅ Application is running"
else
    echo "❌ Application failed to start"
    docker-compose logs app
    exit 1
fi

# Setup Cloudflare tunnel
echo "🌐 Setting up Cloudflare tunnel..."
echo "⚠️  Please open your browser and authorize cloudflared"
cloudflared tunnel login

echo "🔗 Creating tunnel: $TUNNEL_NAME"
cloudflared tunnel create "$TUNNEL_NAME" 2>/dev/null || true

# Get UUID
UUID=$(cat ~/.cloudflared/"${TUNNEL_NAME}".json | grep -o '"id":"[^"]*' | cut -d'"' -f4)

# Create config file
echo "⚙️  Creating tunnel configuration..."
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml > /dev/null <<EOF
tunnel: $TUNNEL_NAME
credentials-file: /root/.cloudflared/${UUID}.json

ingress:
  - hostname: $DOMAIN
    service: http://localhost:3000
  - service: http_status:404
EOF

# Create systemd service
echo "📋 Creating systemd service..."
sudo tee /etc/systemd/system/cloudflared.service > /dev/null <<'EOF'
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

sudo systemctl daemon-reload
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

echo "✅ Tunnel configured and started"
echo ""
echo "Next steps:"
echo "1. Go to Cloudflare Dashboard > DNS"
echo "2. Create CNAME record:"
echo "   Name: indexer"
echo "   Content: ${TUNNEL_NAME}.cfargotunnel.com"
echo "   Proxy: Proxied"
echo ""
echo "3. Wait 1-2 minutes for DNS to propagate"
echo "4. Test: curl https://$DOMAIN"
echo ""
echo "Your app will be available at: https://$DOMAIN"
```

Make it executable:
```bash
chmod +x deploy-tunnel.sh
sudo ./deploy-tunnel.sh indexer yourdomain.com
```

---

## Key Differences from Static IP Deployment

| Aspect | Static IP | Cloudflare Tunnel |
|--------|-----------|-------------------|
| **DNS Setup** | A record pointing to IP | CNAME pointing to tunnel |
| **Port Forwarding** | Required | ❌ Not needed |
| **Firewall Rules** | Port 80/443 must be open | ❌ Only outbound needed |
| **SSL Certificate** | Let's Encrypt (manual renewal) | Cloudflare (automatic) |
| **Reverse Proxy** | Nginx in container | Cloudflare's edge |
| **IP Changes** | Site goes down | ✅ Automatically handles |
| **Setup Time** | ~30 minutes | ~10 minutes |
| **Dynamic IP Support** | ❌ No | ✅ Yes |

---

## Monitoring Tunnel Status

```bash
# Check tunnel status
cloudflared tunnel info giac-indexer

# View active connections
cloudflared tunnel info giac-indexer --show-deprecated-params

# Real-time logs
sudo journalctl -u cloudflared -f

# Cloudflare Dashboard
# https://dash.cloudflare.com/ > Workers > Tunnels
```

---

## Troubleshooting Cloudflare Tunnels

### Tunnel won't connect
```bash
# Check credentials file exists
ls -la ~/.cloudflared/

# Verify config syntax
sudo /usr/bin/cloudflared tunnel validate --config /etc/cloudflared/config.yml

# Restart tunnel
sudo systemctl restart cloudflared
```

### DNS not resolving
```bash
# Verify CNAME was created
dig indexer.yourdomain.com

# Check Cloudflare Dashboard for DNS record

# Flush DNS cache
sudo systemctl restart systemd-resolved
```

### Application returns 404
```bash
# Verify app is running locally
curl http://localhost:3000

# Check tunnel routing
sudo cat /etc/cloudflared/config.yml

# Verify localhost:3000 is correct in config
```

### Tunnel keeps restarting
```bash
# Check systemd service logs
sudo journalctl -u cloudflared -n 50

# Verify credentials file
ls -la ~/.cloudflared/

# Check file permissions
sudo chmod 644 ~/.cloudflared/*.json
```

---

## Local Development Deployment Workflow

When you make code changes:

```bash
# On your dev machine, compress the updated code
cd c:\Users\ronni\OneDrive\School\Dexter
tar -czf giac-app.tar.gz --exclude=node_modules --exclude=dist --exclude=.git .

# Copy to Proxmox
scp giac-app.tar.gz root@<container-ip>:/tmp/

# SSH to container
ssh root@<container-ip>

# Update the application
cd /opt/giac-book-indexer
tar xzf /tmp/giac-app.tar.gz --strip-components=1

# Rebuild and restart
docker-compose build
docker-compose up -d

# Verify
curl https://indexer.yourdomain.com
```

Or create a helper script `update.sh`:

```bash
#!/bin/bash
# On dev machine
scp giac-app.tar.gz root@$1:/tmp/ && \
ssh root@$1 "cd /opt/giac-book-indexer && tar xzf /tmp/giac-app.tar.gz --strip-components=1 && docker-compose build && docker-compose up -d"
```

Usage: `./update.sh <container-ip>`

---

## Security Considerations

✅ **Advantages of Tunnel Approach:**
- No open ports on router/firewall
- No port forwarding complexity
- DDoS protection built-in
- Automatic SSL from Cloudflare

⚠️ **Best Practices:**
1. Keep cloudflared updated: `sudo apt-get update && apt-get upgrade cloudflared`
2. Monitor tunnel logs regularly
3. Set up Cloudflare WAF rules
4. Use Cloudflare rate limiting
5. Enable 2FA on Cloudflare account

---

## Cost with Cloudflare Tunnels

| Item | Cost |
|------|------|
| Proxmox server (one-time) | ~$300-1000 |
| LXC container | Free |
| Cloudflare DNS (Free plan) | Free |
| Cloudflare Tunnel | Free |
| Domain | $10-15/year |
| **Total Monthly** | **$0** |

Yes, **completely free**! 🎉

---

## Summary

**Your deployment flow is now:**

1. ✅ Create LXC container on Proxmox
2. ✅ Transfer code via SCP (no remote repo needed)
3. ✅ Docker containers auto-build and start
4. ✅ cloudflared tunnel connects outbound only
5. ✅ Cloudflare DNS routes traffic via CNAME
6. ✅ Users connect securely to your app
7. ✅ Works with ANY IP (static or dynamic)

No more:
- ❌ Port forwarding config
- ❌ Firewall hole concerns
- ❌ Let's Encrypt certificate renewal scripts
- ❌ Static IP dependency
- ❌ Nginx reverse proxy complexity
