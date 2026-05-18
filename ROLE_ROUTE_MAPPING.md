Role → Route Mapping

This file maps each confirmed role to a tailored portal landing route, default navigation tabs, and primary widgets.

stp_superintendent (Grade 3)
- Landing route: /portal/superintendent
- Default nav tabs: Executive Dashboard, Monthly Summary, Exceptions & Alerts, Compliance & Trends, Staffing
- Primary widgets: KPI tiles (effluent quality, uptime, incidents by severity), Pending Approvals, Monthly lock control, Compliance flags
- Drill-downs: KPI → read-only incident/log details (contextual view only)

stp_supervisor (Grade 4)
- Landing route: /portal/supervisor
- Default nav tabs: Plant Dashboard, Treatment Logs (review), Lab Results (trends), Pending Approvals, Monthly Drafts
- Primary widgets: Pending verifications, KPI sparkline, unresolved alerts, team status

lab_tech (Grade 4)
- Landing route: /portal/lab
- Default nav tabs: Lab Tests (create/verify), Treatment Logs (read/verify), Attachments, Reports
- Primary widgets: Samples pending, abnormal result alerts, verification queue

stp_operator (Grade 5)
- Landing route: /portal/operator
- Default nav tabs: Treatment Logs (create/edit/submit), Flow Records, Sludge Manifest, Inlet Works, Alerts
- Primary widgets: Live plant metrics, open work orders, lab flags needing action

stp_attendant (Grade 6)
- Landing route: /portal/attendant
- Default nav tabs: Treatment Logs (drafts), Pond Maintenance, Sludge Manifest (receipt entry), Profile
- Primary widgets: Task checklist, recent operator notes, quick photo upload

line_supervisor (Grade 4)
- Landing route: /portal/line-supervisor
- Default nav tabs: Dispatch (assign/reassign), Incidence (review/all), Repairs (approve), Inspection Log, Team
- Primary widgets: Team workload tiles, pending approvals, map/list of open incidents

line_attendant (plumber, Grade 6)
- Landing route: /portal/field
- Default nav tabs: Incidence (create), Repairs (create/update), Dispatch (my assignments), Sewer Connections, Profile
- Primary widgets: Assigned tasks list, quick "Report Incident" button, today’s schedule

admin (System Administrator)
- Landing route: /portal/admin
- Default nav tabs: User Management, Roles & Permissions, System Settings, Audit Logs, Exports
- Primary widgets: System health, pending user requests, audit log quick view

Notes
- Executive and admin portals are management-focused; operational tabs (Incidence, Repair creation screens) are not exposed in top-level navs. Executives drill down into day-to-day evidence from KPI or alert cards when necessary.
- Routes should be implemented as distinct landing routes (not just hidden tabs) to keep the UX focused per role.