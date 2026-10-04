# Frontend Route Map

## 1. Purpose
This document maps out the client-side routes for the SRL application. It defines the URL structure, layout wrapper, allowed roles (Owner, Staff, CA), the primary view component, and the main backend API data source for that route.

## 2. Layouts
- **Auth Layout:** Unauthenticated shell. Minimal UI. Used for `/login`.
- **App Layout:** Authenticated shell. Includes Sidebar, Header, Global Search. Used for all protected routes.

## 3. Route Definitions

### 3.1 Authentication & Root
| Route Path | Allowed Roles | Layout | Primary API Source | Purpose |
|------------|---------------|--------|--------------------|---------|
| `/login` | Public | Auth | `POST /api/auth/login` | User authentication. |
| `/` | Owner, Staff, CA| App | `GET /api/dashboard` | Redirects to `/dashboard`. |
| `/dashboard` | Owner, Staff, CA| App | `GET /api/dashboard` | Role-aware business summary. |

### 3.2 Operations
_Note: CA role is excluded from operational navigation._

| Route Path | Allowed Roles | Layout | Primary API Source | Purpose |
|------------|---------------|--------|--------------------|---------|
| `/trips` | Owner, Staff | App | `GET /api/trips` | List, filter, and search trips. |
| `/trips/new` | Owner, Staff | App | `POST /api/trips` | Form to create a new trip. |
| `/trips/:id` | Owner, Staff | App | `GET /api/trips/:id` | Complete trip details, workflow actions, financials, PODs. |
| `/parties` | Owner, Staff, CA*| App | `GET /api/parties` | List Parties/Companies. (*CA access via deep link from finance context). |
| `/parties/:id` | Owner, Staff, CA*| App | `GET /api/parties/:id` | Party details, history, financial position. |
| `/vehicle-owners` | Owner, Staff | App | `GET /api/vehicle-owners` | List Vehicle Owners. |
| `/vehicle-owners/:id`| Owner, Staff | App | `GET /api/vehicle-owners/:id`| Vehicle Owner details, linked vehicles, payables. |
| `/market-vehicles` | Owner, Staff | App | `GET /api/market-vehicles` | List Market Vehicles. |
| `/own-fleet` | Owner, Staff | App | `GET /api/own-fleet` | List Own Fleet vehicles and statuses. |
| `/own-fleet/:id` | Owner, Staff | App | `GET /api/own-fleet/:id` | Own Fleet vehicle details, expense history, maintenance. |

### 3.3 Finance & Billing
| Route Path | Allowed Roles | Layout | Primary API Source | Purpose |
|------------|---------------|--------|--------------------|---------|
| `/payments` | Owner, Staff, CA | App | `GET /api/payments` | Master list of all payments. |
| `/payments/new` | Owner, Staff | App | `POST /api/payments` | Form to record incoming/outgoing payments. |
| `/payments/:id` | Owner, Staff, CA | App | `GET /api/payments/:id` | Payment details, allocations, reversal history. |
| `/bills` | Owner, Staff, CA | App | `GET /api/bills` | Master list of generated bills. |
| `/bills/new` | Owner, Staff | App | `POST /api/bills` | Workflow to select trips and generate a bill. |
| `/bills/:id` | Owner, Staff, CA | App | `GET /api/bills/:id` | View generated bill, download PDF, manage versions. |
| `/reports` | Owner, CA | App | `GET /api/reports/...` | Financial reports, P&L, Tax/TDS exports. |

### 3.4 Documents
| Route Path | Allowed Roles | Layout | Primary API Source | Purpose |
|------------|---------------|--------|--------------------|---------|
| `/documents` | Owner, Staff | App | `GET /api/documents` | Global view of uploaded documents, expiry alerts. |

### 3.5 Configuration & Settings
_Note: Strict Owner-only boundaries._

| Route Path | Allowed Roles | Layout | Primary API Source | Purpose |
|------------|---------------|--------|--------------------|---------|
| `/settings/billing`| Owner | App | `GET /api/settings/billing`| Bill Designer, template configuration, numbering series. |
| `/settings/users` | Owner | App | `GET /api/users` | Manage users, roles, and access. |
| `/settings/system` | Owner | App | `GET /api/settings/system`| Global business profile, financial year config. |

## 4. Route Guarding Rules
- If an unauthenticated user hits any route (except `/login`), redirect to `/login`.
- If an authenticated user hits a route they lack permission for (e.g., Staff navigating to `/settings/users`), the router must block the render and redirect them to `/dashboard` or show a specific `403 Unauthorized` view.
- Frontend route guarding is a UX feature. The backend API must independently validate the user's role on every data request.
