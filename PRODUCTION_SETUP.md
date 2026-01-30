# Bastion Production Setup Guide

Complete guide for deploying Bastion to production for commercial use.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Database Setup](#database-setup)
3. [Backend Deployment](#backend-deployment)
4. [CLI Distribution](#cli-distribution)
5. [Dashboard Deployment](#dashboard-deployment)
6. [Security Hardening](#security-hardening)
7. [Monitoring & Logging](#monitoring--logging)
8. [Scaling Considerations](#scaling-considerations)
9. [Backup & Recovery](#backup--recovery)

---

## System Requirements

### Backend Server
- **CPU:** 2+ cores
- **RAM:** 4GB minimum, 8GB recommended
- **Storage:** 50GB+ SSD
- **OS:** Ubuntu 22.04 LTS or similar

### Database
- **PostgreSQL:** 14+
- **RAM:** 8GB minimum
- **Storage:** 100GB+ SSD with automatic backups

### Dependencies
- Node.js 18+
- PostgreSQL 14+
- Redis 7+ (optional, for rate limiting cache)
- Nginx (for reverse proxy)

---

## Database Setup

### 1. Install PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create Database and User

```bash
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE bastion_production;
CREATE USER bastion WITH ENCRYPTED PASSWORD 'your-secure-password-here';
GRANT ALL PRIVILEGES ON DATABASE bastion_production TO bastion;
\q
```

### 3. Configure PostgreSQL for Production

Edit `/etc/postgresql/14/main/postgresql.conf`:

```conf
# Performance tuning
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 2621kB
min_wal_size = 1GB
max_wal_size = 4GB

# Connection settings
max_connections = 200

# Logging
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000  # Log slow queries (>1s)
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### 4. Enable Automatic Backups

```bash
# Install pg_backup script
sudo apt install postgresql-contrib

# Create backup directory
sudo mkdir -p /var/backups/postgresql
sudo chown postgres:postgres /var/backups/postgresql

# Add cron job for daily backups
sudo crontab -e -u postgres

# Add this line:
0 2 * * * pg_dump bastion_production | gzip > /var/backups/postgresql/bastion_$(date +\%Y\%m\%d).sql.gz

# Keep only last 30 days
0 3 * * * find /var/backups/postgresql -name "bastion_*.sql.gz" -mtime +30 -delete
```

---

## Backend Deployment

### 1. Clone and Setup

```bash
# Clone repository
git clone https://github.com/your-org/bastion.git
cd bastion/backend

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### 2. Environment Configuration

Create `/etc/bastion/backend.env`:

```bash
# Database
DATABASE_URL="postgresql://bastion:your-password@localhost:5432/bastion_production"

# Server
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Security
JWT_SECRET="generate-a-secure-random-string-here"
API_KEY_PREFIX="bst_"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/bastion/backend.log

# Optional: Redis for caching
REDIS_URL=redis://localhost:6379

# Optional: Sentry for error tracking
SENTRY_DSN=your-sentry-dsn-here
```

**Security Note:** Generate secure secrets:
```bash
# JWT Secret
openssl rand -base64 32

# API Key encryption key
openssl rand -hex 32
```

### 3. Run Database Migrations

```bash
npm run db:push
```

### 4. Create Systemd Service

Create `/etc/systemd/system/bastion-backend.service`:

```ini
[Unit]
Description=Bastion Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=bastion
WorkingDirectory=/opt/bastion/backend
EnvironmentFile=/etc/bastion/backend.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/bastion

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

### 5. Start Backend

```bash
# Create bastion user
sudo useradd -r -s /bin/false bastion

# Create log directory
sudo mkdir -p /var/log/bastion
sudo chown bastion:bastion /var/log/bastion

# Install backend
sudo mkdir -p /opt/bastion
sudo cp -r backend /opt/bastion/
sudo chown -R bastion:bastion /opt/bastion

# Start service
sudo systemctl daemon-reload
sudo systemctl start bastion-backend
sudo systemctl enable bastion-backend

# Check status
sudo systemctl status bastion-backend
```

### 6. Setup Nginx Reverse Proxy

Create `/etc/nginx/sites-available/bastion-api`:

```nginx
upstream bastion_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name api.bastion.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.bastion.yourdomain.com;

    # SSL Configuration (use certbot for Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.bastion.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.bastion.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Request size limits
    client_max_body_size 10M;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Proxy to backend
    location / {
        proxy_pass http://bastion_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://bastion_backend/health;
        access_log off;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/bastion-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Setup SSL Certificate

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.bastion.yourdomain.com

# Auto-renewal (already configured by certbot)
```

---

## CLI Distribution

### 1. Build CLI for Multiple Platforms

```bash
cd bastion/cli

# Build for Linux (x86_64)
cargo build --release --target x86_64-unknown-linux-gnu

# Build for macOS (Intel)
cargo build --release --target x86_64-apple-darwin

# Build for macOS (ARM)
cargo build --release --target aarch64-apple-darwin

# Build for Windows
cargo build --release --target x86_64-pc-windows-gnu
```

### 2. Create Installation Script

Create `install.sh`:

```bash
#!/bin/bash

set -e

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Map architecture names
case "$ARCH" in
    x86_64|amd64)
        ARCH="x64"
        ;;
    aarch64|arm64)
        ARCH="arm64"
        ;;
    *)
        echo "Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

# Download URL
VERSION="0.1.0"
BINARY_NAME="bastion"
DOWNLOAD_URL="https://github.com/your-org/bastion/releases/download/v${VERSION}/bastion-${OS}-${ARCH}"

echo "Installing Bastion CLI..."
echo "OS: $OS, Architecture: $ARCH"

# Download binary
echo "Downloading from $DOWNLOAD_URL..."
curl -L -o /tmp/bastion "$DOWNLOAD_URL"

# Make executable
chmod +x /tmp/bastion

# Install to /usr/local/bin
echo "Installing to /usr/local/bin/bastion..."
sudo mv /tmp/bastion /usr/local/bin/bastion

# Verify installation
bastion --version

echo "✅ Bastion CLI installed successfully!"
echo ""
echo "Next steps:"
echo "1. Run: bastion login --key your-api-key"
echo "2. Run: bastion init"
echo "3. Run: bastion start -- your-agent-command"
```

### 3. Distribute via Package Managers

**Homebrew (macOS):**

Create a Homebrew tap:
```ruby
# Formula/bastion.rb
class Bastion < Formula
  desc "Programmable firewall for AI agents"
  homepage "https://github.com/your-org/bastion"
  url "https://github.com/your-org/bastion/archive/v0.1.0.tar.gz"
  sha256 "your-sha256-here"
  license "MIT"

  depends_on "rust" => :build

  def install
    cd "cli" do
      system "cargo", "build", "--release"
      bin.install "target/release/bastion-cli" => "bastion"
    end
  end

  test do
    system "#{bin}/bastion", "--version"
  end
end
```

**APT (Ubuntu/Debian):**

Create `.deb` package:
```bash
mkdir -p bastion_0.1.0_amd64/DEBIAN
mkdir -p bastion_0.1.0_amd64/usr/local/bin

# Create control file
cat > bastion_0.1.0_amd64/DEBIAN/control <<EOF
Package: bastion
Version: 0.1.0
Architecture: amd64
Maintainer: Your Name <your@email.com>
Description: Programmable firewall for AI agents
EOF

# Copy binary
cp target/release/bastion-cli bastion_0.1.0_amd64/usr/local/bin/bastion

# Build package
dpkg-deb --build bastion_0.1.0_amd64
```

---

## Dashboard Deployment

### 1. Build Dashboard

```bash
cd bastion/dashboard

# Install dependencies
npm install

# Build for production
npm run build
```

### 2. Serve with Nginx

Add to Nginx config `/etc/nginx/sites-available/bastion-dashboard`:

```nginx
server {
    listen 80;
    server_name dashboard.bastion.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dashboard.bastion.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/dashboard.bastion.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dashboard.bastion.yourdomain.com/privkey.pem;

    # Root directory
    root /var/www/bastion/dashboard;
    index index.html;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Deploy:
```bash
sudo mkdir -p /var/www/bastion
sudo cp -r dist/* /var/www/bastion/dashboard/
sudo chown -R www-data:www-data /var/www/bastion

sudo ln -s /etc/nginx/sites-available/bastion-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Security Hardening

### 1. Firewall Configuration

```bash
# UFW (Uncomplicated Firewall)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw enable
```

### 2. Rate Limiting

Nginx rate limiting:
```nginx
# Add to http block in /etc/nginx/nginx.conf
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

# In server block
location /v1 {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://bastion_backend;
}
```

### 3. API Key Security

- Store API keys hashed in database
- Rotate keys regularly
- Implement key expiration
- Monitor for leaked keys

### 4. Database Security

```bash
# Restrict PostgreSQL to localhost only
# Edit /etc/postgresql/14/main/pg_hba.conf

# Only allow local connections
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5

# No remote connections allowed
```

---

## Monitoring & Logging

### 1. Application Monitoring

Install PM2 for process monitoring (alternative to systemd):

```bash
npm install -g pm2

# Start backend with PM2
cd /opt/bastion/backend
pm2 start dist/index.js --name bastion-backend

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup

# Monitor
pm2 monit
pm2 logs bastion-backend
```

### 2. Log Aggregation

Setup log rotation:

```bash
# Create /etc/logrotate.d/bastion
/var/log/bastion/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 bastion bastion
    sharedscripts
    postrotate
        systemctl reload bastion-backend
    endscript
}
```

### 3. Performance Monitoring

Install and configure monitoring tools:

```bash
# Prometheus + Grafana
sudo apt install prometheus grafana

# Configure Prometheus to scrape /metrics endpoint
# Add to /etc/prometheus/prometheus.yml
scrape_configs:
  - job_name: 'bastion-backend'
    static_configs:
      - targets: ['localhost:3000']
```

### 4. Error Tracking

Integrate Sentry:

```typescript
// Add to backend/src/index.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

---

## Scaling Considerations

### Horizontal Scaling

1. **Load Balancer Setup:**

```nginx
# Nginx load balancing
upstream bastion_cluster {
    least_conn;
    server 10.0.1.10:3000 weight=1;
    server 10.0.1.11:3000 weight=1;
    server 10.0.1.12:3000 weight=1;
}

server {
    location / {
        proxy_pass http://bastion_cluster;
    }
}
```

2. **Database Read Replicas:**

```bash
# Setup PostgreSQL streaming replication
# On master:
wal_level = replica
max_wal_senders = 3
```

3. **Redis for Session Storage:**

```typescript
// Use Redis for rate limiting
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
```

### Performance Optimization

1. **Database Indexes:**

```sql
-- Critical indexes
CREATE INDEX idx_action_logs_user_timestamp ON action_logs(user_id, timestamp DESC);
CREATE INDEX idx_action_logs_agent_timestamp ON action_logs(agent_id, timestamp DESC);
CREATE INDEX idx_policies_user_enabled ON policies(user_id, enabled);
```

2. **Caching Strategy:**

```typescript
// Cache policy rules in memory/Redis
const policyCache = new Map();

async function getPolicies(userId: string) {
  const cacheKey = `policies:${userId}`;

  // Check cache
  let policies = policyCache.get(cacheKey);

  if (!policies) {
    policies = await db.policy.findMany({ where: { userId } });
    policyCache.set(cacheKey, policies);

    // Expire after 5 minutes
    setTimeout(() => policyCache.delete(cacheKey), 5 * 60 * 1000);
  }

  return policies;
}
```

---

## Backup & Recovery

### 1. Database Backups

```bash
# Daily full backup
pg_dump bastion_production | gzip > backup.sql.gz

# Restore
gunzip < backup.sql.gz | psql bastion_production
```

### 2. Disaster Recovery Plan

1. **Regular Testing:**
   - Test backups monthly
   - Practice restoration procedures
   - Document recovery steps

2. **Backup Strategy:**
   - Daily database backups (retained 30 days)
   - Weekly full system backups (retained 12 weeks)
   - Monthly archives (retained 1 year)

3. **Recovery Time Objectives:**
   - Database: < 1 hour
   - Full system: < 4 hours

---

## Health Checks

### 1. Automated Health Monitoring

```bash
#!/bin/bash
# /opt/bastion/scripts/health-check.sh

# Check backend
if ! curl -sf http://localhost:3000/health > /dev/null; then
    echo "Backend unhealthy" | mail -s "Bastion Alert" admin@yourdomain.com
    systemctl restart bastion-backend
fi

# Check database
if ! pg_isready -h localhost -U bastion; then
    echo "Database unhealthy" | mail -s "Bastion Alert" admin@yourdomain.com
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Disk usage at ${DISK_USAGE}%" | mail -s "Bastion Alert" admin@yourdomain.com
fi
```

Add to cron:
```bash
*/5 * * * * /opt/bastion/scripts/health-check.sh
```

---

## Production Checklist

- [ ] PostgreSQL configured and secured
- [ ] Database backups automated
- [ ] Backend deployed with systemd/PM2
- [ ] Nginx reverse proxy configured
- [ ] SSL certificates installed and auto-renewing
- [ ] Firewall rules configured
- [ ] Monitoring and alerting setup
- [ ] Log rotation configured
- [ ] CLI binaries built for all platforms
- [ ] Dashboard deployed
- [ ] Health checks running
- [ ] Documentation updated
- [ ] Security audit completed
- [ ] Load testing performed
- [ ] Disaster recovery plan documented
- [ ] Team trained on operations

---

## Support

For production support:
- Email: support@bastion.ai
- Slack: bastion-users.slack.com
- GitHub Issues: github.com/your-org/bastion/issues
