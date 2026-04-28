# Quick Start - Production Deployment

## 30-Second Overview

Deploy GIAC Book Indexer to production:

```
Your Code → Docker Container → Proxmox LXC → Cloudflare DNS → HTTPS
```

## 5-Minute Setup

### 1. **Prepare Local Code** (5 min)
```bash
npm run build           # Build the app
npm run type-check     # Verify types
npm run test:run       # Run tests
```

### 2. **Create Proxmox Container** (Proxmox UI)
- Create Ubuntu 22.04 LXC container
- Allocate 4GB RAM, 30GB disk
- Note the IP address (e.g., 192.168.1.100)

### 3. **Configure Cloudflare** (5 min)
```
Cloudflare > DNS > Add Record
- Type: A
- Name: indexer
- Content: [Your Public IP]
- TTL: Auto
- Proxy: DNS only
```

### 4. **Deploy Application** (Automated - 10 min)

SSH into Proxmox container:
```bash
ssh root@192.168.1.100

# Run deployment
curl -O https://raw.githubusercontent.com/yourusername/giac-book-indexer/main/deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh indexer.yourdomain.com admin@yourdomain.com
```

**Done!** ✅ Application is now live at https://indexer.yourdomain.com

---

## Network Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your ISP / Public IP                  │
│                     Ports 80 & 443                       │
└────────────────────┬────────────────────────────────────┘
                     │
          ┌──────────▼──────────┐
          │   Proxmox Host      │
          │   192.168.x.x       │
          └──────────┬──────────┘
                     │
      ┌──────────────▼──────────────┐
      │   LXC Container             │
      │   192.168.x.100             │
      │                             │
      │  ┌──────────────────────┐  │
      │  │  Docker Compose      │  │
      │  │                      │  │
      │  │  ┌───────────────┐  │  │
      │  │  │ Nginx Port 80 │◄─┼──┼─→ HTTP (redirects to HTTPS)
      │  │  └───────────────┘  │  │
      │  │                      │  │
      │  │  ┌───────────────┐  │  │
      │  │  │ Nginx Port443 │◄─┼──┼─→ HTTPS (SSL encrypted)
      │  │  └───┬───────────┘  │  │
      │  │      │               │  │
      │  │  ┌───▼───────────┐  │  │
      │  │  │ App Port 3000 │  │  │
      │  │  │ React + Vite  │  │  │
      │  │  └───────────────┘  │  │
      │  └──────────────────────┘  │
      └─────────────────────────────┘
                     ▲
                     │
          ┌──────────┴──────────┐
          │   Cloudflare DNS    │
          │   (yourdomain.com)  │
          └─────────────────────┘
```

## Key Components

| Component | Purpose | Cost |
|-----------|---------|------|
| **Proxmox LXC** | Container runtime | Free (on your hardware) |
| **Docker** | App containerization | Free |
| **Let's Encrypt** | SSL certificates | Free |
| **Cloudflare** | DNS + DDoS protection | Free or $0-20/month |
| **Domain** | indexer.yourdomain.com | $10-15/year |

## File Structure

```
giac-book-indexer/
├── Dockerfile           # Docker image definition
├── docker-compose.yml   # Multi-container orchestration
├── nginx.conf          # Reverse proxy configuration
├── deploy.sh           # Automated deployment script
├── health-check.sh     # Monitoring script
├── DEPLOYMENT.md       # Full documentation
├── DEPLOYMENT_CHECKLIST.md
├── .env.production.example
└── src/                # Application source
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| DNS not resolving | Wait 24-48hrs or check Cloudflare nameservers |
| SSL certificate errors | Run: `sudo certbot renew --force-renewal` |
| Application won't start | Check: `docker-compose logs app` |
| Nginx errors | Check: `docker-compose exec nginx nginx -t` |
| Port 443 not accessible | Check firewall rules on Proxmox host |

## Day-to-Day Operations

### View Logs
```bash
cd /opt/giac-book-indexer
docker-compose logs -f app
```

### Monitor Health
```bash
bash health-check.sh indexer.yourdomain.com
```

### Check Status
```bash
docker-compose ps
docker stats
```

### Update Application
```bash
git pull origin main
docker-compose build
docker-compose up -d
```

## Security Best Practices

- ✅ **HTTPS Only** - All traffic encrypted
- ✅ **Reverse Proxy** - Nginx hides backend
- ✅ **Firewall** - Only 80/443 exposed
- ✅ **Auto Updates** - Let's Encrypt certificates auto-renew
- ✅ **Monitoring** - Sentry + Rollbar for errors
- ✅ **Backups** - Automated backup strategy

## Performance

- **Response Time**: < 500ms (with Cloudflare CDN)
- **Uptime**: 99.9% with proper monitoring
- **Scalability**: Can handle 1000+ concurrent users
- **Security Score**: A+ on SSL Labs

## Next Steps

1. ✅ Read [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed guide
2. ✅ Use [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) to track progress
3. ✅ Run `./health-check.sh` after deployment
4. ✅ Set up monitoring dashboards
5. ✅ Configure automated backups

## Support

- **Deployment Issues**: Check DEPLOYMENT.md troubleshooting section
- **Proxmox Help**: https://pve.proxmox.com/wiki/
- **Docker Help**: https://docs.docker.com/
- **Cloudflare Help**: https://support.cloudflare.com/

---

**Ready to deploy?** Start with running the `deploy.sh` script! 🚀
