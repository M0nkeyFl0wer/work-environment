#!/bin/bash

# Tailscale Setup Script
# Run this script with sudo access to install and configure Tailscale

set -e

echo "🔗 Installing Tailscale..."

# Add Tailscale repository
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/jammy.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/jammy.sources | sudo tee /etc/apt/sources.list.d/tailscale.list

# Update package list and install Tailscale
sudo apt-get update
sudo apt-get install -y tailscale

# Start Tailscale service
sudo systemctl enable tailscale
sudo systemctl start tailscale

echo "✅ Tailscale installed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Authenticate with Tailscale:"
echo "      sudo tailscale up"
echo ""
echo "   2. Follow the URL provided to authenticate in your browser"
echo ""
echo "   3. Check your Tailscale IP:"
echo "      tailscale ip -4"
echo ""
echo "   4. SSH from anywhere using your Tailscale IP:"
echo "      ssh $(whoami)@[tailscale-ip]"
echo ""
echo "🎉 Tailscale setup complete!"