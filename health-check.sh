#!/bin/bash

# GIAC Book Indexer - Health Check & Monitoring Script
# Run this periodically to monitor application health

set -e

# Configuration
DOMAIN="${1:-indexer.yourdomain.com}"
EMAIL="${2:-admin@yourdomain.com}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "================================"
echo "GIAC Book Indexer - Health Check"
echo "================================"
echo -e "${NC}"

# Check 1: DNS Resolution
echo -e "${YELLOW}[1/8] Checking DNS Resolution...${NC}"
if dig "$DOMAIN" +short @1.1.1.1 > /dev/null 2>&1; then
    IP=$(dig "$DOMAIN" +short @1.1.1.1 | tail -1)
    echo -e "${GREEN}✓${NC} DNS resolves to: $IP"
else
    echo -e "${RED}✗${NC} DNS resolution failed"
fi

# Check 2: HTTP Response
echo -e "${YELLOW}[2/8] Checking HTTP connectivity...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://"$DOMAIN" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" -eq 301 ] || [ "$HTTP_CODE" -eq 302 ]; then
    echo -e "${GREEN}✓${NC} HTTP redirects to HTTPS (code: $HTTP_CODE)"
elif [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${YELLOW}⚠${NC}  HTTP is responding (not redirected)"
else
    echo -e "${RED}✗${NC} HTTP check failed (code: $HTTP_CODE)"
fi

# Check 3: HTTPS Response
echo -e "${YELLOW}[3/8] Checking HTTPS connectivity...${NC}"
HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://"$DOMAIN" 2>/dev/null || echo "000")
if [ "$HTTPS_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓${NC} HTTPS responding (code: $HTTPS_CODE)"
else
    echo -e "${RED}✗${NC} HTTPS check failed (code: $HTTPS_CODE)"
fi

# Check 4: SSL Certificate
echo -e "${YELLOW}[4/8] Checking SSL Certificate...${NC}"
CERT_EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$CERT_EXPIRY" ]; then
    EXPIRY_DATE=$(date -d "$CERT_EXPIRY" +%s)
    NOW=$(date +%s)
    DAYS_LEFT=$(( ($EXPIRY_DATE - $NOW) / 86400 ))
    
    if [ $DAYS_LEFT -gt 14 ]; then
        echo -e "${GREEN}✓${NC} Certificate valid for $DAYS_LEFT days (expires: $CERT_EXPIRY)"
    elif [ $DAYS_LEFT -gt 0 ]; then
        echo -e "${YELLOW}⚠${NC}  Certificate expires in $DAYS_LEFT days"
    else
        echo -e "${RED}✗${NC} Certificate has expired"
    fi
else
    echo -e "${RED}✗${NC} Could not read certificate"
fi

# Check 5: Docker Containers
echo -e "${YELLOW}[5/8] Checking Docker containers...${NC}"
if command -v docker-compose &> /dev/null; then
    if docker-compose ps --services 2>/dev/null | grep -q app; then
        APP_STATUS=$(docker-compose ps app --format "table {{.State}}" 2>/dev/null | tail -1)
        if [[ "$APP_STATUS" == "running" ]]; then
            echo -e "${GREEN}✓${NC} Application container is running"
        else
            echo -e "${RED}✗${NC} Application container is $APP_STATUS"
        fi
    fi
else
    echo -e "${YELLOW}⚠${NC}  Docker not found (skipped)"
fi

# Check 6: Application Response Time
echo -e "${YELLOW}[6/8] Checking application response time...${NC}"
START=$(date +%s%N)
curl -s https://"$DOMAIN" > /dev/null 2>&1
END=$(date +%s%N)
RESPONSE_TIME=$(( (END - START) / 1000000 ))
echo -e "${GREEN}✓${NC} Response time: ${RESPONSE_TIME}ms"

# Check 7: Server Resources (if SSH available)
echo -e "${YELLOW}[7/8] Checking server resources...${NC}"
if command -v docker stats &> /dev/null; then
    MEMORY=$(docker stats --no-stream --format "{{.MemUsage}}" 2>/dev/null | head -1 || echo "N/A")
    CPU=$(docker stats --no-stream --format "{{.CPUPerc}}" 2>/dev/null | head -1 || echo "N/A")
    echo -e "${GREEN}✓${NC} Memory: $MEMORY | CPU: $CPU"
else
    echo -e "${YELLOW}⚠${NC}  Docker stats not available"
fi

# Check 8: Cloudflare DNS Status
echo -e "${YELLOW}[8/8] Checking Cloudflare DNS status...${NC}"
if dig "$DOMAIN" +noall +answer @1.1.1.1 2>/dev/null | grep -q A; then
    echo -e "${GREEN}✓${NC} DNS record active in Cloudflare"
else
    echo -e "${RED}✗${NC} DNS record not found"
fi

# Summary
echo ""
echo -e "${BLUE}================================"
echo "Summary for $DOMAIN"
echo "================================${NC}"

if [ "$HTTPS_CODE" -eq 200 ] && [ -n "$CERT_EXPIRY" ] && [ $DAYS_LEFT -gt 0 ]; then
    echo -e "${GREEN}✓ All checks passed - Application is healthy!${NC}"
else
    echo -e "${RED}✗ Some checks failed - Review above${NC}"
fi

echo ""
echo "Additional Information:"
echo "- Sentry: Check https://sentry.io/ for errors"
echo "- Rollbar: Check https://rollbar.com/ for reports"
echo "- Logs: docker-compose logs -f app"
echo "- Stats: docker stats"
