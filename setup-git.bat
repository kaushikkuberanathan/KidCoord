@echo off
REM KidCoord Git Setup Script for Windows
REM This script initializes the Git repository and prepares it for pushing to GitHub

echo.
echo 🚀 KidCoord Git Setup
echo ====================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: Please run this script from the kidcoord directory
    echo    cd kidcoord
    echo    setup-git.bat
    exit /b 1
)

REM Check if git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Git is not installed
    echo.
    echo Please install Git first:
    echo   Download from: https://git-scm.com/download/win
    exit /b 1
)

echo ✅ Git is installed
echo.

REM Initialize Git repository
echo 📦 Initializing Git repository...
git init
git branch -M main

REM Check if Git user is configured
for /f "tokens=*" %%i in ('git config --global user.name') do set git_user=%%i
if "%git_user%"=="" (
    echo.
    echo 🔧 Git user not configured. Let's set it up:
    set /p git_name="Enter your name: "
    set /p git_email="Enter your email: "
    
    git config --global user.name "%git_name%"
    git config --global user.email "%git_email%"
    
    echo ✅ Git user configured
) else (
    echo ✅ Git user already configured: %git_user%
)

echo.

REM Stage all files
echo 📝 Staging all files...
git add .

REM Create commits
echo 💾 Creating commits...

REM Commit 1: Foundation
git commit -m "chore: initial commit with project foundation - Complete PostgreSQL database schema - Backend API foundation (Express + TypeScript) - Idempotency middleware implementation - State machine validation utilities - Needs API endpoint (complete example) - React Native app structure (needs migration) - Comprehensive documentation - Setup guides and README"

REM Commit 2: Line endings
git add .gitattributes
git commit -m "chore: add .gitattributes for consistent line endings" --allow-empty

REM Commit 3: GitHub integration
git add .github\ GITHUB_PROJECT.md
git commit -m "chore: add GitHub project integration - Issue templates (feature, bug) - Pull request template - GitHub Actions CI workflow - Project board integration guide - Automated workflows for issues and PRs" --allow-empty

echo.
echo ✅ Git repository initialized with 3 commits
echo.

REM Add remote
echo 🔗 Adding GitHub remote...
git remote add origin https://github.com/kaushikkuberanathan/KidCoord.git

echo.
echo ✅ Remote added: https://github.com/kaushikkuberanathan/KidCoord.git
echo.

REM Show status
echo 📊 Repository Status:
git log --oneline
echo.

echo 🎉 Setup complete!
echo.
echo 📋 Next Steps:
echo 1. Get your GitHub Personal Access Token:
echo    → Go to: https://github.com/settings/tokens
echo    → Click 'Generate new token (classic)'
echo    → Check 'repo' and 'workflow' scopes
echo    → Copy the token
echo.
echo 2. Push to GitHub:
echo    git push -u origin main --force
echo.
echo 3. When prompted:
echo    Username: kaushikkuberanathan
echo    Password: [paste your token]
echo.
echo Need help? See PUSH_GUIDE.md for detailed instructions
echo.
pause
