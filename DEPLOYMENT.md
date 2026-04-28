# Production Deployment Guide

## Proxmox + Cloudflare + Docker

This guide covers deploying the GIAC Book Indexer to production on local Proxmox infrastructure with Cloudflare DNS and Let's Encrypt SSL.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Proxmox Setup](#proxmox-setup)
4. [Container Configuration](#container-configuration)
5. [Cloudflare DNS Setup](#cloudflare-dns-setup)
6. [SSL/TLS Certificate](#ssltls-certificate)
7. [Deployment](#deployment)
8. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Architecture Overview

```
                              Cloudflare
                              (DNS + DDoS Protection)
                                  |
                                  v
                            Your ISP / Public IP
                                  |
                                  v
                         Proxmox Physical Host
                                  |
                    +-------------+-------------+
                    |                           |
                    v                           v
            LXC Container 1              LXC Container 2
            (App + Database)             (Backup/Monitor)
                    |
        +-------+---+---+-------+
        |       |       |       |
       Node   Docker  Nginx  Storage
```

### Key Components

- **Proxmox Host**: Virtualization platform managing LXC containers
- **LXC Container**: Lightweight Linux container for the application
- **Docker**: Container runtime for the app
- **Nginx**: Reverse proxy, SSL termination, load balancing
- **Cloudflare**: DNS management, DDoS protection, SSL origin support

---

## Prerequisites

### On Your Development Machine

- [ ] Git installed
- [ ] Docker and Docker Compose installed (for local testing)
- [ ] Node.js 18+ (for building)

### Proxmox Infrastructure

- [ ] Proxmox VE 7.0+ installed
- [ ] At least 4GB RAM available per container
- [ ] 20GB+ disk space for application
- [ ] Network bridge configured on Proxmox host

### Cloudflare

- [ ] Domain added to Cloudflare
- [ ] Nameservers updated to Cloudflare's (usually takes 24-48 hours)
- [ ] Cloudflare account with DNS edit permissions
- [ ] Optional: Cloudflare API token for automation

### Networking

- [ ] Public IP address or port forwarding configured
- [ ] Port 80 (HTTP) and 443 (HTTPS) accessible from the internet
- [ ] Firewall rules allowing HTTPS traffic

---

## Proxmox Setup

### Step 1: Create LXC Container

In Proxmox web UI (https://proxmox-host:8006):

1. **Node > Create CT**
2. **General Tab:**
   - CTID: Auto-generated
   - Hostname: `indexer`
   - Unprivileged container: ✓
   - Nesting: ✓

3. **Template Tab:**
   - Storage: local
   - Template: `ubuntu-22.04` (or latest stable)

4. **Root Disk Tab:**
   - Storage: `local-lvm`
   - Disk size: `30 GB` (minimum)

5. **CPU Tab:**
   - Cores: `2-4` (depending on load)

6. **Memory Tab:**
   - Memory: `4096 MB` (4GB minimum)
   - Swap: `2048 MB`

7. **Network Tab:**
   - Name: `eth0`
   - Bridge: `vmbr0` (default)
   - IPv4: DHCP or static IP
   - Important: Note the IP address

8. **Finish**: Create container

### Step 2: Configure Container Network

Inside the container (via Proxmox console or SSH):

```bash
# Static IP configuration (optional but recommended)
sudo nano /etc/netplan/00-installer-config.yaml
```

Add:
```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: false
      addresses:
        - 192.168.1.100/24  # Adjust to your network
      routes:
        - to: 0.0.0.0/0
          via: 192.168.1.1
      nameservers:
        addresses: [1.1.1.1, 1.0.0.1]  # Cloudflare DNS
```

Apply:
```bash
sudo netplan apply
```

### Step 3: Enable Required Features

```bash
# Enable Docker nesting
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0

# Make persistent
echo 'kernel.apparmor_restrict_unprivileged_userns=0' | sudo tee -a /etc/sysctl.conf
```

---

## Container Configuration

### Build Configuration

Ensure you have a `.dockerignore` file:

```
node_modules/
dist/
.git/
.env
.env.local
.env.*.local
build.log
coverage/
.vscode/
.idea/
.DS_Store
```

### Environment Configuration

Create `.env.production` in your repository root:

```bash
# Copy from template
cp .env.production.example .env.production

# Edit with your values
nano .env.production
```

Fill in:
- `VITE_SENTRY_DSN` - Your Sentry project DSN
- `VITE_ROLLBAR_ACCESS_TOKEN` - Your Rollbar token
- `VITE_APP_VERSION` - Current version number

---

## Cloudflare DNS Setup

### Step 1: Add DNS Record

In Cloudflare Dashboard:

1. **Zone > DNS**
2. **Add Record**
   - **Type**: `A` (for IPv4) or `AAAA` (for IPv6)
   - **Name**: `indexer` (subdomain)
   - **Content**: Your public IP or Proxmox host's WAN IP
   - **TTL**: `Auto` (recommended)
   - **Proxy Status**: `DNS only` initially
   - **Save**

### Step 2: Test DNS Resolution

```bash
# From your dev machine
nslookup indexer.yourdomain.com
# or
dig indexer.yourdomain.com @1.1.1.1
```

Should resolve to your public IP.

### Step 3: Enable Proxy (Optional but Recommended)

Once SSL is working:

1. Click the record
2. **Proxy status**: Change to `Proxied`

Benefits:
- DDoS protection
- IP masking
- Global CDN for static assets

**Note**: Proxied mode requires HTTPS. HTTP will be redirected.

---

## SSL/TLS Certificate

### Option 1: Let's Encrypt (Recommended for $0)

#### Automatic Setup

Inside the LXC container:

```bash
# Run deployment script
curl -O https://raw.githubusercontent.com/yourusername/giac-book-indexer/main/deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh indexer.yourdomain.com admin@yourdomain.com
```

#### Manual Setup

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --standalone \
  -d indexer.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos \
  --non-interactive

# Certificates stored in:
# /etc/letsencrypt/live/indexer.yourdomain.com/
```

### Option 2: Cloudflare Origin CA Certificate (Free for Cloudflare customers)

1. **Cloudflare Dashboard > SSL/TLS > Origin Server**
2. **Create Certificate**
3. **Download origin certificate**
4. **Upload to container** `/etc/nginx/ssl/`

### Auto-Renewal Setup

Create cron job:

```bash
# Edit crontab
sudo crontab -e

# Add:
0 2 * * * certbot renew --quiet && systemctl reload nginx
```

---

## Deployment

### Step 1: SSH into Container

```bash
# From Proxmox host
pct exec <CTID> -- bash
# or SSH if you have SSH configured
ssh root@<container-ip>
```

### Step 2: Clone Repository

```bash
cd /opt
git clone https://github.com/yourusername/giac-book-indexer.git
cd giac-book-indexer
```

### Step 3: Run Automated Deployment

```bash
chmod +x deploy.sh
sudo ./deploy.sh indexer.yourdomain.com admin@yourdomain.com
```

### Step 4: Manual Verification

```bash
# Check containers running
docker-compose ps

# View logs
docker-compose logs -f app

# Test application
curl http://localhost:3000
```

### Step 5: Test HTTPS

```bash
# From outside the container
curl https://indexer.yourdomain.com
```

Should return HTML without SSL warnings.

---

## Post-Deployment Configuration

### Environment Variables

Update production environment:

```bash
# Edit the env file
sudo nano .env.production

# Update with actual values:
VITE_SENTRY_DSN=https://xxxxx@yyyyy.ingest.sentry.io/zzzzz
VITE_ROLLBAR_ACCESS_TOKEN=your_actual_token
VITE_APP_VERSION=1.0.0
```

Restart containers:

```bash
docker-compose restart app
```

### Firewall Rules (Proxmox Host)

```bash
# Allow HTTP/HTTPS traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Monitoring & Maintenance

### Container Health Checks

```bash
# View container status
docker-compose ps

# Check specific service logs
docker-compose logs app
docker-compose logs nginx

# Follow logs in real-time
docker-compose logs -f app

# Check container resource usage
docker stats
```

### Proxmox Monitoring

1. **Proxmox Web UI > Node > LXC Container**
2. **Summary tab** shows:
   - CPU usage
   - Memory usage
   - Disk usage
   - Network traffic

### Application Monitoring

- **Sentry Dashboard**: Error tracking and performance
- **Rollbar Dashboard**: Error reports and deployment tracking
- **Health endpoint**: `https://indexer.yourdomain.com/` (should return 200)

### Backup Strategy

```bash
# Manual backup
docker-compose exec app tar czf backup.tar.gz dist/

# Automated backup (via cron)
0 2 * * * cd /opt/giac-book-indexer && docker-compose exec -T app tar czf /backups/giac-$(date +\%Y\%m\%d).tar.gz dist/
```

### Updates & Patches

```bash
# Update containers
cd /opt/giac-book-indexer
git pull origin main
docker-compose build
docker-compose up -d

# Update Proxmox LXC OS packages
sudo apt-get update && sudo apt-get upgrade -y
```

### SSL Certificate Renewal

```bash
# Manual renewal (usually automatic)
sudo certbot renew --force-renewal -d indexer.yourdomain.com

# Check renewal status
sudo certbot renew --dry-run
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
docker-compose logs app

# Verify environment variables
docker-compose exec app env | grep VITE
```

### Certificate Errors

```bash
# Check certificate validity
sudo openssl x509 -in /etc/letsencrypt/live/indexer.yourdomain.com/fullchain.pem -text -noout

# Renew if needed
sudo certbot renew --force-renewal
```

### High Memory Usage

```bash
# Check what's using memory
docker stats

# Reduce memory allocation in docker-compose.yml
# Add: mem_limit: 512m
```

### DNS Not Resolving

```bash
# Test DNS
dig indexer.yourdomain.com @8.8.8.8

# Check Cloudflare DNS status
nslookup indexer.yourdomain.com 1.1.1.1

# Check nameservers
whois yourdomain.com | grep "Nameserver"
```

---

## Advanced: Load Balancing (Multiple Containers)

For HA setup with multiple containers:

1. Create 2-3 additional containers (same steps as above)
2. Configure DNS round-robin in Cloudflare (A records with same subdomain, different IPs)
3. Or use Proxmox's built-in HA features
4. Update nginx upstream configuration for backend pool

---

## Performance Tuning

### Container Resources

```bash
# Check current allocation
pct config 100  # Replace 100 with your CTID

# Increase CPU cores (if needed)
pct set 100 --cores 4

# Increase RAM
pct set 100 --memory 8192
```

### Nginx Optimization

```nginx
# In nginx.conf - worker optimization
worker_processes auto;
worker_rlimit_nofile 65535;

# Connection settings
keepalive_timeout 65;
keepalive_requests 100;
```

### Docker Resource Limits

In `docker-compose.yml`:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '1'
          memory: 512M
```

---

## Security Hardening

### Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Container Security

```bash
# Update all packages
docker-compose exec app apt-get update && apt-get upgrade -y

# Remove unnecessary packages
docker-compose exec app apt-get autoremove -y
```

### Cloudflare Settings

1. **SSL/TLS > Overview**: Set to `Full` or `Full (strict)`
2. **Page Rules**: Add `indexer.yourdomain.com` rule
3. **WAF**: Enable Cloudflare's Web Application Firewall
4. **Rate Limiting**: Set up DDoS protection

---

## Cost Breakdown

| Component | Cost |
|-----------|------|
| Proxmox Server | ~$300-1000 (one-time) |
| LXC Container | Included (free) |
| Let's Encrypt SSL | Free |
| Cloudflare DNS | $0-20/month (depending on plan) |
| Domain | $10-15/year |
| **Total Monthly** | **~$1-3** (for DNS only) |

---

## Support & Resources

- **Proxmox**: https://pve.proxmox.com/wiki/
- **Let's Encrypt**: https://letsencrypt.org/
- **Cloudflare**: https://support.cloudflare.com/
- **Docker**: https://docs.docker.com/
- **Nginx**: https://nginx.org/en/docs/

---

## Next Steps

1. ✅ Set up Proxmox infrastructure
2. ✅ Create LXC container
3. ✅ Configure Cloudflare DNS
4. ✅ Deploy with `deploy.sh`
5. ✅ Verify HTTPS works
6. ✅ Set up monitoring
7. ✅ Configure automatic backups
8. ✅ Monitor logs and performance

Good luck! 🚀
