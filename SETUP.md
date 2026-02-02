# KidCoord Setup Guide

This guide will walk you through setting up the KidCoord mobile app development environment from scratch.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Development Environment Setup](#development-environment-setup)
3. [Project Setup](#project-setup)
4. [Running the App](#running-the-app)
5. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

#### macOS (for iOS development)
- **macOS** 12.0 or later
- **Xcode** 14.0 or later
- **CocoaPods** 1.11 or later
- **Node.js** 18.0 or later
- **Watchman** (recommended)

#### Windows/Linux (for Android only)
- **Node.js** 18.0 or later
- **JDK** 11 or 17
- **Android Studio** with Android SDK

## Development Environment Setup

### 1. Install Node.js

**macOS (using Homebrew):**
```bash
brew install node
```

**Windows:**
Download from [nodejs.org](https://nodejs.org/)

**Verify installation:**
```bash
node --version  # Should be 18.0+
npm --version
```

### 2. Install Watchman (macOS, recommended)

```bash
brew install watchman
```

### 3. iOS Setup (macOS only)

#### Install Xcode
1. Download Xcode from the Mac App Store
2. Install Xcode Command Line Tools:
```bash
xcode-select --install
```

#### Install CocoaPods
```bash
sudo gem install cocoapods
```

### 4. Android Setup

#### Install Java Development Kit (JDK)

**macOS:**
```bash
brew install openjdk@17
```

**Windows/Linux:**
Download from [Oracle](https://www.oracle.com/java/technologies/downloads/) or use OpenJDK

#### Install Android Studio
1. Download from [developer.android.com/studio](https://developer.android.com/studio)
2. During installation, ensure these are selected:
   - Android SDK
   - Android SDK Platform
   - Android Virtual Device (AVD)

#### Configure Android SDK
1. Open Android Studio → Settings/Preferences
2. Navigate to: Appearance & Behavior → System Settings → Android SDK
3. Select SDK Platforms tab:
   - Install Android 13.0 (Tiramisu) or later
4. Select SDK Tools tab:
   - Android SDK Build-Tools
   - Android Emulator
   - Android SDK Platform-Tools

#### Set Environment Variables

**macOS/Linux** (add to `~/.bash_profile` or `~/.zshrc`):
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

**Windows** (System Environment Variables):
```
ANDROID_HOME = C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk
```
Add to Path:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
```

## Project Setup

### 1. Navigate to Project Directory
```bash
cd kidcoord
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Install iOS Dependencies (macOS only)
```bash
cd ios
pod install
cd ..
```

### 4. Update babel-plugin-module-resolver

Add this to `package.json` devDependencies:
```json
"babel-plugin-module-resolver": "^5.0.0"
```

Then run:
```bash
npm install
```

## Running the App

### Start Metro Bundler
In the project directory:
```bash
npm start
# or
yarn start
```

Keep this terminal window open.

### Run on iOS (macOS only)

**Option 1: Using CLI**
```bash
# In a new terminal window
npm run ios
# or
yarn ios
```

**Option 2: Using Xcode**
1. Open `ios/KidCoord.xcworkspace` in Xcode
2. Select a simulator or connected device
3. Press the Play button (⌘R)

### Run on Android

**Start an Android Emulator:**
1. Open Android Studio
2. AVD Manager → Create/Start Virtual Device

**Option 1: Using CLI**
```bash
# In a new terminal window
npm run android
# or
yarn android
```

**Option 2: Using Android Studio**
1. Open the `android` folder in Android Studio
2. Wait for Gradle sync to complete
3. Click Run button

## Troubleshooting

### Common Issues

#### 1. "command not found: react-native"
**Solution:** Use npm scripts instead:
```bash
npm run ios
npm run android
```

#### 2. iOS: "Unable to boot simulator"
**Solution:**
```bash
# Reset simulator
xcrun simctl erase all
```

#### 3. Android: "SDK location not found"
**Solution:** Create `android/local.properties`:
```
sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk
```

#### 4. Metro bundler port already in use
**Solution:**
```bash
# Kill process on port 8081
npx react-native start --reset-cache
```

#### 5. iOS: "No provisioning profiles found"
**Solution:**
1. Open Xcode
2. Select "Automatically manage signing"
3. Select your Apple Developer account

#### 6. CocoaPods errors
**Solution:**
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

#### 7. Module resolution errors with @ imports
**Solution:**
Ensure `babel.config.js` has the module-resolver plugin properly configured (already included in the project).

### Clean Build

If you encounter persistent issues:

**iOS:**
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
npm start -- --reset-cache
npm run ios
```

**Android:**
```bash
cd android
./gradlew clean
cd ..
npm start -- --reset-cache
npm run android
```

### Full Clean (Nuclear Option)
```bash
# Clean all dependencies and build artifacts
rm -rf node_modules
rm -rf ios/Pods ios/Podfile.lock
rm -rf ios/build
rm -rf android/.gradle android/build android/app/build
npm install
cd ios && pod install && cd ..
```

## Development Workflow

### 1. Making Changes
- Edit files in `src/`
- Metro bundler will auto-reload
- For native changes (iOS/Android), rebuild the app

### 2. Adding Dependencies
```bash
npm install package-name
# or
yarn add package-name

# For iOS, also run:
cd ios && pod install && cd ..
```

### 3. Running on Physical Device

**iOS:**
1. Connect iPhone via USB
2. Trust computer on device
3. Select device in Xcode
4. Run app

**Android:**
1. Enable Developer Options on device
2. Enable USB Debugging
3. Connect via USB
4. Run `npm run android`

## Next Steps

After successful setup:

1. **Review the Architecture**: Check `README.md` for project structure
2. **Explore the Code**: Start with `App.tsx` and `MorningDashboardScreen.tsx`
3. **Backend Integration**: Update API endpoints in `src/services/apiClient.ts`
4. **Test Features**: Try the morning dashboard and profile screens

## Additional Resources

- [React Native Documentation](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

## Getting Help

If you encounter issues:
1. Check this troubleshooting guide
2. Search [React Native GitHub Issues](https://github.com/facebook/react-native/issues)
3. Visit [Stack Overflow](https://stackoverflow.com/questions/tagged/react-native)
4. Contact the development team

---

**Happy Coding! 🚀**
