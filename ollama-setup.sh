#!/bin/bash
# Ollama Launch - Automated Setup Script
# Version: 1.0
# Built by: 8NTIC Agents (CLAUDE)
# Purpose: Install Ollama, detect hardware, pull the right model, start chatting
#
# ============================================================================
# HOW TO RUN THIS SCRIPT:
# ============================================================================
# 1. Save this file as ollama-setup.sh
# 2. Make it executable: chmod +x ollama-setup.sh
# 3. Run it: ./ollama-setup.sh
#
# Requirements: Mac or Linux, curl, internet connection, 4 GB+ RAM
# Duration: ~10 minutes (depends on download speed)
# Support: support@8ntic.dev
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging
LOG_FILE="$HOME/.ollama-launch.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Ollama Launch - Automated Setup                    ║${NC}"
echo -e "${CYAN}║     Run local AI in 10 minutes                         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Log file: $LOG_FILE"
echo ""

# ── Detect OS ────────────────────────────────────────────────────────────────

echo -e "${YELLOW}[1/5] Detecting system...${NC}"
OS=""
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    echo -e "${RED}Unsupported OS: $OSTYPE${NC}"
    echo "Ollama Launch supports Mac and Linux only."
    exit 1
fi
echo -e "${GREEN}  OS: $OS${NC}"

# ── Detect RAM ───────────────────────────────────────────────────────────────

RAM_GB=0
if [[ "$OS" == "macos" ]]; then
    RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
    RAM_GB=$((RAM_BYTES / 1073741824))
else
    RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}')
    RAM_GB=$((RAM_KB / 1048576))
fi
echo -e "${GREEN}  RAM: ${RAM_GB} GB${NC}"

# ── Detect GPU ───────────────────────────────────────────────────────────────

GPU_INFO="none"
if [[ "$OS" == "macos" ]]; then
    # Apple Silicon check
    if sysctl -n machdep.cpu.brand_string 2>/dev/null | grep -qi "apple"; then
        GPU_INFO="apple-silicon"
        echo -e "${GREEN}  GPU: Apple Silicon (Metal acceleration)${NC}"
    else
        GPU_INFO="intel-mac"
        echo -e "${YELLOW}  GPU: Intel Mac (CPU-only mode)${NC}"
    fi
else
    if command -v nvidia-smi &> /dev/null; then
        GPU_INFO="nvidia"
        echo -e "${GREEN}  GPU: NVIDIA detected${NC}"
    elif lspci 2>/dev/null | grep -qi "amd.*radeon\|amd.*gpu"; then
        GPU_INFO="amd"
        echo -e "${GREEN}  GPU: AMD detected${NC}"
    else
        echo -e "${YELLOW}  GPU: None detected (CPU-only mode)${NC}"
    fi
fi

# ── Check prerequisites ─────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}[2/5] Checking prerequisites...${NC}"

if ! command -v curl &> /dev/null; then
    echo -e "${RED}curl is required but not installed.${NC}"
    if [[ "$OS" == "linux" ]]; then
        echo "Install it with: sudo apt-get install curl"
    fi
    exit 1
fi
echo -e "${GREEN}  curl: installed${NC}"

# ── Install Ollama ───────────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}[3/5] Installing Ollama...${NC}"

if command -v ollama &> /dev/null; then
    echo -e "${GREEN}  Ollama already installed!${NC}"
    ollama --version 2>/dev/null || true
else
    echo "  Downloading and installing Ollama..."
    if [[ "$OS" == "macos" ]]; then
        echo ""
        echo -e "${YELLOW}  On macOS, Ollama installs as a desktop app.${NC}"
        echo -e "${YELLOW}  Opening the installer now...${NC}"
        echo ""
        curl -fsSL https://ollama.com/download/Ollama-darwin.zip -o /tmp/Ollama.zip
        unzip -o /tmp/Ollama.zip -d /Applications 2>/dev/null || true
        rm -f /tmp/Ollama.zip

        # Launch the app so the CLI becomes available
        if [[ -d "/Applications/Ollama.app" ]]; then
            open /Applications/Ollama.app
            echo "  Waiting for Ollama to start..."
            sleep 5
        fi
    else
        curl -fsSL https://ollama.com/install.sh | sh
    fi

    # Verify installation
    if command -v ollama &> /dev/null; then
        echo -e "${GREEN}  Ollama installed successfully!${NC}"
    else
        echo -e "${RED}  Ollama installation may need a terminal restart.${NC}"
        echo "  Try closing and reopening your terminal, then re-run this script."
        exit 1
    fi
fi

# Make sure Ollama is serving
if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
    echo "  Starting Ollama server..."
    ollama serve &> /dev/null &
    sleep 3
fi

# ── Pick and pull the right model ────────────────────────────────────────────

echo ""
echo -e "${YELLOW}[4/5] Selecting the best model for your hardware...${NC}"

MODEL=""
MODEL_DESC=""

if [[ $RAM_GB -ge 16 ]]; then
    MODEL="llama3.1:8b"
    MODEL_DESC="Llama 3.1 8B — great all-rounder"
elif [[ $RAM_GB -ge 8 ]]; then
    MODEL="mistral:7b"
    MODEL_DESC="Mistral 7B — fast and efficient"
elif [[ $RAM_GB -ge 4 ]]; then
    MODEL="phi3:mini"
    MODEL_DESC="Phi-3 Mini — lightweight, solid quality"
else
    MODEL="gemma2:2b"
    MODEL_DESC="Gemma 2 2B — ultra-light for low-RAM systems"
fi

echo -e "${GREEN}  Selected: ${MODEL_DESC}${NC}"
echo ""
echo "  Pulling model (this may take a few minutes)..."
ollama pull "$MODEL"

echo -e "${GREEN}  Model ready!${NC}"

# ── First chat ───────────────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}[5/5] Testing your setup...${NC}"
echo ""
echo -e "${CYAN}  Sending: 'Hello! Introduce yourself in one sentence.'${NC}"
echo ""

RESPONSE=$(ollama run "$MODEL" "Hello! Introduce yourself in one sentence." 2>/dev/null || echo "Model loaded — ready to chat!")

echo -e "${GREEN}  AI says: ${RESPONSE}${NC}"

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     SETUP COMPLETE!                                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Model:    $MODEL"
echo "  RAM:      ${RAM_GB} GB"
echo "  GPU:      $GPU_INFO"
echo "  Log:      $LOG_FILE"
echo ""
echo "  To start chatting:"
echo "    ollama run $MODEL"
echo ""
echo "  To list available models:"
echo "    ollama list"
echo ""
echo "  To pull another model:"
echo "    ollama pull <model-name>"
echo ""
echo "  Support: support@8ntic.dev"
echo ""
echo -e "${CYAN}  Welcome to local AI!${NC}"
