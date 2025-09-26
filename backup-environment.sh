#!/bin/bash

# Environment Backup Script
# Safely backs up development environment excluding private data

set -e

BACKUP_NAME="work-environment-$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/tmp/claude/$BACKUP_NAME"

echo "Creating environment backup: $BACKUP_NAME"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Copy safe files and directories
echo "Copying environment files..."
cp -r . "$BACKUP_DIR/" 2>/dev/null || true

# Remove any private data that might have been copied
echo "Cleaning private data..."
find "$BACKUP_DIR" -name ".ssh" -type d -exec rm -rf {} + 2>/dev/null || true
find "$BACKUP_DIR" -name ".gnupg" -type d -exec rm -rf {} + 2>/dev/null || true
find "$BACKUP_DIR" -name ".aws" -type d -exec rm -rf {} + 2>/dev/null || true
find "$BACKUP_DIR" -name ".claude" -type d -exec rm -rf {} + 2>/dev/null || true
find "$BACKUP_DIR" -name "*.key" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*.pem" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name ".env*" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*.log" -delete 2>/dev/null || true

# Create archive
echo "Creating archive..."
cd /tmp/claude
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"

echo "Backup created: /tmp/claude/${BACKUP_NAME}.tar.gz"
echo "Backup directory: $BACKUP_DIR"

# Clean up temporary directory
rm -rf "$BACKUP_DIR"

echo "Environment backup complete!"