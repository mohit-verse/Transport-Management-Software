# Frontend Component System

## 1. Purpose
This document catalogs the primary reusable UI components for the SRL application. Building the interface using a strict component system ensures visual consistency, accelerates development, and guarantees that behavior (like permissions and financial formatting) is applied universally.

## 2. Structural & Layout Components

### 2.1 `AppShell`
- **Description:** The root layout component for authenticated users.
- **Includes:** `Sidebar`, `TopHeader`, `GlobalSearchModal`.
- **Props:** `children` (the specific page content).

### 2.2 `Sidebar` & `TopHeader`
- **Sidebar:** Reads the user's role from Global UI State and only renders allowed navigation links. Contains a collapse/expand toggle for desktop.
- **TopHeader:** Contains the global search trigger, active route breadcrumbs, and user profile dropdown.

### 2.3 `PageContainer`
- **Description:** Standardizes page padding, max-width, and header spacing.
- **Props:** `title` (H1), `actions` (ReactNode - usually a group of primary buttons like "Create Trip").

## 3. Data Display Components

### 3.1 `DataTable`
- **Description:** The primary component for tabular data on desktop.
- **Features:** 
  - Sortable columns.
  - Sticky header.
  - Optional pagination footer.
  - Empty state fallback.
- **Props:** `columns` (definitions), `data` (array of objects), `isLoading`, `onRowClick`.

### 3.2 `DataCard` & `DataCardList`
- **Description:** The primary component for data lists on mobile screens.
- **Features:** Renders key-value pairs hierarchically.

### 3.3 `ResponsiveList` (Composite)
- **Description:** A smart wrapper that automatically renders a `DataTable` on desktop and a `DataCardList` on mobile based on viewport breakpoints.

### 3.4 `AmountDisplay`
- **Description:** The ONLY approved way to render financial values in the application.
- **Features:** 
  - Prepends 'â‚¹'.
  - Applies Indian comma formatting.
  - Right-aligns by default.
  - Applies color coding (e.g., red for negative/payable, green for positive/receivable) based on a `type` prop.
- **Props:** `amount` (Number/String from backend), `type` ('neutral' | 'positive' | 'negative').

### 3.5 `StatusBadge`
- **Description:** Visual indicator for standard statuses (e.g., Completed, Cancelled, POD Pending).
- **Features:** Maps predefined status strings to specific background/text colors (Green, Red, Yellow, Gray).

## 4. Form & Input Components

### 4.1 `FormField`
- **Description:** A wrapper for inputs that handles labels, required asterisks, and inline validation error messages.

### 4.2 Inputs: `TextInput`, `NumberInput`, `DateInput`, `Select`
- **Description:** Standardized input fields styled consistently.
- **NumberInput Rule:** Must prevent the user from typing 'e', '+', or '-' (unless specifically required). Must not execute floating point math on `onChange`.

### 4.3 `SearchableSelect` / `AsyncSelect`
- **Description:** A dropdown that queries the backend as the user types.
- **Usage:** Linking a Party to a Trip, selecting a Market Vehicle. Must handle debouncing and loading states.

## 5. Feedback & Interaction Components

### 5.1 `Button`
- **Variants:** `primary`, `secondary`, `danger`, `ghost`.
- **States:** `disabled`, `loading` (shows spinner and disables interaction).
- **Role-Aware:** Can accept a `requiredRole` prop to conditionally render or hide based on the user's permissions.

### 5.2 `ConfirmationModal`
- **Description:** Standard dialogue for destructive or financially sensitive actions (e.g., reversing a payment).
- **Props:** `title`, `message`, `confirmText`, `cancelText`, `onConfirm`, `onCancel`, `isDestructive` (colors confirm button red).

### 5.3 `ToastManager`
- **Description:** Global notification system for transient feedback.
- **Usage:** "Trip created successfully", "Error fetching data".
- **Types:** `success`, `error`, `info`, `warning`.
- Automatically dismisses after 3-5 seconds (except for critical errors which require manual dismissal).

## 6. Business-Specific Components

### 6.1 `DocumentUploader`
- **Description:** A drag-and-drop zone for uploading PODs, courier receipts, or issue photos.
- **Features:** Validates file type (PDF, JPG, PNG) and size client-side before dispatching to the API.

### 6.2 `BillPreview`
- **Description:** Used in both Bill Designer and Bill Details to render the HTML/CSS representation of a bill template injected with data. Read-only for Staff, editable config overlay for Owner.
