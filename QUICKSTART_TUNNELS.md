# Cloudflare Tunnels Quick Start (No Static IP, No Remote Repo)

## 30-Second Summary

```
You                 Cloudflare              Your Users
  |                    |                        |
  | (cloudflared)      |                        |
  |---Tunnel-----------|                        |
  |   (outbound only)   |                        |
  |                    |----HTTPS encrypted---->|
  
✅ Works with any IP (dynamic OK)
✅ No firewall holes
✅ No port forwarding
✅ Free everything
```

---

## Deployment Steps

### Phase 1: Proxmox Container (5 minutes)

1. **Create LXC in Proxmox**
   - Ubuntu 22.04
   - 4GB RAM, 30GB disk
   - Note IP address (e.g., 192.168.1.100)

2. **SSH to container**
   ```bash
   ssh root@192.168.1.100
   ```

### Phase 2: Copy Application Code (Your Dev Machine)

Your repository is available at `https://github.com/404xN0TF0UND/Dexter`, but if your current environment cannot push from CLI, use the local transfer method below.

**Windows PowerShell:**
```powershell
cd c:\Users\ronni\OneDrive\School\Dexter

# Create archive (excludes node_modules, dist, .git)
tar -czf giac-app.tar.gz `
  --exclude=node_modules `
  --exclude=dist `
  --exclude=.git `
  --exclude=.env.production `
  .

# Copy to Proxmox container
scp giac-app.tar.gz root@192.168.1.100:/tmp/
```

If you want to use Git instead, push the repository from Windows or GitHub Desktop first and then clone on the container:
```bash
git clone https://github.com/404xN0TF0UND/Dexter.git /opt/giac-book-indexer
```

If you cannot use Git on the container, the archive transfer is the recommended fallback.

### Phase 3: Deploy on Proxmox Container

**In container (SSH):**

```bash
# Extract files
cd /opt
tar xzf /tmp/giac-app.tar.gz
mv Dexter giac-book-indexer  # or rename as needed
cd giac-book-indexer

# Create production environment
cp .env.production.example .env.production

# Edit to add your credentials (if you have Sentry/Rollbar)
nano .env.production
```

**Fill in these fields (or leave empty to skip):**
```
VITE_SENTRY_DSN=
VITE_ROLLBAR_ACCESS_TOKEN=
VITE_APP_VERSION=1.0.0
```

Save and exit (Ctrl+X, Y, Enter)

### Phase 4: Run Automated Deploy Script

Still in the container:

```bash
chmod +x deploy-local-tunnel.sh
sudo ./deploy-local-tunnel.sh indexer.yourdomain.com giac-indexer
```

The script will:
- ✅ Install Docker
- ✅ Install cloudflared
- ✅ Build your app in Docker
- ✅ Start application on localhost:3000
- ✅ Launch browser for Cloudflare login
- ✅ Create tunnel
- ✅ Setup systemd auto-start

### Phase 5: Configure Cloudflare DNS (3 minutes)

**Go to Cloudflare Dashboard:**
1. https://dash.cloudflare.com/
2. Select your domain
3. **DNS > Records**
4. **Add Record**
   - **Type:** CNAME
   - **Name:** indexer
   - **Content:** giac-indexer.cfargotunnel.com
   - **Proxy Status:** Proxied
   - **TTL:** Auto

5. Click **Save**

### Phase 6: Test It Works

After 1-2 minutes for DNS:

```bash
# From container or anywhere on internet
curl https://indexer.yourdomain.com

# Should return HTML (no SSL errors)
```

**Done!** 🎉 Your app is live at https://indexer.yourdomain.com

---

## File Structure

You now have these key files in `/opt/giac-book-indexer/`:

```
├── docker-compose.tunnel.yml  ← Use this (simpler, no nginx/ssl)
├── deploy-local-tunnel.sh     ← Automated deployment
├── .env.production            ← Your secrets (created by script)
├── Dockerfile                 ← Container image definition
├── package.json               ← App dependencies
├── src/                       ← Your React app source
└── ... (other files)
```

---

## Managing Your Deployment

### View Application Logs
```bash
docker-compose -f docker-compose.tunnel.yml logs -f app
```

### View Tunnel Status
```bash
sudo journalctl -u cloudflared -f
```

### Restart Application
```bash
docker-compose -f docker-compose.tunnel.yml restart app
```

### Update Code

**From your Windows dev machine:**
```powershell
# 1. Make your code changes locally
# 2. Compress updated code
cd c:\Users\ronni\OneDrive\School\Dexter
tar -czf giac-app.tar.gz --exclude=node_modules --exclude=dist --exclude=.git .

