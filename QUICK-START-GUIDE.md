# UEOS Quick Start Guide

## 🚀 5-Minute Setup

### 1. One-Line Installation

```bash
curl -sL https://raw.githubusercontent.com/m0nkey-fl0wer/ueos/main/install.sh | bash
```

Or using the local installer:

```bash
cd ~/work\ environment\ upgrades/ueos-bootstrap
chmod +x install.sh
./install.sh
```

### 2. Restart Terminal

```bash
source ~/.bashrc
# or
source ~/.zshrc
```

### 3. Verify Installation

```bash
ueos --version
# Output: UEOS v1.0.0
```

## 🎯 Instant Project Setup

### Initialize in Any Directory

```bash
cd /path/to/your/project
ueos init
```

This automatically:
- Detects project type (web, API, ML, etc.)
- Identifies tech stack
- Configures appropriate agent topology
- Sets up security requirements
- Creates local `.ueos/` configuration

## 💻 Core Commands

### Start Development Workflow

```bash
# Basic usage
ueos develop "Build a REST API with JWT authentication"

# With options
ueos develop "Create HIPAA-compliant patient portal" \
  --agents 10 \
  --performance \
  --github
```

### Monitor Progress

```bash
# Check status
ueos status

# Real-time monitoring
ueos watch

# View logs
ueos logs --tail 50
```

### Manage Workflows

```bash
# Pause current workflow
ueos pause

# Resume workflow
ueos resume

# Stop workflow
ueos stop

# List all workflows
ueos list
```

## 🔧 Configuration

### Global Settings

Edit `~/.ueos/config/global.json`:

```json
{
  "ssh": {
    "host": "seshat.noosworx.com",
    "port": 8888,
    "user": "m0nkey-fl0wer"
  },
  "github": {
    "owner": "m0nkey-fl0wer",
    "autoCreateIssues": true
  },
  "swarm": {
    "defaultAgents": 7,
    "performanceMode": true
  }
}
```

### Project-Specific Settings

Edit `./.ueos/config.json` in your project:

```json
{
  "type": "medical",
  "compliance": ["hipaa"],
  "agents": {
    "research": { "enabled": true },
    "spec": { "enabled": true },
    "dev": { "enabled": true },
    "qa": { "coverage": 90 }
  }
}
```

## 📚 Common Workflows

### 1. Web Application Development

```bash
ueos develop "Build React dashboard with real-time updates" \
  --template web \
  --framework react \
  --testing e2e
```

### 2. API Development

```bash
ueos develop "Create GraphQL API with authentication and rate limiting" \
  --template api \
  --framework express \
  --database postgres
```

### 3. Medical/HIPAA Compliant System

```bash
ueos develop "Build HIPAA-compliant patient management system" \
  --compliance hipaa \
  --security enhanced \
  --audit-logging
```

### 4. Data Pipeline

```bash
ueos develop "Create ETL pipeline for real-time data processing" \
  --template data \
  --streaming \
  --monitoring
```

## 🤖 Agent Management

### View Agent Status

```bash
ueos agents status
```

### Configure Agent Resources

```bash
ueos agents config --max-concurrent 5 --memory-limit 2G
```

### Enable/Disable Agents

```bash
ueos agents disable qa  # Disable QA agent
ueos agents enable qa   # Re-enable QA agent
```

## 🔐 Security & Secrets

### Add Secrets

```bash
# Add GitHub token
ueos secret add github_token

# Add SSH key
ueos secret add-ssh ~/.ssh/id_rsa

# Add API key
ueos secret add api_key --service openai
```

### List Secrets

```bash
ueos secret list
```

### Rotate Secrets

```bash
ueos secret rotate github_token
```

## 🔗 Integrations

### GitHub Integration

```bash
# Setup GitHub
ueos integrate github --token $GITHUB_TOKEN

# Create issue
ueos github issue "Bug in authentication flow"

# Create PR
ueos github pr --branch feature/auth --title "Add JWT authentication"
```

### Webhook Setup

```bash
# Configure Google Tasks webhook
ueos webhook add google-tasks https://hooks.google.com/your-webhook

# Test webhook
ueos webhook test google-tasks
```

