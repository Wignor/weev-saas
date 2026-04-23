#!/bin/bash
# WeevTrack Frontend — Script de Deploy na VPS
# Rodar na VPS como root após clonar o repositório

set -e

APP_DIR="/opt/weevtrack-frontend"
REPO_URL="https://github.com/SEU_USUARIO/weev-saas.git"  # substituir

echo "[1/6] Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "[2/6] Instalando PM2..."
npm install -g pm2

echo "[3/6] Clonando repositório..."
mkdir -p $APP_DIR
cd $APP_DIR
git clone $REPO_URL . 2>/dev/null || git pull

echo "[4/6] Instalando dependências e buildando..."
cd apps/weevtrack-frontend
npm install
cat > .env.local << 'EOF'
TRACCAR_URL=http://localhost:8082
SESSION_SECRET=weevtrack_prod_secret_mude_isso!
EOF
npm run build

echo "[5/6] Iniciando com PM2..."
pm2 delete weevtrack-frontend 2>/dev/null || true
pm2 start npm --name "weevtrack-frontend" -- start
pm2 save
pm2 startup | tail -1 | bash

echo "[6/6] Atualizando Nginx..."
cat > /etc/nginx/sites-available/weevtrack << 'NGINX'
server {
    listen 80;
    listen 443 ssl;
    server_name app.weevtrack.com;

    ssl_certificate /etc/letsencrypt/live/app.weevtrack.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.weevtrack.com/privkey.pem;

    if ($scheme = http) {
        return 301 https://$host$request_uri;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

nginx -t && systemctl reload nginx

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   WeevTrack Frontend deployado!          ║"
echo "║   Acesse: https://app.weevtrack.com      ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Comandos úteis:"
echo "  pm2 logs weevtrack-frontend   ← ver logs"
echo "  pm2 restart weevtrack-frontend ← reiniciar"
