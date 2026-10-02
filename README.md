# MR Handbook

```markdown
# Project Specification: MR Handbook Manager

Create a complete, responsive Single-Page Web Application (SPA) named **MR Handbook Manager**. It serves as a secure, real-time portal for company handbooks, Standard Operating Procedures (SOPs), worker manuals, and audit logs. The app uses an interactive FAQ board, a dynamic table of contents, and granular Role-Based Access Control (RBAC) to restrict page elements and API permissions based on department and hierarchy level.

---

## 1. High-Level Goal
Build a secure Single-Page Application (SPA) where workers can view handbook articles and ask questions on a discussion board, and administrators can register users, compose handbook chapters in Markdown, manage navigation structures, track audit trails, and moderate the FAQ board.

---

## 2. Tech Stack Preferences
- **Core Frontend**: HTML5, Vanilla CSS3 (custom CSS variables, mobile-first responsive layout, and transitions), and JavaScript (ES6 Modules).
- **Libraries (via CDN)**:
  - `@supabase/supabase-js` (v2) for database interactions.
  - `marked.js` for compile-on-the-fly markdown parsing.
  - `dompurify` to sanitize HTML output and block XSS.
  - `lucide-icons` for the iconography system.
  - Google Font: `Inter` for clean visual typography.
- **Database**: Supabase PostgreSQL.
- **Environment Handling**: The Supabase client should pull credentials dynamically from inputs, integrations, or environment variables (`SUPABASE_URL` and `SUPABASE_ANON_KEY`). If the Supabase JS script fails to load (e.g. adblocker intervention), display a user-friendly top warning banner.

---

## 3. Architecture Overview
The application is structured as a client-side SPA that routes to different view panes dynamically by toggling CSS classes (e.g., `.hidden`):
1. **Auth View (`view-auth`)**: Sign In and Password Reset/Recovery forms.
2. **Workspace View (`view-workspace`)**: The core layout containing:
   - **Header**: Brand title, search bar, theme toggler (Light/Dark mode), and profile dropdown with view switcher options and logout.
   - **Left Sidebar**: Section and document tree, plus a link to the FAQ board.
   - **Content Area**: Dynamic views toggling between:
     - **Worker Handbook Viewer Pane**: Section > Document viewer with previous/next footer anchors and a sticky Table of Contents (TOC) right sidebar.
     - **FAQ Discussion Board Pane**: Thread lists and reply flows.
     - **Admin Dashboard & Settings Pane**: Tabs for Metrics/Reset, Worker Management, Section Management, Document Composer, and Audit Logs.
3. **Modals**: Worker Crud, Reset Password (Admin override), and Create FAQ Thread.

---

## 4. User Roles & Permissions
Implement a strict Role-Based Access Control hierarchy:

| Hierarchy Level | System Role | Department | Access Scope |
| :--- | :--- | :--- | :--- |
| **9** | `Director` | Management | Full administrative power across all departments. |
| **8** | `HR` | Management | Full administrative power across all departments. |
| **7** | `Administrative` | Management | Full administrative power across all departments. |
| **6** | `BOH Manager` | BOH | Admin dashboard access. Can only manage BOH employees (levels 0-4). |
| **5** | `FOH Manager` | FOH | Admin dashboard access. Can only manage FOH employees (levels 0-4). |
| **4** | `CDP` | BOH | Worker access. Viewing BOH & General SOPs, posting FAQs. |
| **3** | `SOUS` | BOH | Worker access. Viewing BOH & General SOPs, posting FAQs. |
| **2** | `BOH Crew` | BOH | Worker access. Viewing BOH & General SOPs, posting FAQs. |
| **1** | `Waiter` | FOH | Worker access. Viewing FOH & General SOPs, posting FAQs. |
| **0** | `Barista` | FOH | Worker access. Viewing FOH & General SOPs, posting FAQs. |

---

## 5. Data Models / Core Entities

Initialize the database using the following relational schema:

```sql
-- 1. Users Table
CREATE TABLE users (
    employee_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- SHA-256 hashed password
    department VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Active'
);

-- 2. Sections Table (Handbook Categories)
CREATE TABLE sections (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    order_num INTEGER NOT NULL,
    target_category VARCHAR(50) DEFAULT 'Both' NOT NULL -- 'BOH', 'FOH', or 'Both'
);

