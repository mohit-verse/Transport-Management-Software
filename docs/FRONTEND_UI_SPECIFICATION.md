# Frontend UI Specification

## 1. Purpose
This document specifies the visual design rules, layout patterns, responsive behavior, component styling, and specific UI requirements for the Shri Sanwariya Road Lines (SRL) application. It bridges the gap between the UX requirements and the actual frontend implementation.

## 2. Design System & Theming

### 2.1 Typography
- **Font Family:** A clean, highly legible sans-serif stack (e.g., Inter, Roboto, or system fonts).
- **Hierarchy:**
  - **H1:** Page Titles (e.g., "Trip Details", "Dashboard") - Bold, large, clear.
  - **H2:** Section Headers (e.g., "Journey & Destinations") - Semi-bold.
  - **Body:** Standard list and form text. Legibility over compactness.
  - **Monospace (Optional):** Use for strict identifiers like Payment IDs, GSTINs, or Bill Numbers for easy visual scanning.

### 2.2 Color Palette
Colors must convey operational context clearly and maintain high contrast.
- **Primary:** Brand color (e.g., Blue/Indigo). Used for primary buttons, active links, selected tabs.
- **Secondary:** Neutral grays for borders, secondary text, backgrounds, and disabled states.
- **Semantic Colors:**
  - **Success (Green):** Completed trips, settled bills, successful payments.
  - **Warning (Yellow/Orange):** Pending PODs, unsettled status, expiring documents.
  - **Danger/Destructive (Red):** Cancelled trips, payment reversals, deletion actions, errors.
  - **Info (Light Blue):** General informational badges or system notices.

## 3. Responsive Behavior

### 3.1 Mobile-Adaptive Approach
The UI must be fully functional on both Desktop and Mobile devices, acknowledging that drivers/staff may use mobile while on the road, while Owners/CAs heavily rely on desktop.

### 3.2 Layout Switching
- **Desktop (>= 1024px):** 
  - Persistent left sidebar for navigation.
  - Data-heavy views default to **Table View**.
  - Complex forms can utilize multi-column grids.
- **Tablet/Mobile (< 1024px):**
  - Navigation collapses into a Drawer (Hamburger menu) or bottom tab bar.
  - Data-heavy views must collapse into **Card View**. Horizontal scrolling tables should be avoided on mobile unless strictly necessary (e.g., specific financial reports).
  - Forms stack vertically into single columns.

## 4. UI Layout Patterns

### 4.1 Application Shell
- **Sidebar:** Grouped logically (Operations, Finance, Documents, Configuration). Highlights active route.
- **Header:** Contains Global Search input (prominent), User Profile dropdown, and Notification bell (if applicable).
- **Main Content Area:** A subtle off-white/light-gray background to make white data cards and tables pop out.

### 4.2 Data Lists (Table vs Card)
- **Table View (Desktop):** 
  - Sticky headers.
  - Right-aligned financial columns.
  - Action menus (ellipsis) on the far right.
- **Card View (Mobile & Desktop alternative):**
  - Information stacked hierarchically.
  - Primary identifier (e.g., Trip Number) bolded at the top left.
  - Status badge at the top right.
  - Key-value pairs for secondary data (Origin, Destination, Date).

### 4.3 Form Patterns
- **Input Types:** Strict use of HTML input types (`tel` for mobile numbers, `date` for dates) to trigger correct mobile keyboards.
- **Validation Feedback:** Inline red text below the specific input field. Red border on the input.
- **Save/Cancel:** Sticky bottom action bar on mobile; bottom-right aligned buttons on desktop forms.

## 5. Financial UI Formatting

Financial clarity is a strict requirement for SRL.
- **Currency Symbol:** Always display the Indian Rupee symbol (₹).
- **Number Format:** Must use the Indian numbering system (e.g., ₹ 1,50,000.00).
- **Alignment:** Financial values in tables must ALWAYS be right-aligned to allow visual decimal matching.
- **Color Coding:** 
  - Incoming/Receivable: Positive context (Default text color or subtle green).
  - Outgoing/Payable: Negative context (Default text color or subtle red).
- **Totals:** Summary rows in tables must be bolded and visually separated by a border.

## 6. Destructive & Sensitive Actions
- **Explicit Confirmation:** Any action that alters financial state (e.g., Reverse Payment, Reallocate Payment, Cancel Bill) must trigger a Modal Dialogue.
- **Modal Content:** Must clearly explain the consequence. (e.g., "Are you sure you want to reverse Payment ID 12345? This will alter outstanding balances.").
- **Input Confirmation:** For highly sensitive Owner actions, consider requiring the user to type "REVERSE" to confirm.

## 7. Global Search UI
- **Trigger:** Accessible anywhere from the top header (or a floating button on mobile).
- **Interface:** A command-palette style modal or a large dropdown attached to the search bar.
- **Results:** Categorized clearly with headers (Trips, Parties, Payments). Results show primary identifier and one line of context. Clicking navigates instantly.

## 8. Bill Designer Architecture UI
- **Scope:** Owner-only configuration view; Staff view is read-only template selection.
- **Pattern:** 
  - **Left Panel:** Configuration toggles (Enable TDS, Show Vehicle Owner, Change Numbering Series).
  - **Right Panel (Main):** A live visual preview (HTML/CSS representation) of what the PDF will look like.
- **Interactions:** Configuration changes immediately update the live preview without saving. Requires an explicit "Save Template" action.
- Staff generating bills merely see a dropdown to select a pre-configured template and a preview of the generated bill.