# 3. Copy to Proxmox
scp giac-app.tar.gz root@192.168.1.100:/tmp/

# 4. On Proxmox (via SSH), update and restart
ssh root@192.168.1.100
cd /opt/giac-book-indexer
tar xzf /tmp/giac-app.tar.gz --strip-components=1
docker-compose -f docker-compose.tunnel.yml build
docker-compose -f docker-compose.tunnel.yml up -d
```

---

## Troubleshooting

### "DNS not resolving"
```bash
# Check if CNAME was created correctly in Cloudflare
dig indexer.yourdomain.com

# Wait 1-2 minutes and try again
```

### "Connection refused"
```bash
# Verify app is running
docker-compose -f docker-compose.tunnel.yml ps

# Check app logs
docker-compose -f docker-compose.tunnel.yml logs app
```

### "Tunnel not connected"
```bash
# Check tunnel status
sudo systemctl status cloudflared

# View tunnel logs
sudo journalctl -u cloudflared -n 30

# Restart tunnel
sudo systemctl restart cloudflared
```

### "404 error from app"
```bash
# Verify app responds locally
curl http://localhost:3000

# Check tunnel config
sudo cat /etc/cloudflared/config.yml
```

---

## Common Commands Reference

```bash
# View everything running
docker-compose -f docker-compose.tunnel.yml ps

# Stop all services
docker-compose -f docker-compose.tunnel.yml down

# Restart app
docker-compose -f docker-compose.tunnel.yml restart app

# View application logs
docker-compose -f docker-compose.tunnel.yml logs -f app

# Check tunnel connection
cloudflared tunnel info giac-indexer

# Manual tunnel test (without systemd)
cloudflared tunnel run giac-indexer

# View systemd tunnel logs
sudo journalctl -u cloudflared -f

# Check DNS resolution
dig indexer.yourdomain.com

# Test HTTPS connection
curl https://indexer.yourdomain.com

# Monitor container resources
docker stats
```

---

## Why Cloudflare Tunnels Instead of Static IP

| Feature | Static IP | Cloudflare Tunnel |
|---------|-----------|-------------------|
| Dynamic IP OK | ❌ | ✅ |
| Firewall holes | ❌ | ✅ |
| Port forwarding | ❌ | ✅ |
| Setup time | ~30 min | ~5 min |
| SSL renewal | Manual | Automatic |
| DDoS protection | ❌ | ✅ |
| Cost | $0 | $0 |

---

## What Cloudflare Tunnels Does

1. **Your server** connects outbound to Cloudflare (never exposes port 80/443)
2. **Cloudflare** listens for incoming HTTPS requests
3. **Requests** are routed through the tunnel to your app
4. **Response** comes back through tunnel to user
5. **Your IP** stays completely hidden and private

---

## Architecture Diagram

```
Your App (Proxmox Container)
    ↓
    |-- Docker: giac-book-indexer
    |-- Port:   localhost:3000 (NOT exposed to internet)
    ↓
cloudflared daemon
    ↓
    |-- Creates SECURE OUTBOUND connection to Cloudflare
    |-- (NOT inbound listening on port 80/443)
    ↓
Cloudflare Edge Servers
    ↓
    |-- Listens on: indexer.yourdomain.com
    |-- SSL:       Automatic (Cloudflare managed)
    |-- DDoS:      Protected
    ↓
Internet Users
    ↓
    |-- https://indexer.yourdomain.com
    |-- No direct connection to your IP
    |-- No exposure of your home network
```

---

## Support

- **Full details:** See `DEPLOYMENT_CLOUDFLARE_TUNNELS.md`
- **Cloudflare docs:** https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- **Questions?** Check the troubleshooting section above

---

## Summary

✅ **Simpler than static IP setup**
✅ **Works with dynamic IP**
✅ **No firewall holes**
✅ **Automatic SSL**
✅ **DDoS protection**
✅ **Completely free**

Your app will be production-ready in ~10 minutes! 🚀
