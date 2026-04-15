# Project Memory

## Core
- **Workdays Only:** App restricted strictly to Mon-Thu. Views and navigation omit Fri-Sun.
- **Modes:** PRESENT mode (readonly, active links). EDIT mode (drag & drop, checkboxes active).
- **Date Formatting:** Always use local timezone `format(date, 'yyyy-MM-dd')` via date-fns. NEVER use UTC `toISOString().split('T')[0]`.
- **Guest Statuses:** 'live' (Green), 'recorded' (Red), 'to_record' (Yellow), 'postponed' (Gray), 'proposed' (Blue). No bubbles, just bg opacity + border.
- **Security:** RLS on 'guests' table (producer/admin). Deletions use `count: exact` to confirm.

## Memories
- [Workdays restriction](mem://constraints/workdays-restriction) — App logic restricts scheduling and navigation strictly to Monday-Thursday
- [Pending recordings notifications](mem://features/notifications-pending-recordings) — Red banner/toast for today's pending recordings linking to Day view
- [Drag and drop behavior](mem://features/drag-and-drop-behavior) — @dnd-kit logic, week updates, and automatic slot swapping on drop
- [Navigation logo home](mem://features/navigation-logo-home) — Header logo links to current day or next Monday if weekend
- [Document storage](mem://features/document-storage-guest-info) — TEMA PRINCIPAL Word/PDF attachments via 1-hour signed URLs in guest-documents
- [Contact and social management](mem://features/contact-and-social-management) — Social links UI in Edit mode, platform dropdown, Twitter/IG standard fields
- [Month view layout](mem://features/month-view-layout-and-indicators) — Mon-Thu alignment, dynamic row height, past days 70% opacity, REC buttons
- [Guest confirmation checkboxes](mem://features/guest-confirmation-checkboxes) — 'CONFIRMADO BLU' and 'CONFIRMADO PR' boolean checkboxes, 'PROPUESTO' removed
- [Edit vs present modes](mem://features/edit-vs-present-modes) — Detailed restrictions for Presentation (readonly) vs Edit (interactive) modes
- [Calendar views logic](mem://features/calendar-views-logic) — Formatting and grid structures for Day, Week, and Month views
- [Guest status system](mem://features/guest-status-system) — Color coding and visual styles for all guest scheduling statuses
- [Guest position display](mem://features/guest-position-display) — Role/profession text positioning across Day, Week, and Month views
- [Clickable contact links](mem://features/clickable-contact-links-behavior) — ContactLink formats phone for WhatsApp and email for mailto, always clickable
- [Storage security](mem://architecture/storage-security-guest-documents) — 'guest-documents' bucket private RLS policies and signed URLs
- [n8n production webhook](mem://architecture/n8n-production-webhook-config) — Scraping webhook URL and secret configuration
- [AI action buttons](mem://features/ai-action-buttons-modules) — Sparkles AI button triggers n8n scraping with guest context and updates UI
- [n8n integration mechanics](mem://architecture/n8n-integration-mechanics) — n8n regex splitting into COYUNTURA, INFANCIA, CARRERA, CURIOSIDADES
- [Guest info modules](mem://features/guest-info-modules-day-view) — 4 collapsible markdown modules in Hour 1, DATOS CURIOSOS icon
- [H2/H3 info modules](mem://features/h2-h3-info-modules) — Slot 2: INFO PERSONAL + PREGUNTAS SUGERIDAS; Slot 3: DATOS PERSONALES + COMUNICADO PRENSA; each with doc/link/AI
- [Day view layout](mem://style/day-view-layout-organization) — Visual hierarchy for Hour 1 modules, contact info, and checkboxes
- [Recurring patterns](mem://project/program-recurring-patterns) — H1/H2 live, H3 recorded, fixed weekly sections (Puerta al Universo, #TBT)
- [Authentication flow](mem://auth/authentication-and-recovery-flow) — Supabase Auth, check-email-exists edge function for password reset
- [Database access control](mem://architecture/database-access-control) — RLS policies for producer/admin and count:exact verification for deletions
- [Program survey slot](mem://features/program-survey-slot) — Daily survey slot designated during 10 PM Hour 1 (Mon-Thu)
- [Guest card interaction](mem://features/guest-card-interaction-logic) — Stop propagation logic, edit modal activation constraints to prevent accidental opens
- [Global search](mem://features/global-search-mechanism) — 3+ char search for INVITADOS/PRENSA, dropdown and /search page
- [Guest deletion workflow](mem://features/guest-deletion-workflow) — AlertDialog, refetch sync to all views, ghost entry duplicate detection
- [Conditional scheduling fields](mem://features/conditional-scheduling-fields) — scheduled_date/time visibility rules based on guest status
- [Scheduled recording banners](mem://features/scheduled-recording-banners) — Red chronological banners on scheduled_date linking to broadcast slot
- [Undo redo system](mem://features/undo-redo-system) — Ctrl+Z/Y for up to 20 insert/update/delete operations with DB sync
- [Guest edit date preservation](mem://features/guest-edit-date-preservation) — Retains week_date/day_of_week/time_slot during edits to prevent shifts
- [Date formatting standardization](mem://architecture/date-formatting-standardization) — Requirements for local timezone date formatting
- [Day view headlines](mem://features/day-view-headlines-summary) — TITULARES summary section at top of Day view for all 3 hours
- [Guest notification system](mem://features/guest-notification-system) — Email/WhatsApp links for guest/press and planned n8n integration
- [Guest authorship and contact](mem://features/guest-authorship-and-contact-fields) — 'proposed_by' tracks creator via Supabase Auth, 'press_email' field usage
- [Guest relocation logic](mem://features/guest-relocation-logic) — Recording time vs broadcast slot independence, 16:00-19:00 conflict validation
- [Modal save workflow](mem://features/modal-save-workflow) — Async modal save prevents silent failures, stays open on error
- [Intelligent field autocompletion](mem://features/intelligent-field-autocompletion) — 3+ char autocomplete for Name/Press Guest filling fields safely
- [Edge functions security](mem://architecture/edge-functions-security-layer) — JWT, x-webhook-secret, Zod validation for n8n edge functions
