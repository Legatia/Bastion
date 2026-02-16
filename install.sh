#!/bin/bash
# Bastion CLI Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/Legatia/Bastion/main/install.sh | bash

set -euo pipefail

# Clean up temp files on failure
cleanup() {
    rm -f /tmp/bastion_install.tar.gz
}
trap cleanup EXIT

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ASCII Logo
echo -e "${BLUE}"
cat << "EOF"
╔══════════════════════════════════════════════╗
║                                              ║
║   ██████╗  █████╗ ███████╗████████╗██╗ ██████╗ ███╗   ██╗
║   ██╔══██╗██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
║   ██████╔╝███████║███████╗   ██║   ██║██║   ██║██╔██╗ ██║
║   ██╔══██╗██╔══██║╚════██║   ██║   ██║██║   ██║██║╚██╗██║
║   ██████╔╝██║  ██║███████║   ██║   ██║╚██████╔╝██║ ╚████║
║   ╚═════╝ ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
║                                              ║
║        Secure your AI agents in 60 seconds   ║
╚══════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${GREEN}Starting Bastion installation...${NC}\n"

# Check if running on macOS or Linux
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
    Darwin)
        PLATFORM="darwin"
        ;;
    Linux)
        PLATFORM="linux"
        ;;
    *)
        echo -e "${RED}Error: Unsupported operating system: $OS${NC}"
        echo "Bastion supports macOS and Linux (x86_64, ARM64, ARMv7)."
        exit 1
        ;;
esac

# Architecture mapping
case "$ARCH" in
    x86_64)
        ARCH_NAME="amd64"
        ;;
    arm64|aarch64)
        ARCH_NAME="arm64"
        ;;
    armv7l|armhf)
        ARCH_NAME="armv7"
        ;;
    *)
        echo -e "${RED}Error: Unsupported architecture: $ARCH${NC}"
        echo "Bastion supports: x86_64, arm64/aarch64, armv7l (Raspberry Pi, Jetson, etc.)"
        exit 1
        ;;
esac

echo -e "${BLUE}Detected platform: $PLATFORM ($ARCH_NAME)${NC}"

# Install directory
INSTALL_DIR="$HOME/.bastion"
BIN_DIR="$HOME/.bastion/bin"
BINARY_NAME="bastion"

echo -e "\n${GREEN}Installing Bastion to: $INSTALL_DIR${NC}"

# Create installation directory
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

# Check for existing installation
if [ -f "$BIN_DIR/bastion" ]; then
    EXISTING_VERSION=$("$BIN_DIR/bastion" --version 2>/dev/null || echo "unknown")
    echo -e "${YELLOW}Existing installation detected: $EXISTING_VERSION${NC}"
    echo -e "${YELLOW}Upgrading...${NC}"
fi

# Download Release
REPO="Legatia/Bastion"
LATEST_RELEASE_URL="https://api.github.com/repos/$REPO/releases/latest"
echo -e "\n${BLUE}Fetching latest version...${NC}"

# Use curl to get the latest release tag name, fallback to a hardcoded version if API fails
if command -v curl &> /dev/null; then
    RELEASE_TAG=$(curl -s $LATEST_RELEASE_URL | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
else
    echo -e "${YELLOW}curl not found, skipping version check.${NC}"
fi

if [ -z "$RELEASE_TAG" ]; then
    echo -e "${YELLOW}Could not fetch latest release info. Please check your internet connection.${NC}"
    echo -e "${YELLOW}Using 'latest' as a fallback.${NC}"
    RELEASE_TAG="latest"
else
     echo -e "${GREEN}Found version: $RELEASE_TAG${NC}"
fi

# Construct download URL
# If tag is "latest", we use /releases/latest/download, otherwise /releases/download/TAG
if [ "$RELEASE_TAG" == "latest" ]; then
    DOWNLOAD_BASE="https://github.com/$REPO/releases/latest/download"
else
    DOWNLOAD_BASE="https://github.com/$REPO/releases/download/$RELEASE_TAG"
fi

# Asset name format: bastion-PLATFORM-ARCH.tar.gz
# e.g. bastion-darwin-arm64.tar.gz
ASSET_NAME="bastion-$PLATFORM-$ARCH_NAME.tar.gz"
DOWNLOAD_URL="$DOWNLOAD_BASE/$ASSET_NAME"

echo -e "${BLUE}Downloading from: $DOWNLOAD_URL${NC}"

# Download to temp file
TMP_FILE="/tmp/bastion_install.tar.gz"
if curl -L -o "$TMP_FILE" "$DOWNLOAD_URL"; then
    echo -e "${GREEN}✓ Download complete${NC}"
else
    echo -e "${RED}Error: Failed to download binary.${NC}"
    echo "Double check that a release exists for your platform ($PLATFORM-$ARCH_NAME)."
    exit 1
fi

# Extract
echo -e "${BLUE}Extracting...${NC}"
if ! tar -xzf "$TMP_FILE" -C "$BIN_DIR"; then
    echo -e "${RED}Error: Failed to extract archive. The download may be corrupt.${NC}"
    rm -f "$TMP_FILE"
    exit 1
fi
rm -f "$TMP_FILE"

# Handle legacy binary name if necessary
if [ -f "$BIN_DIR/bastion-cli" ] && [ ! -f "$BIN_DIR/bastion" ]; then
    mv "$BIN_DIR/bastion-cli" "$BIN_DIR/bastion"
fi

chmod +x "$BIN_DIR/bastion"

# Verify binary works
if ! "$BIN_DIR/bastion" --version &>/dev/null; then
    echo -e "${RED}Error: Installed binary failed verification. It may be incompatible with your system.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Binary verified${NC}"

# Add to PATH
SHELL_RC=""
if [ -f "$HOME/.bashrc" ]; then
    SHELL_RC="$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_RC="$HOME/.bash_profile"
elif [ -f "$HOME/.zshrc" ]; then
    SHELL_RC="$HOME/.zshrc"
fi

if [ -n "$SHELL_RC" ]; then
    if ! grep -q "/.bastion/bin" "$SHELL_RC"; then
        echo "" >> "$SHELL_RC"
        echo "# Bastion CLI" >> "$SHELL_RC"
        echo 'export PATH="$HOME/.bastion/bin:$PATH"' >> "$SHELL_RC"
        echo -e "\n${GREEN}✓ Added Bastion to PATH in $SHELL_RC${NC}"
    fi
fi

echo -e "\n${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✓ Bastion installed successfully!      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"

echo -e "\n${BLUE}Next steps:${NC}"
echo -e "  1. Reload your shell: ${YELLOW}source $SHELL_RC${NC}"
echo -e "  2. Run:               ${YELLOW}bastion login${NC}"
echo -e ""
echo -e "${BLUE}That's it. Login will walk you through agent setup and start the proxy.${NC}"
echo -e ""
echo -e "${BLUE}Get your API key at: ${YELLOW}https://bastion.legatia.solutions/profile${NC}"
echo ""
