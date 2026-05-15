# ETrack 2.0

A full-stack web application for managing students in vocational and technical education programs. ETrack 2.0 is a complete rewrite and upgrade of an original C# WPF desktop application, rebuilt as a modern web platform with multi-user support, Canvas LMS integration, and a comprehensive test suite.

> **Live demo available** — see the [Demo Version](#demo-version) section below.

---

## Background

The original ETrack (v1) was a C# / WPF desktop application built for instructors at a vocational school to track student progress, log interactions, and manage student outcomes. It ran locally on a single machine, had no multi-user support, and no integration with external systems.

ETrack 2.0 reimplements the full feature set as a web application, adds real-time Canvas LMS integration, role-based access control, follow-up task management, and a comprehensive test suite covering unit, integration, and end-to-end scenarios.

---

## Features

### Student Management
- Add, edit, archive, graduate, and mark students inactive
- Search by name or Student ID
- Filter by status — active, inactive, graduated, archived
- Student detail pages with tabbed views: Interactions, Outcomes, Follow-ups, Contacts, Progress

### Reporting
- **On-Track Report** — pulls module completion data from Canvas LMS and shows each student's progress against their course deadline, streamed via Server-Sent Events
- **Inactive Report** — lists inactive students with last contact date, last Canvas activity, and contact attempt count
- **Export to .xlsx** — all reports and the student list can be exported to Excel

### Canvas LMS Integration
- Sync student progress and engagement data from Canvas
- Reflection Grader — view ungraded quiz reflections submitted via Canvas and submit Pass/Fail grades via the API
- Course filter — limit sync to specific course name prefixes to speed up reports

### Follow-up Tasks
- Create follow-up reminders linked to specific students with a due date and note
- Task list page with overdue indicators and a count badge in the sidebar nav
- Add follow-ups from the student detail page or the task list
- Mark complete, delete, and toggle completed history view

### Email Students
- Select students, choose a saved template, and preview the resolved content per student
- Template placeholders: `{FirstName}`, `{LastName}`, `{Course}`, `{Program}`, and more
- CC students' personal email on file, fix all-caps names automatically
- Send one-at-a-time mode with Open / Skip / Cancel controls

### Gameboard
- Visual hex-grid course map ported from the original WPF application
- Students appear on the board linked to their current course
- Scoped by program and catalog year with a dropdown selector

### Northstar Import
- Upload a Northstar XLSX export to preview and apply student data changes
- Preview shows new, updated, and no-change rows before committing
- Records last import timestamp with a weekly reminder indicator in the sidebar

### Multi-User Roles
| Role | Capabilities |
|---|---|
| **Admin** | Full access + user management, database backup/restore |
| **Instructor** | Full access to students, interactions, outcomes, follow-ups, email |
| **Observer** | Read-only — can view everything but cannot make any changes |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Server** | Node.js 18, Express 4 |
| **Database** | MySQL 8 with Sequelize ORM |
| **Authentication** | JWT (jsonwebtoken + bcryptjs) |
| **Client** | React 18, Vite, TypeScript |
| **Styling** | Tailwind CSS, shadcn/ui (Radix UI primitives) |
| **State management** | Zustand (auth), TanStack Query v5 (server state) |
| **Canvas API** | Axios with Server-Sent Events for streaming progress |
| **Import / Export** | SheetJS (xlsx) on both server and client |

---

## Testing

ETrack 2.0 has a three-layer test suite with 199 tests across unit, integration, and end-to-end scenarios.

### Server — Jest + Supertest (57 tests)
- **Unit tests** — `calcOnTrack` business logic, role middleware (`requireAdmin`, `requireWrite`) for all roles
- **API tests** — auth flows (login, registration lock, first-user-becomes-admin), student graduated filter, observer 403 enforcement, follow-up CRUD with student name join
- Uses **SQLite in-memory** for the test database — no MySQL required to run tests

### Client — Vitest + React Testing Library (18 tests)
- `useRole` hook — `canWrite`, `isAdmin`, `isObserver` for all three roles
- Observer UI restrictions — Add Student and Add Contact buttons hidden correctly
- `importAgeLabel` / `importIsOverdue` — label text and 7-day overdue threshold

### End-to-End — Cypress (124 tests)
Full browser automation across every major feature:

| Spec | What it covers |
|---|---|
| `auth.cy.js` | Login, logout, redirect, wrong credentials |
| `students.cy.js` | List, search, row click, filter toggles |
| `addStudent.cy.js` | Create student, cancel, validation |
| `interactions.cy.js` | Log interaction, tab navigation |
| `studentEdit.cy.js` | Edit and save student details |
| `contextMenu.cy.js` | Right-click → inactive, archive, graduate |
| `followups.cy.js` | Add, complete, hide/show toggle |
| `taskList.cy.js` | Task list page, add form, complete |
| `onTrack.cy.js` | Load report, export, filter |
| `reflectionGrader.cy.js` | Load submissions, select, Pass/Fail |
| `inactiveReport.cy.js` | Report loads, search, row click |
| `adminUsers.cy.js` | Create, role change, deactivate, delete |
| `observer.cy.js` | All observer restrictions in a real browser |
| `navigation.cy.js` | Every nav link without crashing (smoke) |
| `settings.cy.js` | Fields, save, DB backup admin-only |
| `emailPage.cy.js` | Student list, template, select, CC |
| `gameboard.cy.js` | Loads, SVG renders, program selector |
| `showGraduated.cy.js` | Filter toggles for all statuses |
| `studentSearch.cy.js` | Name search, SIS ID, case-insensitive |

```bash
# Run all server and client unit/integration tests
npm test

# Open Cypress interactive runner (requires app running on localhost)
npm run test:e2e:open

# Run Cypress headlessly
npm run test:e2e
```

---

## Demo Version

A demo version (`etrack-demo`) is included in this repository. It uses **SQLite** instead of MySQL — no database server setup needed. Demo data is seeded automatically on the first run.

**Demo credentials:**
| | |
|---|---|
| Email | `demo@etrack.app` |
| Password | `demo1234` |

**Pre-loaded demo data:**
- 20 students across 4 programs: IT Support, Cybersecurity, Web Development, Network Administration
- Interactions, outcomes, follow-ups, and Canvas progress records
- 4 email templates
- All Canvas features work without real credentials — On-Track report, Reflection Grader, and Canvas Sync all return realistic mock data

**Run the demo locally:**
```bash
cd etrack-demo
npm run install:all    # first time only
npm run dev
```

Open `http://localhost:5173` and log in with the credentials above.

---

## Getting Started (etrack-v2)

### Prerequisites
- Node.js 18+
- MySQL 8+

### Installation

```bash
# Install all dependencies (root, server, client)
npm run install:all

# Copy the environment template
cp server/.env.example server/.env
```

Edit `server/.env`:
```env
PORT=3002
JWT_SECRET=your-long-random-secret
DB_NAME=etrack
DB_USER=root
DB_PASS=yourpassword
DB_HOST=localhost
```

Create the database:
```bash
mysql -u root -p -e "CREATE DATABASE etrack;"
```

Start the development server:
```bash
npm run dev
```

The API runs on `http://localhost:3002` and the client on `http://localhost:5173`.

### First user

On a fresh database, the first registration automatically becomes **admin**:
```
http://localhost:5173/register
```

After that, only admins can create new accounts via **Settings → Users**.

---

## Project Structure

```
etrack-v2/
├── server/
│   ├── src/
│   │   ├── models/       Sequelize models (User, Student, Interaction, ...)
│   │   ├── routes/       REST API endpoints
│   │   ├── middleware/   JWT auth, requireAdmin, requireWrite
│   │   ├── services/     CanvasService (API calls, SSE streaming)
│   │   └── __tests__/    Jest unit + Supertest API tests
│   └── package.json
├── client/
│   ├── src/
│   │   ├── pages/        Route-level page components
│   │   ├── components/   Shared UI (tabs, panels, dialogs)
│   │   ├── hooks/        useRole, useFollowUps, useLastImport, useAppConfig
│   │   ├── store/        Zustand auth store
│   │   └── __tests__/    Vitest + React Testing Library
│   └── package.json
├── cypress/
│   ├── e2e/              19 Cypress spec files
│   └── support/
etrack-demo/              SQLite demo version with seed data
```

---

## License

MIT
