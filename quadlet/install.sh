#!/bin/bash
# Installs Quadlet units for rootless Podman deployment
set -e

QUADLET_DIR="$HOME/.config/containers/systemd"
ENV_DIR="$HOME/.config/issue-tracker"

echo "Installing Quadlet units to $QUADLET_DIR ..."
mkdir -p "$QUADLET_DIR" "$ENV_DIR"

cp issue-tracker.network "$QUADLET_DIR/"
cp issue-tracker-backend.container "$QUADLET_DIR/"
cp issue-tracker-frontend.container "$QUADLET_DIR/"
cp issue-tracker-mcp.container "$QUADLET_DIR/"
cp issue-tracker-db.volume "$QUADLET_DIR/"
cp issue-tracker.pod "$QUADLET_DIR/"

if [ ! -f "$ENV_DIR/prod.env" ]; then
    cp ../.env.prod.template "$ENV_DIR/prod.env"
    echo ""
    echo "WARNING: Edit $ENV_DIR/prod.env before starting services!"
    echo "  - Set BETTER_AUTH_SECRET to a strong random value"
    echo "  - Set BETTER_AUTH_BASE_URL to your server URL"
    echo "  - Set FRONTEND_URL to your server URL"
    echo ""
fi

systemctl --user daemon-reload

echo "Done! Units installed."
echo ""
echo "Build images first:"
echo "  podman build -t issue-tracker-backend ./backend"
echo "  podman build -t issue-tracker-frontend --target prod ./frontend"
echo "  podman build -t issue-tracker-mcp ./mcp"
echo ""
echo "Then start services:"
echo "  systemctl --user start issue-tracker-pod issue-tracker-backend issue-tracker-frontend issue-tracker-mcp"
echo ""
echo "Check status:"
echo "  systemctl --user status issue-tracker-pod issue-tracker-backend issue-tracker-frontend issue-tracker-mcp"
