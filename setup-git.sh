#!/bin/bash

# KidCoord Git Setup Script
# This script initializes the Git repository and prepares it for pushing to GitHub

echo "🚀 KidCoord Git Setup"
echo "===================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the kidcoord directory"
    echo "   cd kidcoord"
    echo "   ./setup-git.sh"
    exit 1
fi

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Error: Git is not installed"
    echo ""
    echo "Please install Git first:"
    echo "  Mac: Type 'git' in terminal and follow prompts"
    echo "  Windows: https://git-scm.com/download/win"
    echo "  Linux: sudo apt-get install git"
    exit 1
fi

echo "✅ Git is installed"
echo ""

# Initialize Git repository
echo "📦 Initializing Git repository..."
git init
git branch -M main

# Configure Git user (if not already configured)
if [ -z "$(git config --global user.name)" ]; then
    echo ""
    echo "🔧 Git user not configured. Let's set it up:"
    read -p "Enter your name: " git_name
    read -p "Enter your email: " git_email
    
    git config --global user.name "$git_name"
    git config --global user.email "$git_email"
    
    echo "✅ Git user configured"
else
    echo "✅ Git user already configured: $(git config --global user.name)"
fi

echo ""

# Stage all files
echo "📝 Staging all files..."
git add .

# Create commits
echo "💾 Creating commits..."

# Commit 1: Foundation
git commit -m "chore: initial commit with project foundation

- Complete PostgreSQL database schema
- Backend API foundation (Express + TypeScript)
- Idempotency middleware implementation
- State machine validation utilities
- Needs API endpoint (complete example)
- React Native app structure (needs migration)
- Comprehensive documentation
- Setup guides and README"

# Commit 2: Line endings
git add .gitattributes
git commit -m "chore: add .gitattributes for consistent line endings" --allow-empty

# Commit 3: GitHub integration
git add .github/ GITHUB_PROJECT.md
git commit -m "chore: add GitHub project integration

- Issue templates (feature, bug)
- Pull request template
- GitHub Actions CI workflow
- Project board integration guide
- Automated workflows for issues and PRs" --allow-empty

echo ""
echo "✅ Git repository initialized with 3 commits"
echo ""

# Add remote
echo "🔗 Adding GitHub remote..."
git remote add origin https://github.com/kaushikkuberanathan/KidCoord.git

echo ""
echo "✅ Remote added: https://github.com/kaushikkuberanathan/KidCoord.git"
echo ""

# Show status
echo "📊 Repository Status:"
git log --oneline
echo ""

echo "🎉 Setup complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Get your GitHub Personal Access Token:"
echo "   → Go to: https://github.com/settings/tokens"
echo "   → Click 'Generate new token (classic)'"
echo "   → Check 'repo' and 'workflow' scopes"
echo "   → Copy the token"
echo ""
echo "2. Push to GitHub:"
echo "   git push -u origin main --force"
echo ""
echo "3. When prompted:"
echo "   Username: kaushikkuberanathan"
echo "   Password: [paste your token]"
echo ""
echo "Need help? See PUSH_GUIDE.md for detailed instructions"
