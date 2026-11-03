# KidCoord - Parent Coordination Platform

**Version:** 2.0.0  
**Architecture:** Event-driven, Idempotent, Audit-first  
**Status:** Foundation Complete, Backend Started

> A mobile and API platform designed to simplify daily logistics for families. The MVP focuses on morning school drop-off coordination with Care Credits to recognize community contribution.

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

**Backend MVP:** 12-16 weeks  
**Frontend Migration:** 3-4 weeks  
**Total to Production:** 16-20 weeks

See [IMPLEMENTATION_PROGRESS.md](./IMPLEMENTATION_PROGRESS.md)

---

**Built for parents, by parents** ❤️
