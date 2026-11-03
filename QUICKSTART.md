# KidCoord - Quick Start Guide

Welcome to the KidCoord School Drop-Off Manager MVP codebase! This guide will get you up and running quickly.

## 🎯 What You Have

A React Native 0.73 TypeScript mobile app. That native client is the locked shell (see [docs/CLIENT_SHELL.md](./docs/CLIENT_SHELL.md)). A hybrid WebView shell is rejected. A PWA is not the handoff system of record. Feature work stays parked.

The app includes:
- **Full architecture** aligned to the KidCoord coordination framework
- **Core screens**: Morning Dashboard, Profile with Care Credits
- **Type-safe** domain models and API contracts
- **State management** using Zustand with persistence
- **Design system** with reusable components
- **Comprehensive documentation**

## 🚀 Get Started in 3 Steps

### 1. Install Dependencies (5 minutes)
```bash
cd kidcoord
npm install
```

For iOS (macOS only):
```bash
cd ios && pod install && cd ..
```

### 2. Start Development Server
```bash
npm start
```

### 3. Run the App

**iOS:**
```bash
npm run ios
```

**Android:**
```bash
npm run android
```

## 📂 Key Files to Explore

### Start Here
1. **`README.md`** - Complete project overview
2. **`src/types/domain.ts`** - Core data models
3. **`src/screens/MorningDashboardScreen.tsx`** - Main MVP interface

### Important Directories
- **`src/screens/`** - All app screens
- **`src/components/`** - Reusable UI components
- **`src/store/`** - State management
- **`src/services/`** - API integration layer
- **`src/types/`** - TypeScript definitions

## 🔧 Next Steps

### Immediate (Today)
1. Read `SETUP.md` for detailed environment setup
2. Review `API.md` for backend endpoint specifications
3. Explore the Morning Dashboard screen
4. Check out the Profile screen with Care Credits

### Short-term (This Week)
1. Set up backend API endpoints (see `API.md`)
2. Update API base URL in `src/services/apiClient.ts`
3. Implement authentication screens
4. Test ride request flows

### Follow the Checklist
See `CHECKLIST.md` for complete development roadmap organized by phase.

## 📱 Project Structure

```
kidcoord/
├── App.tsx                      # Entry point
├── src/
│   ├── screens/
│   │   ├── MorningDashboardScreen.tsx  # Primary MVP screen
│   │   └── ProfileScreen.tsx            # User profile + Care Credits
│   ├── components/
│   │   ├── Button.tsx                   # Reusable button
│   │   └── ChildCard.tsx                # Dashboard child display
│   ├── navigation/
│   │   └── AppNavigator.tsx             # Bottom tab navigation
│   ├── store/
│   │   ├── appStore.ts                  # Global app state
│   │   └── dashboardStore.ts            # Dashboard-specific state
│   ├── services/
│   │   ├── apiClient.ts                 # HTTP client
│   │   └── dashboardService.ts          # Dashboard API calls
│   ├── types/
│   │   ├── domain.ts                    # Domain models
│   │   └── api.ts                       # API contracts
│   ├── constants/
│   │   └── theme.ts                     # Design tokens
│   └── utils/
│       └── dateUtils.ts                 # Date/time helpers
├── README.md                    # Full documentation
├── SETUP.md                     # Environment setup guide
├── API.md                       # Backend API specifications
├── CHECKLIST.md                 # Development roadmap
└── package.json                 # Dependencies
```

## 🎨 Understanding the Architecture

### KidCoord Coordination Framework
Everything is built on these core concepts:

1. **Needs** - Child needs a ride (signal)
2. **Availability** - Parent can drive (signal)
3. **Matching** - Connect needs with availability
4. **Execution** - Track ride from pickup to drop-off
5. **Care Credits** - Automatic contribution recognition

### Data Flow
```
User Action → Store Update → API Call → Backend
                    ↓
            Update Local State
                    ↓
              Re-render UI
```

### Key Design Patterns
- **Zustand** for state management (simpler than Redux)
- **Service layer** abstracts API calls
- **Type-safe** contracts between frontend/backend
- **Component composition** for reusability

## 💡 Pro Tips

### Development Workflow
1. **Hot Reload**: Edit code, save, see changes instantly
2. **Debug Menu**: Shake device (iOS) or Cmd+M / Ctrl+M (Android)
3. **React DevTools**: Install for component inspection
4. **Network Inspector**: Monitor API calls in debug menu

### Common Commands
```bash
# Clean rebuild
npm start -- --reset-cache

# Clear iOS build
cd ios && rm -rf Pods Podfile.lock && pod install && cd ..

# Clear Android build
cd android && ./gradlew clean && cd ..

# Type checking
npx tsc --noEmit
```

### Debugging Tips
- Use `console.log()` liberally (visible in Metro terminal)
- Set breakpoints in Chrome DevTools (remote debugging)
- Check Redux DevTools for state inspection
- Use React Native Debugger for integrated tooling

## 🆘 Troubleshooting

### Build Issues
- **"Module not found"**: `rm -rf node_modules && npm install`
- **iOS build fails**: Clean build folder in Xcode
- **Android build fails**: `cd android && ./gradlew clean`

### Runtime Issues
- **App won't start**: Check Metro bundler is running
- **White screen**: Check console for errors
- **API errors**: Verify backend URL and token

See `SETUP.md` for comprehensive troubleshooting guide.

## 📚 Documentation Index

1. **README.md** - Project overview, architecture, features
2. **SETUP.md** - Complete environment setup instructions
3. **API.md** - Backend API endpoint specifications
4. **CHECKLIST.md** - Development roadmap and task tracking
5. **This file** - Quick start guide

## 🎯 MVP Focus Areas

### Phase 1: Core Functionality ✅ DONE
- Project architecture
- Type definitions
- Core screens and components

### Phase 2: Backend Integration 🔄 NEXT
- Authentication flow
- API connection
- Real data integration

### Phase 3: Feature Completion 📝 UPCOMING
- Household management
- Driver availability
- Ride execution
- Safety features

## 🤝 Need Help?

1. Check documentation files
2. Review code comments
3. Consult React Native docs
4. Search Stack Overflow
5. Contact development team

## 🎉 You're Ready!

Everything is set up and ready for development. Start by:
1. Running the app on a simulator/device
2. Exploring the Morning Dashboard
3. Reviewing the Care Credits on Profile
4. Connecting to your backend API

**Happy coding!** 🚀

---

*Built for parents, by parents* ❤️
