# KidCoord - Parent Coordination Platform

**Version:** 2.0.0  
**Architecture:** Event-driven, Idempotent, Audit-first  
**Status:** Foundation Complete, Backend Started. Feature work is parked.

> A mobile and API platform designed to simplify daily logistics for families. The MVP focuses on morning school drop-off coordination with Care Credits to recognize community contribution.

## Client shell (locked)

Cos locked the client shell on November 2, 2026, about 7:29 PM ET (America/New_York). The Owner, EL, SA, QA, Hyg, Cost Keeper, and Prioritizer council was unanimous: stay on React Native.

- **Locked:** fully native React Native. Continue the existing React Native 0.73 client in this repo.
- **Rejected:** a hybrid WebView shell.
- **Not binding:** a PWA or Add-to-Home-Screen page. That is a compromise only if Cos and K later consciously make SMS or email the primary wake channel. Until then it is a trial or share surface only, and never the handoff system of record.

This lock does not un-park the product. Dig invents Dig OUT until Cos un-parks. Full record: [docs/CLIENT_SHELL.md](./docs/CLIENT_SHELL.md).

---

## 🎯 Project Overview

KidCoord replaces informal coordination (texts, group chats) with structured, transparent execution. Built on a reusable coordination framework, it starts with school drop-off and expands to activities and playdates.

### Key Features
- **Explicit Coordination**: Clear responsibility from request to completion
- **State Machines**: Valid transitions enforced for trust and safety
- **Care Credits**: Automatic recognition of community contribution
- **Idempotent API**: Safe retries on unreliable mobile networks
- **Audit Trail**: Complete traceability of all actions

---

## 🚀 Quick Start

### Backend Setup
```bash
cd backend
npm install
createdb kidcoord
psql kidcoord < schema.sql
cp .env.example .env
npm run dev
```

### Frontend Setup
```bash
npm install
cd ios && pod install && cd ..
npm run ios  # or npm run android
```

See [QUICKSTART.md](./QUICKSTART.md) for details.

---

## 📁 Repository Structure

```
kidcoord/
├── backend/                    # Node.js + TypeScript API
│   ├── src/                   # ✅ Complete foundation
│   ├── schema.sql            # ✅ Full database schema
│   └── README.md             
│
├── src/                       # React Native app
│   ├── components/           # ✅ Core components
│   ├── screens/              # ⚠️  Needs migration
│   ├── store/                # ⚠️  Needs updating
│   └── types/                # ✅ Updated for v2
│
└── docs/                      # ✅ Complete documentation
    ├── API_V2.md             # 50+ endpoints
    ├── ARCHITECTURE.md       # System design
    └── ...
```

---

## ✅ What's Complete

- ✅ Database schema (100%)
- ✅ Backend foundation (70%)
- ✅ Needs API endpoint (100% - example)
- ✅ Idempotency middleware (100%)
- ✅ State machine validation (100%)
- ✅ Documentation (100%)
- ⚠️  Frontend (40% - needs migration)

---

## 📚 Documentation

| Doc | Purpose |
|-----|---------|
| [API_V2.md](./API_V2.md) | Complete API spec |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design |
| [IMPLEMENTATION_PROGRESS.md](./IMPLEMENTATION_PROGRESS.md) | Roadmap & status |
| [backend/README.md](./backend/README.md) | Backend guide |
| [REGULATORY_CONSIDERATIONS.md](./docs/REGULATORY_CONSIDERATIONS.md) | Privacy and kids-PII planning notes (not legal advice) |
| [LEGAL_IN_APP_SECTION.md](./docs/LEGAL_IN_APP_SECTION.md) | Legal UI recommendations (thin-client, server-served) |
| [CLIENT_SHELL.md](./docs/CLIENT_SHELL.md) | Client shell lock: native React Native 0.73 |

---

## 🔧 Development

```bash
# Backend
cd backend && npm run dev

# Frontend  
npm start && npm run ios

# Database
psql kidcoord < backend/schema.sql
```

---

## 📊 Timeline

The figures below are the recorded v2 estimate. They are not an un-park. Feature work stays parked until Cos un-parks.

**Backend MVP:** 12-16 weeks  
**Frontend Migration:** 3-4 weeks  
**Total to Production:** 16-20 weeks

See [IMPLEMENTATION_PROGRESS.md](./IMPLEMENTATION_PROGRESS.md)

---

**Built for parents, by parents** ❤️
