#!/bin/bash
# OpenClaw QuickStart - Setup Script
# Version: 1.0 MVP
# Built by: 8NTIC Agents
# Purpose: Automated OpenClaw installation
#
# ============================================================================
# HOW TO RUN THIS SCRIPT:
# ============================================================================
# Option 1 - Run directly from URL (recommended):
#   curl -fsSL https://raw.githubusercontent.com/REMgm/8NTICLAB/main/quickstart-setup.sh | bash
#
# Option 2 - Download and run locally:
#   1. Save this file as quickstart-setup.sh
#   2. chmod +x quickstart-setup.sh
#   3. ./quickstart-setup.sh
#
# Requirements: Mac or Linux, curl, internet connection
# Duration: ~15 minutes
# Support: support@8ntic.dev
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
LOG_FILE="$HOME/.openclaw-quickstart.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🦞 OpenClaw QuickStart - Automated Setup          ║${NC}"
echo -e "${BLUE}║     Get running in 15 minutes                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Log file: $LOG_FILE"
echo ""

# Detect OS
echo -e "${YELLOW}▶ Detecting system...${NC}"
OS=""
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    echo -e "${RED}✗ Unsupported OS: $OSTYPE${NC}"
    echo "QuickStart supports Mac and Linux only."
    exit 1
fi

echo -e "${GREEN}✓ Detected: $OS${NC}"

# Check prerequisites
echo -e "${YELLOW}▶ Checking prerequisites...${NC}"

# Check for curl
if ! command -v curl &> /dev/null; then
    echo -e "${RED}✗ curl is required but not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ curl installed${NC}"

# Check for git
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}! git not found, will install...${NC}"
fi

# Check Docker
echo -e "${YELLOW}▶ Checking Docker...${NC}"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker already installed${NC}"
    docker --version
else
    echo -e "${YELLOW}! Docker not found, installing...${NC}"
    
    if [[ "$OS" == "macos" ]]; then
        echo -e "${YELLOW}Please install Docker Desktop from: https://docs.docker.com/desktop/install/mac-install/${NC}"
        echo -e "${YELLOW}After installation, re-run this script.${NC}"
        exit 1
    else
        # Linux Docker install
        echo "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
        
        # Add user to docker group
        sudo usermod -aG docker $USER
        echo -e "${YELLOW}! You may need to log out and back in for Docker to work${NC}"
    fi
fi

# Create workspace
echo -e "${YELLOW}▶ Setting up workspace...${NC}"
WORKSPACE_DIR="$HOME/.openclaw"
mkdir -p "$WORKSPACE_DIR"
echo -e "${GREEN}✓ Workspace: $WORKSPACE_DIR${NC}"

# Check for GitHub setup
echo ""
echo -e "${YELLOW}▶ GitHub Configuration${NC}"
echo "To use OpenClaw, you need:"
echo "  1. GitHub account"
echo "  2. Personal Access Token (classic) with 'repo' scope"
echo ""

read -p "Do you have a GitHub Personal Access Token? (y/n): " has_token

if [[ "$has_token" == "y" || "$has_token" == "Y" ]]; then
    read -p "Enter your GitHub token (input hidden): " -s GITHUB_TOKEN
    echo ""
    
    # Test token
    echo "Testing GitHub token..."
    if curl -s -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user | grep -q "login"; then
        echo -e "${GREEN}✓ GitHub token valid${NC}"
        
        # Save to config
        CONFIG_FILE="$WORKSPACE_DIR/config.json"
        cat > "$CONFIG_FILE" << EOF
{
  "githubToken": "$GITHUB_TOKEN",
  "workspace": "$WORKSPACE_DIR/workspace",
  "model": "kimi-coding/k2p5",
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
        chmod 600 "$CONFIG_FILE"
        echo -e "${GREEN}✓ Config saved to $CONFIG_FILE${NC}"
    else
        echo -e "${RED}✗ Invalid GitHub token${NC}"
        exit 1
    fi
else
    echo ""
    echo -e "${YELLOW}To create a GitHub token:${NC}"
    echo "1. Go to: https://github.com/settings/tokens/new"
    echo "2. Name: 'OpenClaw Access'"
    echo "3. Select 'repo' scope"
    echo "4. Click 'Generate token'"
    echo "5. Copy the token (you won't see it again)"
    echo ""
    echo "Then re-run this script."
    exit 1
fi

# Install OpenClaw via npm (if Node.js available) or direct download
echo ""
echo -e "${YELLOW}▶ Installing OpenClaw...${NC}"

if command -v npm &> /dev/null; then
    echo "Installing via npm..."
    npm install -g openclaw
    echo -e "${GREEN}✓ OpenClaw installed${NC}"
else
    echo -e "${YELLOW}! npm not found, installing Node.js...${NC}"
    
    if [[ "$OS" == "macos" ]]; then
        if command -v brew &> /dev/null; then
            brew install node
        else
            echo "Please install Homebrew first: https://brew.sh"
            exit 1
        fi
    else
        # Linux Node.js install
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    npm install -g openclaw
    echo -e "${GREEN}✓ OpenClaw installed${NC}"
fi

# Create first mission
echo ""
echo -e "${YELLOW}▶ Creating your first agent...${NC}"

mkdir -p "$WORKSPACE_DIR/workspace"
cd "$WORKSPACE_DIR/workspace"

# Create identity file
cat > "IDENTITY.md" << 'EOF'
# IDENTITY.md - Who Am I?

- **Name:** OpenClaw Agent
- **Creature:** AI Assistant
- **Vibe:** Helpful, direct, proactive
- **Emoji:** 🤖

This is your agent identity. Customize as you wish!
EOF

# Create user file
cat > "USER.md" << EOF
# User Profile

- **Name:** You
- **What to call them:** You
- **Timezone:** $(date +%Z)
- **Location:** Earth
- **Preferences:** Direct communication, proactive behavior
EOF

# Create hello world skill
cat > "hello-world.sh" << 'EOF'
#!/bin/bash
echo "🎉 Hello from OpenClaw!"
echo "Your agent is ready to help."
echo ""
echo "Next steps:"
echo "1. Customize IDENTITY.md and USER.md"
echo "2. Start OpenClaw: openclaw"
echo "3. Ask your agent anything!"
EOF
chmod +x hello-world.sh

echo -e "${GREEN}✓ First mission created${NC}"

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✅ SETUP COMPLETE!                                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "📁 Your workspace: $WORKSPACE_DIR/workspace"
echo "📋 Log file: $LOG_FILE"
echo "⚙️  Config: $WORKSPACE_DIR/config.json"
echo ""
echo "🚀 Next steps:"
echo "   1. cd $WORKSPACE_DIR/workspace"
echo "   2. ./hello-world.sh"
echo "   3. Run: openclaw"
echo ""
echo "💬 Support: support@8ntic.dev"
echo "📚 Docs: https://docs.openclaw.ai"
echo ""
echo -e "${BLUE}Welcome to OpenClaw! 🦞${NC}"
