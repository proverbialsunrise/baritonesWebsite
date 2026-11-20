#!/usr/bin/env bash
# Idempotent setup script for a fresh Ubuntu LTS DigitalOcean droplet.
# Run once as root:
#   sudo bash deploy/setup-droplet.sh
#
# Optional environment overrides:
#   DEPLOY_USER=deploy      Non-root user to create (default: deploy)
#   APP_DIR=/opt/apps       Directory for containerized apps (default: /opt/apps)
#   SWAP_SIZE=1G            Swapfile size, or 0 to skip (default: 1G)
#   SSH_PUBKEY="..."        Explicit public key for DEPLOY_USER (defaults to /root/.ssh/authorized_keys)
#   HARDEN_SSH=true         Disable root login & password SSH auth when keys exist (default: true)

set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="${APP_DIR:-/opt/apps}"
SWAP_SIZE="${SWAP_SIZE:-1G}"
SSH_PUBKEY="${SSH_PUBKEY:-}"
HARDEN_SSH="${HARDEN_SSH:-true}"

log() {
  printf '\n==> %s\n' "$*"
}

warn() {
  printf '\n[WARNING] %s\n' "$*" >&2
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "Error: This script must be run as root (e.g. sudo bash $0)." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "Error: This script targets Ubuntu/Debian systems with apt-get." >&2
  exit 1
fi

if [[ ! "${DEPLOY_USER}" =~ ^[a-z_][a-z0-9_-]*$ ]]; then
  echo "Error: Invalid DEPLOY_USER '${DEPLOY_USER}'." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
APT_OPTS=(-o DPkg::Lock::Timeout=60)

log "Updating system packages and installing base dependencies"
apt-get "${APT_OPTS[@]}" update
apt-get "${APT_OPTS[@]}" upgrade -y
apt-get "${APT_OPTS[@]}" install -y \
  ca-certificates \
  curl \
  gnupg \
  git \
  ufw \
  fail2ban \
  unattended-upgrades \
  nginx \
  certbot \
  python3-certbot-nginx

dpkg-reconfigure -f noninteractive unattended-upgrades
systemctl enable --now fail2ban
systemctl enable --now nginx

if [[ "${SWAP_SIZE}" != "0" ]]; then
  if [[ ! -e /swapfile ]] && ! swapon --show | grep -q '/swapfile'; then
    log "Creating ${SWAP_SIZE} swapfile"
    if ! fallocate -l "${SWAP_SIZE}" /swapfile 2>/dev/null; then
      swap_bytes="$(numfmt --from=iec "${SWAP_SIZE}")"
      dd if=/dev/zero of=/swapfile bs=1M count="$((swap_bytes / 1048576))" status=none
    fi
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -qxF '/swapfile none swap sw 0 0' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  else
    log "Swapfile already configured, skipping"
  fi

  if [[ ! -f /etc/sysctl.d/99-swap.conf ]]; then
    echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
    sysctl --system >/dev/null
  fi
fi

log "Installing Docker Engine and Docker Compose plugin"
# shellcheck source=/dev/null
. /etc/os-release
DISTRO_ID="${ID:-ubuntu}"
CODENAME="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
if [[ -z "${CODENAME}" ]]; then
  echo "Error: Could not determine OS codename from /etc/os-release." >&2
  exit 1
fi

install -m 0755 -d /etc/apt/keyrings
curl -fsSL "https://download.docker.com/linux/${DISTRO_ID}/gpg" -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

cat > /etc/apt/sources.list.d/docker.list <<EOF
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${DISTRO_ID} ${CODENAME} stable
EOF

apt-get "${APT_OPTS[@]}" update
apt-get "${APT_OPTS[@]}" install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

docker_restart_needed=false
if [[ ! -f /etc/docker/daemon.json ]]; then
  install -m 0755 -d /etc/docker
  cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
  docker_restart_needed=true
fi

systemctl enable --now docker
if [[ "${docker_restart_needed}" == "true" ]]; then
  systemctl restart docker
fi

log "Configuring non-root user '${DEPLOY_USER}' and app directory '${APP_DIR}'"
if ! id -u "${DEPLOY_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${DEPLOY_USER}"
fi
usermod -aG sudo,docker "${DEPLOY_USER}"

SUDOERS_FILE="/etc/sudoers.d/90-${DEPLOY_USER}"
echo "${DEPLOY_USER} ALL=(ALL) NOPASSWD:ALL" > "${SUDOERS_FILE}"
chmod 440 "${SUDOERS_FILE}"
if ! visudo -cf "${SUDOERS_FILE}" >/dev/null; then
  rm -f "${SUDOERS_FILE}"
  echo "Error: Generated invalid sudoers file." >&2
  exit 1
fi

DEPLOY_HOME="$(getent passwd "${DEPLOY_USER}" | cut -d: -f6)"
SSH_DIR="${DEPLOY_HOME}/.ssh"
AUTH_KEYS="${SSH_DIR}/authorized_keys"
install -d -m 700 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${SSH_DIR}"

if [[ -n "${SSH_PUBKEY}" ]]; then
  touch "${AUTH_KEYS}"
  grep -qxF "${SSH_PUBKEY}" "${AUTH_KEYS}" || echo "${SSH_PUBKEY}" >> "${AUTH_KEYS}"
elif [[ ! -s "${AUTH_KEYS}" ]] && [[ -s /root/.ssh/authorized_keys ]]; then
  cp /root/.ssh/authorized_keys "${AUTH_KEYS}"
fi

if [[ -f "${AUTH_KEYS}" ]]; then
  chmod 600 "${AUTH_KEYS}"
fi
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${SSH_DIR}"

mkdir -p "${APP_DIR}"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"

if [[ "${HARDEN_SSH}" == "true" ]]; then
  if [[ -s "${AUTH_KEYS}" ]]; then
    log "Hardening SSH (disabling root login and password authentication)"
    install -d -m 0755 /etc/ssh/sshd_config.d
    # 00- prefix ensures directives take precedence over 50-cloud-init.conf (OpenSSH is first-match-wins).
    cat > /etc/ssh/sshd_config.d/00-hardening.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
EOF
    if sshd -t; then
      systemctl reload ssh || systemctl reload sshd
    else
      rm -f /etc/ssh/sshd_config.d/00-hardening.conf
      echo "Error: sshd configuration test failed; reverted SSH hardening." >&2
      exit 1
    fi
  else
    warn "No SSH authorized_keys found for '${DEPLOY_USER}'. Skipping SSH hardening to prevent lockout."
  fi
fi

log "Configuring UFW firewall (OpenSSH + Nginx Full)"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

cat <<EOF

====================================================================
Droplet setup complete!

IMPORTANT: Open a NEW terminal and verify SSH access before closing
this root session:
  ssh ${DEPLOY_USER}@<your-droplet-ip>

Next steps as '${DEPLOY_USER}':
  1. Clone and start the app:
     cd ${APP_DIR}
     git clone https://github.com/proverbialsunrise/baritonesWebsite.git
     cd baritonesWebsite
     docker compose up -d --build
     curl -fsS http://127.0.0.1:4952/healthz

  2. Configure Nginx and HTTPS (once DNS A/AAAA records point here):
     sudo cp deploy/nginx-beardedbaritones.conf /etc/nginx/sites-available/beardedbaritones.com
     sudo ln -sf /etc/nginx/sites-available/beardedbaritones.com /etc/nginx/sites-enabled/beardedbaritones.com
     sudo nginx -t && sudo systemctl reload nginx
     sudo certbot --nginx -d beardedbaritones.com -d www.beardedbaritones.com
====================================================================
EOF
