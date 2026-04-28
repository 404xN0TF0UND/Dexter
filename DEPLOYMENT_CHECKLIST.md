# Production Deployment Checklist

## Pre-Deployment (Development)

### Code & Build
- [ ] All tests passing (`npm run test:run`)
- [ ] TypeScript checks passing (`npm run type-check`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] No console errors in build output

### Security
- [ ] Remove all console.log and debug statements
- [ ] API keys/secrets only in `.env.production`
- [ ] Sensitive data never committed to git
- [ ] `.gitignore` includes `.env.production`
- [ ] CSP headers configured in nginx.conf
- [ ] Security headers configured

### Environment
- [ ] Create `.env.production` with all required variables
- [ ] `VITE_SENTRY_DSN` configured
- [ ] `VITE_ROLLBAR_ACCESS_TOKEN` configured
- [ ] `VITE_APP_VERSION` updated
- [ ] Domain name finalized

---

## Infrastructure Setup (Proxmox)

### Hardware & Networking
- [ ] LXC container created (min 4GB RAM, 30GB disk)
- [ ] Static IP assigned to container
- [ ] Firewall rules allow ports 80 and 443
- [ ] Network connectivity tested
- [ ] SSH access working

### Docker & Dependencies
- [ ] Docker installed in container
- [ ] Docker Compose installed
- [ ] Git installed
- [ ] Certbot/Let's Encrypt installed
- [ ] Nginx available

### Repository
- [ ] Repository cloned to `/opt/giac-book-indexer`
- [ ] `.env.production` file created with actual values
- [ ] Repository permissions correct (755 for scripts)

---

## DNS & SSL Setup

### Cloudflare Configuration
- [ ] Domain added to Cloudflare
- [ ] Nameservers updated (wait 24-48 hours if new)
- [ ] A record created for subdomain
  - Name: `indexer`
  - Content: Your public IP
  - TTL: Auto
  - Proxy: DNS only (until SSL works)
- [ ] DNS propagation verified (`dig indexer.yourdomain.com`)

### SSL Certificate
- [ ] Let's Encrypt certificate obtained
  - Domain: `indexer.yourdomain.com`
  - Email: Your admin email
  - Certificate stored in `/etc/letsencrypt/live/indexer.yourdomain.com/`
- [ ] Certificate ownership verified (curl https://indexer.yourdomain.com)
- [ ] Auto-renewal cron job configured
- [ ] Test renewal successful (`certbot renew --dry-run`)

### Cloudflare SSL (Optional)
- [ ] SSL/TLS mode set to "Full" or "Full (strict)"
- [ ] WAF enabled
- [ ] Rate limiting configured

---

## Deployment

### Container Build & Start
- [ ] Docker image builds without errors (`docker-compose build`)
- [ ] Containers start successfully (`docker-compose up -d`)
- [ ] Application responds on port 3000
- [ ] Nginx reverse proxy working
- [ ] Health checks passing

### Verification
- [ ] HTTP responds and redirects to HTTPS
- [ ] HTTPS returns 200 OK
- [ ] No SSL warnings in browser
- [ ] Application loads fully
- [ ] All assets load (CSS, JS, images)
- [ ] Responsiveness tested (mobile/desktop)

### Monitoring Setup
- [ ] Sentry DSN verified (check dashboard for test event)
- [ ] Rollbar token verified (check dashboard)
- [ ] Application logs accessible
- [ ] Docker container logs clean

---

## Post-Deployment

### Monitoring & Health
- [ ] Application responds to requests
- [ ] No errors in Sentry dashboard
- [ ] No errors in Rollbar dashboard
- [ ] Application logs show normal operation
- [ ] CPU/Memory usage reasonable
- [ ] Disk usage acceptable

### Backups & Recovery
- [ ] Backup strategy defined
- [ ] First backup created and verified
- [ ] Backup location documented
- [ ] Recovery procedure tested
- [ ] Disaster recovery plan documented

### Documentation
- [ ] Deployment completed documented
- [ ] Access credentials stored securely
- [ ] Runbook created for common tasks
- [ ] Emergency contact information updated
- [ ] Team notified of new environment

### Performance
- [ ] Response times acceptable (< 1s)
- [ ] Cloudflare cache working
- [ ] Static assets cached
- [ ] Database queries optimized

---

## Ongoing Maintenance

### Weekly Tasks
- [ ] Monitor logs for errors
- [ ] Check disk usage
- [ ] Verify automatic backups ran
- [ ] Monitor error tracking (Sentry/Rollbar)

### Monthly Tasks
- [ ] Review performance metrics
- [ ] Update dependencies (`npm update`)
- [ ] Review security advisories
- [ ] Test backup restoration
- [ ] Check SSL certificate expiry (should be 30+ days)

### Quarterly Tasks
- [ ] Full security audit
- [ ] Review and update firewall rules
- [ ] Database maintenance
- [ ] Performance optimization review
- [ ] Capacity planning

### Annually
- [ ] Major version upgrades
- [ ] Infrastructure review
- [ ] Cost optimization review
- [ ] Disaster recovery drill

---

## Troubleshooting Checklist

If deployment fails, check:

- [ ] Network connectivity to Proxmox container
- [ ] DNS resolution working
- [ ] SSL certificate valid and present
- [ ] Docker containers running (`docker-compose ps`)
- [ ] Application logs for errors (`docker-compose logs app`)
- [ ] Nginx configuration valid (`docker-compose exec nginx nginx -t`)
- [ ] Ports 80/443 accessible from outside
- [ ] Firewall not blocking traffic
- [ ] Enough disk space on container
- [ ] Enough memory (monitoring with `docker stats`)

---

## Rollback Procedure

If deployment needs rollback:

```bash
# Stop current version
docker-compose down

# Restore from backup
tar xzf backup.tar.gz

# Start previous version
docker-compose up -d

# Verify
curl https://indexer.yourdomain.com
```

---

## Sign-Off

- [ ] Project Manager: _______________  Date: _______
- [ ] DevOps/Admin: ________________  Date: _______
- [ ] Security Review: _____________  Date: _______

---

## Contacts & Resources

| Role | Name | Email | Phone |
|------|------|-------|-------|
| Admin | | | |
| Secondary | | | |
| Emergency | | | |

**Useful Commands:**
```bash
# View logs
docker-compose logs -f app

# SSH to container
pct exec <CTID> bash

# SSL status
certbot certificates

# Renew SSL
sudo certbot renew --force-renewal

# Restart app
docker-compose restart app

# Health check
curl https://indexer.yourdomain.com
```

**Important URLs:**
- Application: https://indexer.yourdomain.com
- Sentry: https://sentry.io/
- Rollbar: https://rollbar.com/
- Proxmox: https://proxmox-host:8006
- Cloudflare: https://dash.cloudflare.com/
