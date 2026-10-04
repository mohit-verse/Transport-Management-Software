# Frontend Architecture

## 1. Purpose
This document defines the overarching frontend architecture for the Shri Sanwariya Road Lines (SRL) web application. It specifies the framework conventions, state management strategy, API client patterns, authentication flow, and error handling mechanisms to ensure a scalable, maintainable, and robust user interface.

## 2. Core Framework & Philosophy
- **Framework:** Modern React (or equivalent modern component-based framework like Vue/Angular).
- **Language:** TypeScript. Strict typing is required to enforce API contracts (e.g., `Owner`, `Staff`, `CA` roles, and financial data shapes) at compile time.
- **Rendering Strategy:** Single Page Application (SPA) or cautiously implemented Server-Side Rendering (SSR) depending on infrastructure, with a strong emphasis on fast client-side transitions for operational efficiency.
- **Component Architecture:** Functional components with hooks. Clear separation between "Container/Smart" components (data fetching, state) and "Presentational/Dumb" components (UI rendering).

## 3. State Management Strategy

### 3.1 Server State (Data Fetching & Caching)
- **Tooling:** A dedicated data-fetching library (e.g., React Query, SWR, or Apollo if GraphQL).
- **Principles:**
  - The backend is the single source of truth.
  - Server state must be cached, invalidated, and refetched predictably.
  - Pagination, filtering, and search state should be synchronized with the URL query parameters to allow deep-linking and context preservation (e.g., `?status=completed&page=2`).
  - Mutations (create, update, reverse payment) must optimistically update the UI or invalidate relevant queries immediately upon success.

### 3.2 Global UI State
- **Tooling:** A lightweight global state manager (e.g., Zustand, Context API, or Redux Toolkit).
- **Scope:** Strictly limited to UI state that spans multiple branches of the component tree:
  - Current authenticated user and role context.
  - Sidebar collapsed/expanded state.
  - Global theme/configuration preferences.
- **Anti-pattern:** Do not store API responses (business data) in the global UI state store. Use the Server State tool for that.

### 3.3 Local Component State
- **Scope:** Form inputs, local toggle states (e.g., open/close modal), and UI transients.

## 4. API Client & Interceptors

### 4.1 Client Configuration
- **Tooling:** Axios or native `fetch` wrapper.
- **Base URL:** Configured via environment variables (e.g., `VITE_API_BASE_URL`).

### 4.2 Interceptors
- **Request Interceptor:** 
  - Automatically attaches the authentication token (Bearer token or session cookie).
  - Appends necessary headers (e.g., `Content-Type: application/json`).
- **Response Interceptor:**
  - Standardizes the response format.
  - **401 Unauthorized:** Automatically clears the local session and redirects the user to the login page.
  - **403 Forbidden:** Renders an "Access Denied" boundary or toast without crashing the app.
  - **500 Internal Error:** Catches unhandled server errors and shows a generic fallback UI.

## 5. Authentication Flow

1. **Login:** User submits credentials (mobile/password).
2. **Token Storage:** Upon success, the system stores the token securely (HttpOnly cookies preferred; or secure local storage if architecture dictates). The `user` object (ID, name, role) is placed in Global UI State.
3. **App Initialization:** On app load, a `/api/auth/me` call validates the existing session. A loading splash screen is shown until this resolves.
4. **Logout:** Explicit logout clears the token, flushes the Server State cache, and redirects to `/login`.

## 6. Authorization & Role-Based Access Control (RBAC)

Frontend authorization is for **UI visibility and UX only**. Backend enforces actual security.
- **Route Guards:** High-level React components that wrap routes. If a `STAFF` attempts to access an `OWNER` route (e.g., `/settings`), they are immediately redirected or shown a 403 page.
- **Component-Level Checks:** Utility hooks (e.g., `usePermissions()`) to conditionally render UI elements.
  - Example: `if (role === 'OWNER') { return <ReversePaymentButton /> }`
- **Visibility:** Do not render disabled buttons for actions a user will never have permission to do (e.g., CA seeing a "Create Trip" button). Hide them completely to reduce UI clutter.

## 7. Error Handling & Loading Patterns

### 7.1 Loading States
- **Initial Load:** Skeleton loaders matching the layout of the expected data (e.g., table row skeletons, card skeletons).
- **Mutations:** Inline loading spinners on buttons (e.g., "Saving..."). Buttons must be disabled during active mutations to prevent double-submission.
- **Background Fetching:** Silent background updates (via data-fetching libraries) should not disrupt the user's view.

### 7.2 Error Handling
- **Global Error Boundaries:** Catch unexpected JavaScript errors in the React tree and display a graceful fallback UI ("Something went wrong") with a button to reload the page.
- **API Errors (Read):** If a primary data fetch fails, display a localized error state (e.g., "Failed to load trips. [Retry]").
- **API Errors (Mutation):** Display backend validation errors directly mapped to form fields. For general errors, display a Toast notification (e.g., "Failed to reverse payment: Insufficient permissions").

## 8. Financial Data Handling Rules
- **No Floating Point Math:** The frontend must NEVER perform calculations on financial values using JavaScript floating-point numbers.
- **Authoritative Backend:** The frontend displays totals and calculated values exactly as returned by the backend API.
- **Display Formatting:** All financial values must be formatted via a strict, centralized utility function (e.g., `formatCurrency(value)`) that guarantees the standard Indian Rupee representation.

## 9. Context Preservation
When navigating away from a list (e.g., Trip List) to a detail view and clicking "Back", the frontend must preserve:
- Search queries.
- Active filters.
- Pagination state.
This is achieved by synchronizing these states with URL Query Parameters rather than local component state.
