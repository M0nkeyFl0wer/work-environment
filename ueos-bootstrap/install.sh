#!/bin/bash

# Universal Environment Optimization System (UEOS) Installer
# Version: 1.0.0
# Description: One-command setup for universal development environment

set -e

# Configuration
UEOS_VERSION="1.0.0"
UEOS_HOME="${UEOS_HOME:-$HOME/.ueos}"
UEOS_REPO="https://github.com/m0nkey-fl0wer/ueos"
NODE_MIN_VERSION="18.0.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check system requirements
check_requirements() {
    log_info "Checking system requirements..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js ${NODE_MIN_VERSION} or higher."
    fi

    local node_version=$(node -v | cut -d 'v' -f 2)
    if [ "$(printf '%s\n' "${NODE_MIN_VERSION}" "${node_version}" | sort -V | head -n1)" != "${NODE_MIN_VERSION}" ]; then
        log_error "Node.js version ${node_version} is too old. Please upgrade to ${NODE_MIN_VERSION} or higher."
    fi

    # Check Git
    if ! command -v git &> /dev/null; then
        log_error "Git is not installed. Please install Git."
    fi

    # Check SSH
    if ! command -v ssh &> /dev/null; then
        log_warning "SSH is not installed. Remote execution features will be disabled."
    fi

    log_success "System requirements satisfied"
}

# Create directory structure
create_structure() {
    log_info "Creating UEOS directory structure..."

    mkdir -p "$UEOS_HOME"/{bin,lib,config,secrets,cache,templates,runtime}
    mkdir -p "$UEOS_HOME"/templates/{swarm-configs,agent-flows,spec-kits,mcp-integrations}
    mkdir -p "$UEOS_HOME"/secrets/{ssh-keys,api-tokens}
    mkdir -p "$UEOS_HOME"/cache/{project-contexts,agent-memories}
    mkdir -p "$UEOS_HOME"/runtime/{logs,metrics,state}

    # Set secure permissions for secrets
    chmod 700 "$UEOS_HOME"/secrets
    chmod 700 "$UEOS_HOME"/secrets/ssh-keys
    chmod 700 "$UEOS_HOME"/secrets/api-tokens

    log_success "Directory structure created"
}

# Install core files
install_core() {
    log_info "Installing UEOS core files..."

    # Create main CLI executable
    cat > "$UEOS_HOME/bin/ueos" << 'EOF'
#!/usr/bin/env node

/**
 * UEOS - Universal Environment Optimization System
 * Main CLI Entry Point
 */

const path = require('path');
const { CLI } = require('../lib/cli');

// Initialize CLI
const cli = new CLI();

// Parse and execute commands
cli.execute(process.argv.slice(2)).catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
});
EOF

    chmod +x "$UEOS_HOME/bin/ueos"

    # Create package.json
    cat > "$UEOS_HOME/package.json" << EOF
{
  "name": "ueos",
  "version": "${UEOS_VERSION}",
  "description": "Universal Environment Optimization System",
  "main": "lib/index.js",
  "bin": {
    "ueos": "bin/ueos"
  },
  "scripts": {
    "test": "jest",
    "lint": "eslint .",
    "update": "npm update && npm audit fix"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "inquirer": "^9.2.0",
    "chalk": "^5.3.0",
    "ora": "^7.0.0",
    "glob": "^10.3.0",
    "js-yaml": "^4.1.0",
    "dotenv": "^16.3.0",
    "axios": "^1.5.0",
    "playwright": "^1.40.0",
    "@octokit/rest": "^20.0.0",
    "googleapis": "^126.0.0",
    "redis": "^4.6.0",
    "sqlite3": "^5.1.0",
    "node-forge": "^1.3.0",
    "pm2": "^5.3.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "eslint": "^8.50.0"
  },
  "engines": {
    "node": ">=${NODE_MIN_VERSION}"
  }
}
EOF

    log_success "Core files installed"
}

# Install Node.js dependencies
install_dependencies() {
    log_info "Installing Node.js dependencies..."

    cd "$UEOS_HOME"
    npm install --silent --no-fund --no-audit

    log_success "Dependencies installed"
}

# Copy existing Swarm Stack integration
integrate_swarm_stack() {
    log_info "Integrating with existing Swarm Stack..."

    local swarm_stack_path="$HOME/Swarm Stack"

    if [ -d "$swarm_stack_path" ]; then
        # Copy relevant configurations
        if [ -d "$swarm_stack_path/.claude" ]; then
            cp -r "$swarm_stack_path/.claude/slash_commands" "$UEOS_HOME/templates/swarm-configs/" 2>/dev/null || true
        fi

        # Extract SSH configuration
        if [ -f "$swarm_stack_path/setup-swarm-workflow.sh" ]; then
            grep -E "remote-user|remote-port|remote-path" "$swarm_stack_path/setup-swarm-workflow.sh" > "$UEOS_HOME/config/ssh-defaults.conf" 2>/dev/null || true
        fi

        log_success "Swarm Stack integration complete"
    else
        log_warning "Swarm Stack not found at $swarm_stack_path - skipping integration"
    fi
}

