# Battery CRM - HighFlow

A complete Battery Warranty Claim Management System for HighFlow Industries.

## Tech Stack

- **Backend**: Node.js + Express + PostgreSQL
- **Frontend**: React + Vite + TailwindCSS
- **Mobile**: React Native (Expo) — coming next

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### 1. Database Setup

Create a PostgreSQL database:
```sql
CREATE DATABASE battery_crm;
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials and JWT secret

npm install
npm run migrate    # Create all tables
npm run seed       # Load test data
npm run dev        # Start backend on port 5000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev        # Start frontend on port 3000
```

Open http://localhost:3000 in your browser.

### Default Login Credentials (after seeding)

| Username  | Password   | Role           |
|-----------|------------|----------------|
| admin     | Admin@123  | Admin          |
| dispatch  | Admin@123  | Claim Dispatch |
| returns   | Admin@123  | Claim Return   |
| store     | Admin@123  | Store Manager  |
| enghead   | Admin@123  | Engineer Head  |
| engineer1 | Admin@123  | Field Engineer |

## Module Overview

| Module             | Description                                |
|--------------------|--------------------------------------------|
| Dashboard          | Real-time stats, charts, recent complaints |
| Complaints         | Full warranty claim lifecycle management   |
| Distributors       | Distributor management & approval          |
| Dealers            | Dealer management under distributors       |
| Engineers          | Service engineer assignment                |
| Customers          | Customer database                          |
| Products           | Battery product catalog with warranty info |
| Serial Numbers     | Warranty registration by serial number     |
| Claim Dispatch     | Battery replacement dispatch workflow      |
| Claim Return       | Return tracking (pending/done)             |
| Received           | Physical battery receipt at warehouse      |
| Counter Replace    | Counter replacement records                |
| Claim Outward      | Outward dispatch management                |
| Scrap List         | Scrap battery management                   |
| Drivers            | Delivery driver management                 |
| Grace Period       | Warranty extension requests & approval     |
| Banners            | Mobile app banner management               |
| Gallery            | Product video gallery                      |
| Users              | System user & role management              |

## API Endpoints

All endpoints prefix: `/api`

- `POST /auth/login` — Login
- `GET /auth/me` — Current user
- `GET/POST /distributors` — Distributor CRUD
- `GET/POST /dealers` — Dealer CRUD
- `GET/POST /complaints` — Complaint management
- `PUT /complaints/:id/assign-engineer` — Assign engineer
- `PUT /complaints/:id/inspect` — Submit inspection
- `GET/POST /dispatch` — Claim dispatch
- `PUT /dispatch/:id/gatepass` — Generate gatepass
- `PUT /dispatch/:id/dispatch` — Mark dispatched
- ... (and 50+ more endpoints)

## Roles & Permissions

- **admin** — Full access to everything
- **distributor** — Own complaints, dealers, serials
- **dealer** — Own complaints, serials
- **engineer_head** — Assign engineers, view all complaints
- **service_engineer** — Inspect assigned complaints
- **claim_dispatch** — Manage dispatch workflow
- **claim_return** — Manage return workflow
- **store** — Received batteries, counter replacements

## Improvements over existing app

1. Clean, modern UI with real-time data
2. Proper dashboard with charts (was "Coming Soon")
3. Fixed all typos (receiced → received, approvel → approval)
4. Consistent status tracking across all modules
5. Faster search & pagination
6. JWT authentication with role-based access
7. RESTful API design
