# baritonesWebsite

Website for the Bearded Baritones ([beardedbaritones.com](https://beardedbaritones.com)).

## Requirements

- Node.js `>= 24` (or Docker / Docker Compose)

## Local Development

```bash
npm install
npm run dev
```

Visit `http://127.0.0.1:4952`.

Run the test suite:

```bash
npm test
```

### Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` (or `BariPORT`) | `4952` | Listening port |
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` in Docker) |
| `CALENDAR_ID` | `bearded.baritones@gmail.com` | Public Google Calendar ID for `/appearances` |
| `TIMEZONE` | `America/Toronto` | Display timezone for `/appearances` |
| `NODE_ENV` | — | Set to `production` in production |

## Production Deployment (Docker + Nginx + HTTPS on DigitalOcean)

The container binds only to `127.0.0.1:4952` so it is never exposed directly to the internet; host Nginx terminates TLS with Let's Encrypt and proxies traffic to it.

### 0. Provision a new Ubuntu Droplet

From your local machine, copy [deploy/setup-droplet.sh](deploy/setup-droplet.sh) to the fresh Ubuntu LTS droplet and run it once as `root`:

```bash
scp deploy/setup-droplet.sh root@<droplet-ip>:/root/
ssh root@<droplet-ip> "bash /root/setup-droplet.sh && rm -f /root/setup-droplet.sh"
```

This updates the OS, enables unattended security upgrades and `fail2ban`, adds a `1G` swapfile, installs Docker + Compose, installs Nginx + Certbot, creates a non-root `deploy` user (with `sudo` and `docker` group access and your SSH key) owning `/opt/apps`, disables root/password SSH login, and enables the `ufw` firewall (`OpenSSH` + `Nginx Full`).

**Test `ssh deploy@<droplet-ip>` in a second terminal before closing your root session**, then continue the steps below as `deploy`.

### 1. Start the container on the droplet

```bash
cd /opt/apps
git clone https://github.com/proverbialsunrise/baritonesWebsite.git
cd baritonesWebsite
docker compose up -d --build
```

Verify the container is healthy:

```bash
curl -fsS http://127.0.0.1:4952/healthz
```

### 2. Configure Nginx and HTTPS (Let's Encrypt / Certbot)

Copy the provided site configuration:

```bash
sudo cp deploy/nginx-beardedbaritones.conf /etc/nginx/sites-available/beardedbaritones.com
sudo ln -sf /etc/nginx/sites-available/beardedbaritones.com /etc/nginx/sites-enabled/beardedbaritones.com
sudo nginx -t && sudo systemctl reload nginx
```

Issue and auto-configure the TLS certificate + HTTP-to-HTTPS redirect:

```bash
sudo certbot --nginx -d beardedbaritones.com -d www.beardedbaritones.com
```

Verify renewal works cleanly:

```bash
sudo certbot renew --dry-run
```

### 3. Firewall

Ensure `ufw` (and the DigitalOcean Cloud Firewall) only allow SSH (`22/tcp`), HTTP (`80/tcp`), and HTTPS (`443/tcp`). Do not expose port `4952` publicly.

### 4. Updating the live site

```bash
git pull
docker compose up -d --build
```

*(Note: If you later replace host Nginx with a Caddy container to manage multiple containerized sites together, see `deploy/Caddyfile.example`.)*
