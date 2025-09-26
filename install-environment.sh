#!/bin/bash

# Environment Installation Script
# Sets up the work environment on a new system

set -e

echo "🚀 Installing Work Environment..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root"
   exit 1
fi

# Update system packages
echo "📦 Updating system packages..."
if command -v apt-get &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y curl wget git build-essential
elif command -v yum &> /dev/null; then
    sudo yum update -y
    sudo yum install -y curl wget git gcc gcc-c++ make
elif command -v brew &> /dev/null; then
    brew update
    brew install curl wget git
else
    echo "⚠️  Package manager not detected. Please install: curl, wget, git, build-essential"
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install Python if not present
if ! command -v python3 &> /dev/null; then
    echo "🐍 Installing Python..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get install -y python3 python3-pip
    fi
fi

# Setup SSH if not configured
if [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "🔑 Setting up SSH..."
    ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" -C "work-environment"
    chmod 600 ~/.ssh/id_ed25519
    chmod 644 ~/.ssh/id_ed25519.pub

    # Add to authorized_keys for local access
    cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
fi

# Install universal environment optimization system
if [ -d "universal-environment-optimization-system" ]; then
    echo "⚙️  Setting up UEOS..."
    cd universal-environment-optimization-system

    if [ -f "package.json" ]; then
        npm install
    fi

    if [ -f "requirements.txt" ]; then
        pip3 install -r requirements.txt
    fi

    cd ..
fi

# Set up git configuration (using safe defaults)
echo "🔧 Configuring Git..."
git config --global init.defaultBranch main
git config --global pull.rebase false

echo "✅ Environment installation complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Configure your git identity: git config --global user.name 'Your Name'"
echo "   2. Configure your git email: git config --global user.email 'your@email.com'"
echo "   3. Add your SSH public key to remote services:"
echo "      cat ~/.ssh/id_ed25519.pub"
echo ""
echo "🎉 Happy coding!"