-- 3. Documents Table (Handbook Content)
CREATE TABLE documents (
    id VARCHAR(50) PRIMARY KEY,
    section_id VARCHAR(50) REFERENCES sections(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    order_num INTEGER NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. FAQ Threads Table
CREATE TABLE faq_threads (
    id VARCHAR(50) PRIMARY KEY,
    author_id VARCHAR(50) REFERENCES users(employee_id) ON DELETE SET NULL,
    author_name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    resolved BOOLEAN DEFAULT FALSE NOT NULL,
    pinned_reply_id VARCHAR(50)
);

-- 5. FAQ Replies Table
CREATE TABLE faq_replies (
    id VARCHAR(50) PRIMARY KEY,
    thread_id VARCHAR(50) REFERENCES faq_threads(id) ON DELETE CASCADE,
    author_id VARCHAR(50) REFERENCES users(employee_id) ON DELETE SET NULL,
    author_name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Audit Logs Table
CREATE TABLE audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    user_name VARCHAR(255),
    action TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

---

## 6. Core Business Rules

### Security & Password Protection
- **No Plaintext Passwords**: Passwords must be hashed using SHA-256 via the Web Cryptography API (`crypto.subtle.digest`) before sending to or validating against the database.
- **Recovery/Reset**: Workers reset forgotten passwords by providing their exact matching `email` and `employee_id` to establish a new password.
- **Active Status Check**: On every view/database transition, verify the user session is still logged in and their account status is `Active`. If their account status is set to `Disabled` or deleted, terminate their session immediately.

### Directory Visibility
- **Section Visibility**: Workers only see sections target-matched to their department. BOH department users see `BOH` and `Both` categories. FOH department users see `FOH` and `Both` categories. Management department users (`Director`, `HR`, `Administrative`) see all sections.

### Employee Management Hierarchy Check
- A user can only register, edit, or delete another user if:
  1. The actor is a Manager role (Levels 5-9).
  2. The target role level is strictly lower than the actor's level (`mLevel > tLevel`).
  3. The target user belongs to a department the manager oversees (Management can manage anyone; BOH Manager can only manage BOH employees; FOH Manager can only manage FOH employees).
- Users cannot delete their own account.

---

## 7. User Portal Requirements
- **Sidebar Navigation**: Clicking a sidebar section header expands a dropdown showing its documents. Clicking a document loads it into the main viewer.
- **Document Viewer**:
  - Displays Breadcrumbs (`Section Title > Document Title`).
  - Displays the last updated timestamp.
  - Runs a Table of Contents (TOC) side-panel that parses `h1`, `h2`, `h3` tags in the Markdown body. Clicking links smooth-scrolls to the heading. Implement a scroll listener to dynamically highlight the active heading link (scroll-spy).
  - Footer arrows allow navigating to the Previous or Next document sequence across the handbook.
  - A mobile floating button opens the TOC drawer when viewed on narrow screens.
- **Global Search**: Real-time keyword filter searching all document titles and body text. Matches must show dynamic matching snippets with keyword match highlighting using `<mark>` tags. Selecting a search result navigates directly to the target document.
- **Interactive FAQ Board**:
  - Workers can post new discussion threads.
  - Workers can reply to any active thread.
  - List filters search and narrow threads by title. Threads display indicators for resolved status, creation date, author name, and if they contain pinned replies.

---

## 8. Admin Portal Requirements
- **Dashboard Tab**:
  - Metric counters tracking Total Employees, Active Employees, Total Sections, Handbook Documents, and Unanswered FAQs.
  - Recent Administrative Actions Feed (displays the 5 latest audit logs).
  - **Reset System DB Button**: Triggers a clean wipe and resets the database back to standard seeds.
- **Worker Management Tab**:
  - Searchable list of employees showing metadata, status badges, and action menus.
  - Crud modal to Register or Edit worker accounts. Department selectors dynamically filter role options (e.g. selecting BOH limits the role picker to BOH-specific titles).
  - Admin Reset Password Modal allows quick manual override values.
- **Section Management Tab**:
  - List showing all sections.
  - Move Up and Move Down buttons adjust `order_num` directly in the database.
  - Form to Create, Edit, or Delete sections. Deleting sections cascades and deletes linked documents.
- **Handbook Document Tab**:
  - Left subbar to select a section and view its documents.
  - Create new document or adjust document order (Move Up/Down).
  - Compose editor form supporting: Title, Section selector, Raw Markdown Textarea, Markdown File Upload selector (`.md` parses and injects content into editor), Live Preview tab (renders output visually), and Publish Changes/Delete buttons.
- **Audit Logs Tab**:
  - Lists timestamps, users, and detailed actions performed. Refresh log button triggers updates.

---

## 9. UI / UX Guidelines
- **Color Themes**: Implement a design system built entirely on HSL color custom properties. Light mode uses soft slate/gray apps and white content containers. Dark mode overrides colors with dark slate colors (`#090d16` background, `#111827` cards) with bright contrasting texts.
- **Theme Switcher**: Instant theme toggle stored in `localStorage`.
- **Glassmorphic Elements**: Header blocks utilize transparent background colors (`rgba(255, 255, 255, 0.7)` / `rgba(17, 24, 39, 0.7)`) combined with backdrop filters (`blur(12px)`).
- **Responsive Layout**: Hide left sidebars and table fields cleanly on mobile. Use slide-out hamburger drawers to display navigation columns on small screens.
- **Animations**: Include micro-animations, slide-in toasts, and smooth layout fade transitions (`pane-fade`).

---

## 10. Database Seeds

Insert the following default users and data templates during database creation or resetting:

### Default Credentials (SHA-256 Hashed)
- **Director**: `director@company.com` | Password: `director123` | Employee ID: `DIR001`
- **HR**: `hr@company.com` | Password: `hr123` | Employee ID: `HR001`
- **Admin**: `admin@company.com` | Password: `admin123` | Employee ID: `ADM001`
- **BOH Manager**: `bohmanager@company.com` | Password: `bohmanager123` | Employee ID: `BOH001`
- **CDP**: `cdp@company.com` | Password: `cdp123` | Employee ID: `BOH002`
- **Sous**: `sous@company.com` | Password: `sous123` | Employee ID: `BOH003`
- **BOH Crew**: `bohcrew@company.com` | Password: `bohcrew123` | Employee ID: `BOH004`
- **FOH Manager**: `fohmanager@company.com` | Password: `fohmanager123` | Employee ID: `FOH001`
- **Waiter**: `waiter@company.com` | Password: `waiter123` | Employee ID: `FOH002`
- **Barista**: `barista@company.com` | Password: `barista123` | Employee ID: `FOH003`

### Default Sections & Documents
- Create sample sections: `Company Introduction` (Both), `Safety Guidelines` (Both), `Warehouse Procedures` (BOH), `HR Policies` (Both), `Emergency Procedures` (Both), `FOH Operations` (FOH).
- Seed document templates under each section detailing standard operating safety, PPE decibel zone criteria, PASS extinguisher procedures, evacuation routes, and customer service greeting standards.
```
***

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1e807a63-cf65-45b0-8013-1b9616743dc6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
