# Docker Deployment to LXC

Simple guide to deploy GIAC Book Indexer as a Docker container in an LXC container.

## Quick Start (5 minutes)

### 1. Prepare Code Locally
```bash
npm run build           # Build the app
npm run type-check     # Verify types
npm run test:run       # Run tests
```

### 2. Create LXC Container

In Proxmox UI:
- Create new LXC container with Ubuntu 22.04
- Allocate 2GB+ RAM, 20GB+ disk
- **Enable nesting** - Required for Docker!

### 3. Install Docker in LXC Container

SSH into the container and run:
```bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose git
usermod -aG docker root
systemctl start docker
systemctl enable docker
```

### 4. Deploy Application

```bash
# Clone repository
git clone https://github.com/404xN0TF0UND/Dexter /opt/giac-book-indexer
cd /opt/giac-book-indexer

# Start containers
docker compose up -d
```

The app runs on `localhost:3000` inside the container.

## Accessing the Application

### From Host Machine
```bash
# Get container IP
docker inspect giac-book-indexer | grep IPAddress

# Access via: http://<container-ip>:3000
```

### From Outside Network
Set up a reverse proxy on the Proxmox host or configure network forwarding.

## Environment Variables

Create `.env.production` in the repository root:
```bash
VITE_APP_ENV=production
VITE_APP_VERSION=1.0.0
VITE_SENTRY_DSN=<optional>
VITE_ROLLBAR_ACCESS_TOKEN=<optional>
```

## Managing the Container

```bash
# View logs
docker compose logs -f

# Stop
docker compose down

# Restart
docker compose restart

# Remove (clean slate)
docker compose down -v
```

## Troubleshooting

### Docker won't start in LXC
- **Enable nesting** in Proxmox when creating the LXC container
- Check: `cat /proc/sys/kernel/unprivileged_userns_clone` (should return 1)

### Port already in use
```bash
docker compose down
docker compose up -d
```

### App crashes immediately
```bash
docker compose logs
# Check error messages and fix
```

### Out of memory
Increase LXC container RAM in Proxmox, or reduce resource limits in `docker-compose.yml`.

## Production Considerations

- **Reverse Proxy**: Use HAProxy or another tool on the Proxmox host to expose externally
- **SSL/TLS**: Configure at the host level with Let's Encrypt or self-signed certificates
- **Backups**: Volume mount important data to persistent storage
- **Resource Limits**: Configured in `docker-compose.yml`
- **Health Checks**: Built into container, monitored automatically
- **Logs**: Use `docker compose logs` or configure centralized logging

## Architecture

```
Internet
   ↓
Proxmox Host
   ↓
LXC Container
   ↓
Docker Container (giac-book-indexer)
   ↓
Vite App on :3000
```

## Common Tasks

### Check if app is running
```bash
docker compose ps
```

### View real-time logs
```bash
docker compose logs -f app
```

### Rebuild without cache
```bash
docker compose build --no-cache
docker compose up -d
```

### SSH into running container
```bash
docker compose exec app sh
```
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
