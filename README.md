# Shri Sanwariya Road Lines (SRL) Transport Management Software

## Overview
The SRL Application is a comprehensive, internal web-based business management system designed specifically for the transportation operations of Shri Sanwariya Road Lines. It replaces fragmented record-keeping with a centralized, auditable system for managing trips, billing, actual business payments, and financial reporting.

## Key Features

- **Trips Management:** Handle both market vehicles and own-fleet operations seamlessly.
- **Finance & Billing:** Generate dynamic bills, manage complex party credits (FIFO), track actual money movement through a single unified payment module.
- **Reporting:** P&L, receivables, payables, outstanding balances, and TDS management.
- **Role-Based Access Control (RBAC):** Distinct permissions tailored for the Owner, Staff, and CA.
- **Document Management:** Centralized indexing and storage referencing business objects (LR, PODs, Invoices).
- **Dashboard & Global Search:** Aggregated business snapshots and rapid cross-module search.

## Tech Stack
- **Backend:** Node.js, Express, TypeScript, Zod (Validation), JSON Web Tokens (JWT)
- **Database:** PostgreSQL (with complex triggers enforcing strict data integrity)
- **Frontend:** (In development)

## Project Structure
\\\
.
├── backend/            # Express.js REST API and services
│   ├── src/            # Source code (routes, controllers, services, middlewares)
│   └── tests/          # Jest integration tests per module
├── database/           # PostgreSQL definitions
│   └── migrations/     # The locked initial schema and subsequent migrations
├── docs/               # Detailed system specifications and business requirements (Source of Truth)
└── AGENTS.md           # Instructions and rules for AI generation
\\\

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+)

### Backend Setup

1. **Navigate to the backend directory:**
   \\\ash
   cd backend
   \\\

2. **Install dependencies:**
   \\\ash
   npm install
   \\\

3. **Configure the environment:**
   Create a \.env\ file in the \ackend/\ directory matching the configuration required by the application.
   \\\env
   PORT=3000
   NODE_ENV=development
   DATABASE_URL=postgresql://user:password@localhost:5432/srl_db
   JWT_SECRET=your_super_secret_jwt_key
   \\\

4. **Initialize the Database:**
   Ensure PostgreSQL is running and apply the schema:
   \\\ash
   psql -U postgres -d srl_db -f ../database/migrations/001_initial_schema.sql
   \\\

5. **Start the development server:**
   \\\ash
   npm run dev
   \\\

## Testing
The backend is extensively tested using Jest against an active, isolated PostgreSQL database to ensure triggers and business logic are fully verified.

To run the complete regression test suite:
\\\ash
cd backend
npm run test
\\\

## Critical Development Principles
- **Source of Truth:** The \/docs\ folder contains all foundational business rules. Do not bypass or invent rules.
- **Payment Source of Truth:** The Payment module is the sole location where actual incoming and outgoing monetary records are stored. Do not build alternate financial ledgers.
- **Strict Database Triggers:** Do not disable database constraints or triggers during testing or implementation.

## License
Proprietary internal software. All rights reserved by Shri Sanwariya Road Lines (SRL).