### SSH Remote Execution

```bash
# Configure remote server
ueos remote add production user@server.com:22

# Execute on remote
ueos remote exec production "npm run deploy"
```

## 📊 Performance Optimization

### Enable Performance Mode

```bash
ueos config set performance.enabled true
ueos config set performance.cache true
ueos config set performance.parallel true
```

### View Performance Metrics

```bash
ueos metrics
ueos metrics --agent research
ueos metrics --export metrics.json
```

## 🐛 Troubleshooting

### Debug Mode

```bash
# Run with debug output
DEBUG=* ueos develop "Your task"

# Check logs
ueos logs --level debug
```

### Health Check

```bash
ueos health
ueos health --detailed
```

### Reset Configuration

```bash
# Reset project config
ueos reset

# Reset global config
ueos reset --global
```

### Common Issues

#### Issue: "Agent timeout"

```bash
# Increase timeout
ueos config set agents.timeout 300000
```

#### Issue: "Memory exhausted"

```bash
# Increase memory limit
ueos config set performance.memoryLimit 4096
```

#### Issue: "GitHub authentication failed"

```bash
# Re-authenticate
ueos secret update github_token
```

## 🎨 Templates

### List Available Templates

```bash
ueos template list
```

### Use Template

```bash
ueos develop "Your task" --template medical
```

### Create Custom Template

```bash
ueos template create my-template --from-project .
```

## 📈 Advanced Features

### Batch Processing

```bash
# Process multiple tasks
ueos batch tasks.json --parallel 3
```

### Scheduled Workflows

```bash
# Schedule daily workflow
ueos schedule daily "Update documentation" --time "09:00"
```

### Export/Import Configuration

```bash
# Export
ueos export config.zip

# Import
ueos import config.zip
```

## 🔄 Updates

### Check for Updates

```bash
ueos update --check
```

### Update UEOS

```bash
ueos update
```

### Rollback Version

```bash
ueos rollback 0.9.0
```

## 📝 Examples

### Complete Project Generation

```bash
# Navigate to workspace
cd ~/projects

# Initialize and develop
ueos init
ueos develop "Build a secure file sharing platform with end-to-end encryption" \
  --agents 10 \
  --performance \
  --github \
  --compliance gdpr \
  --testing comprehensive
```

### Integration with Existing Project

```bash
cd existing-project/
ueos init --integrate
ueos analyze  # Analyzes existing code
ueos suggest  # Suggests improvements
ueos implement suggestions.json
```

## 🆘 Getting Help

```bash
# General help
ueos help

# Command-specific help
ueos help develop

# Open documentation
ueos docs

# Contact support
ueos support
```

## 🎉 Quick Wins

### 1. Generate Complete REST API (2 minutes)

```bash
ueos develop "REST API with CRUD operations for user management"
```

### 2. Create React Component Library (5 minutes)

```bash
ueos develop "React component library with Storybook documentation"
```

### 3. Build Microservice Architecture (10 minutes)

```bash
ueos develop "Microservices architecture with API gateway and service discovery"
```

## 🔥 Pro Tips

1. **Use Performance Mode for Large Projects**
   ```bash
   ueos develop "task" --performance
   ```

2. **Enable Caching for Faster Iterations**
   ```bash
   ueos config set cache.enabled true
   ```

3. **Use Parallel Agents for Complex Tasks**
   ```bash
   ueos develop "task" --agents 15 --parallel
   ```

4. **Auto-Create GitHub Issues for Blockers**
   ```bash
   ueos config set github.autoCreateIssues true
   ```

5. **Monitor Remote Execution**
   ```bash
   ueos remote monitor production
   ```

## 📞 Support & Community

- **Documentation**: https://ueos.ai/docs
- **GitHub**: https://github.com/m0nkey-fl0wer/ueos
- **Issues**: https://github.com/m0nkey-fl0wer/ueos/issues
- **Discord**: https://discord.gg/ueos

---

**Ready to revolutionize your development workflow? Start with `ueos develop "your next big idea"` !** 🚀