# Setup shell integration
setup_shell_integration() {
    log_info "Setting up shell integration..."

    local shell_config_files=()

    # Detect shell configuration files
    [ -f "$HOME/.bashrc" ] && shell_config_files+=("$HOME/.bashrc")
    [ -f "$HOME/.zshrc" ] && shell_config_files+=("$HOME/.zshrc")
    [ -f "$HOME/.bash_profile" ] && shell_config_files+=("$HOME/.bash_profile")

    local shell_integration="
# UEOS - Universal Environment Optimization System
export UEOS_HOME=\"$UEOS_HOME\"
export PATH=\"\$UEOS_HOME/bin:\$PATH\"

# UEOS auto-completion
if [ -f \"\$UEOS_HOME/lib/completion.sh\" ]; then
    source \"\$UEOS_HOME/lib/completion.sh\"
fi

# UEOS aliases
alias ueos-status='ueos status'
alias ueos-dev='ueos develop'
alias ueos-spec='ueos spec'
"

    for config_file in "${shell_config_files[@]}"; do
        if ! grep -q "UEOS_HOME" "$config_file" 2>/dev/null; then
            echo "$shell_integration" >> "$config_file"
            log_success "Added UEOS to $config_file"
        else
            log_info "UEOS already configured in $config_file"
        fi
    done
}

# Initialize configuration
initialize_config() {
    log_info "Initializing configuration..."

    # Global configuration
    cat > "$UEOS_HOME/config/global.json" << EOF
{
  "version": "${UEOS_VERSION}",
  "ssh": {
    "host": "seshat.noosworx.com",
    "port": 8888,
    "user": "m0nkey-fl0wer",
    "remotePath": "/home/m0nkey-fl0wer/claude-flow"
  },
  "github": {
    "owner": "m0nkey-fl0wer",
    "autoCreateIssues": true,
    "assignSelf": true,
    "labels": ["ueos-generated", "needs-review"]
  },
  "notifications": {
    "googleTasks": {
      "enabled": true,
      "webhookUrl": ""
    }
  },
  "swarm": {
    "defaultAgents": 7,
    "topology": "adaptive",
    "performanceMode": true
  },
  "security": {
    "encryptionAlgorithm": "aes-256-gcm",
    "keyDerivation": "pbkdf2",
    "iterations": 100000
  }
}
EOF

    # Agent configuration
    cat > "$UEOS_HOME/config/agents.json" << EOF
{
  "research": {
    "enabled": true,
    "tools": ["playwright", "google"],
    "maxConcurrent": 3
  },
  "spec": {
    "enabled": true,
    "templates": ["medical", "financial", "web", "api", "ml"],
    "compliance": ["hipaa", "gdpr", "sox", "pci"]
  },
  "dev": {
    "enabled": true,
    "languages": ["javascript", "python", "go", "rust"],
    "frameworks": ["react", "vue", "express", "fastapi", "django"]
  },
  "qa": {
    "enabled": true,
    "coverage": 80,
    "strategies": ["unit", "integration", "e2e", "performance"]
  },
  "integration": {
    "enabled": true,
    "services": ["github", "gitlab", "slack", "jira"]
  }
}
EOF

    log_success "Configuration initialized"
}

# Create CLI library files
create_cli_library() {
    log_info "Creating CLI library..."

    # Main CLI handler
    cat > "$UEOS_HOME/lib/cli.js" << 'EOF'
const { Command } = require('commander');
const { version } = require('../package.json');
const { Core } = require('./core');
const { Workflow } = require('./workflow');
const { Monitor } = require('./monitor');

class CLI {
    constructor() {
        this.program = new Command();
        this.core = new Core();
        this.workflow = new Workflow();
        this.monitor = new Monitor();

        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('ueos')
            .description('Universal Environment Optimization System')
            .version(version);

        // Init command
        this.program
            .command('init')
            .description('Initialize UEOS in current directory')
            .option('-f, --force', 'Force initialization')
            .action(async (options) => {
                await this.core.init(process.cwd(), options);
            });

        // Develop command
        this.program
            .command('develop <task>')
            .description('Start spec-driven development')
            .option('-a, --agents <number>', 'Number of agents', '7')
            .option('-p, --performance', 'Enable performance mode')
            .action(async (task, options) => {
                await this.workflow.develop(task, options);
            });

        // Status command
        this.program
            .command('status')
            .description('Show current workflow status')
            .action(async () => {
                await this.monitor.status();
            });

        // Watch command
        this.program
            .command('watch')
            .description('Watch workflow in real-time')
            .action(async () => {
                await this.monitor.watch();
            });
    }

    async execute(argv) {
        await this.program.parseAsync(argv, { from: 'user' });
    }
}

module.exports = { CLI };
EOF

    # Core functionality
    cat > "$UEOS_HOME/lib/core.js" << 'EOF'
const fs = require('fs').promises;
const path = require('path');
const { ContextDetector } = require('./context-detector');
const { SecretManager } = require('./secret-manager');

class Core {
    constructor() {
        this.contextDetector = new ContextDetector();
        this.secretManager = new SecretManager();
    }

    async init(projectPath, options = {}) {
        console.log('Initializing UEOS in', projectPath);

        // Detect project context
        const context = await this.contextDetector.analyze(projectPath);
        console.log('Detected context:', context);

        // Create local configuration
        const localConfig = {
            project: path.basename(projectPath),
            context,
            created: new Date().toISOString()
        };

        // Save configuration
        const configPath = path.join(projectPath, '.ueos');
        await fs.mkdir(configPath, { recursive: true });
        await fs.writeFile(
            path.join(configPath, 'config.json'),
            JSON.stringify(localConfig, null, 2)
        );

        console.log('UEOS initialized successfully!');
        return { success: true, context };
    }
}

module.exports = { Core };
EOF

    log_success "CLI library created"
}

# Create placeholder files for remaining modules
create_placeholders() {
    log_info "Creating module placeholders..."

    # Context detector placeholder
    cat > "$UEOS_HOME/lib/context-detector.js" << 'EOF'
class ContextDetector {
    async analyze(projectPath) {
        // TODO: Implement full context detection
        return {
            type: 'web',
            stack: 'node',
            complexity: 'moderate',
            compliance: []
        };
    }
}

module.exports = { ContextDetector };
EOF

    # Secret manager placeholder
    cat > "$UEOS_HOME/lib/secret-manager.js" << 'EOF'
const crypto = require('crypto');

class SecretManager {
    constructor() {
        this.algorithm = 'aes-256-gcm';
    }

    encrypt(data) {
        // TODO: Implement encryption
        return data;
    }

    decrypt(data) {
        // TODO: Implement decryption
        return data;
    }
}

module.exports = { SecretManager };
EOF

    # Workflow placeholder
    cat > "$UEOS_HOME/lib/workflow.js" << 'EOF'
class Workflow {
    async develop(task, options) {
        console.log('Starting development workflow for:', task);
        console.log('Options:', options);
        // TODO: Implement workflow execution
        return { success: true };
    }
}

module.exports = { Workflow };
EOF

    # Monitor placeholder
    cat > "$UEOS_HOME/lib/monitor.js" << 'EOF'
class Monitor {
    async status() {
        console.log('Workflow Status: Ready');
        // TODO: Implement status checking
    }

    async watch() {
        console.log('Watching workflow...');
        // TODO: Implement real-time monitoring
    }
}

module.exports = { Monitor };
EOF

    log_success "Module placeholders created"
}

# Final setup
finalize_installation() {
    log_info "Finalizing installation..."

    # Create completion script
    cat > "$UEOS_HOME/lib/completion.sh" << 'EOF'
# UEOS Bash completion
_ueos_completions() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local commands="init develop status watch spec test deploy help"

    if [ $COMP_CWORD -eq 1 ]; then
        COMPREPLY=($(compgen -W "$commands" -- "$cur"))
    fi
}

complete -F _ueos_completions ueos
EOF

    # Create README
    cat > "$UEOS_HOME/README.md" << EOF
# UEOS - Universal Environment Optimization System

Version: ${UEOS_VERSION}
Installed: $(date)

## Quick Start

\`\`\`bash
# Initialize in any project
cd /path/to/project
ueos init

# Start development
ueos develop "Build a REST API with authentication"

# Monitor progress
ueos status
ueos watch
\`\`\`

## Configuration

Configuration files are located in:
- Global: ~/.ueos/config/
- Project: ./.ueos/config.json

## Support

For issues or questions, create an issue on GitHub.
EOF

    log_success "Installation finalized"
}

# Print success message
print_success() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                        ║${NC}"
    echo -e "${GREEN}║     UEOS Installation Complete! 🎉                    ║${NC}"
    echo -e "${GREEN}║                                                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "UEOS has been successfully installed to: $UEOS_HOME"
    echo ""
    echo "To get started:"
    echo "  1. Restart your terminal or run: source ~/.bashrc"
    echo "  2. Navigate to any project directory"
    echo "  3. Run: ueos init"
    echo "  4. Start developing: ueos develop \"your task\""
    echo ""
    echo "For help, run: ueos --help"
    echo ""
}

# Main installation flow
main() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   UEOS - Universal Environment Optimization System    ║${NC}"
    echo -e "${BLUE}║                 Installation Script                   ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""

    check_requirements
    create_structure
    install_core
    install_dependencies
    integrate_swarm_stack
    setup_shell_integration
    initialize_config
    create_cli_library
    create_placeholders
    finalize_installation
    print_success
}

# Run installation
main "$@"