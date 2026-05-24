---
marp: true
theme: default
class: lead
paginate: true
backgroundColor: #ffffff
---

# KENYATTA UNIVERSITY
## SCHOOL OF PURE & APPLIED SCIENCES
### DEPARTMENT OF COMPUTING & INFORMATION SCIENCE
#### SIT/SCO400: PROJECT

**KICOWASCO Integrated Wastewater Management System (WMIS)**

**Student:** Grant Muchina
**Registration:** [Insert Reg No]
**Supervisor:** [Supervisor Name]

---

# PROBLEM STATEMENT

**What problem are you solving?**
- Inefficient manual processes and lack of granular access control in tracking plant and field operations.
- The transition from a monolithic architecture to a secure, role-based structure to enforce clear operational responsibilities.

**Who is the beneficiary?**
- **KICOWASCO Staff:** From field-based attendants and operators to management-level superintendents and administrators.
- **Customers:** Benefit from improved service delivery and accountability.

---

# SOLUTION

**Briefly state the developed solution**
Developed a secure, role-based Progressive Web App (PWA) with distinct landing portals for various operational roles. The system enforces server-side Role-Based Access Control (RBAC) based on a unified organogram, provides offline-capable data-entry experiences for field and plant operations, and features real-time dashboards for management.

---

# PROJECT OBJECTIVES

1. **To integrate a role-based portal architecture** to ensure users only access dashboards, widgets, and actions pertinent to their operational responsibilities.
2. **To develop an offline-capable data-entry system** to allow seamless logging of field inspections and plant treatment logs.
3. **To integrate comprehensive tracking and reporting modules** (using tools like Chart.js and jsPDF) to improve operational transparency and decision-making.

---

# METHODOLOGY

**What software development methodology did you utilize and why?**
**Agile Methodology** 
- Facilitated iterative development and phased implementation (e.g., breaking down the UI transition into phases).
- Allowed for continuous review against project blueprints and immediate integration of feedback for complex RBAC and UI/UX features.

---

# SYSTEM DEVELOPMENT TOOLS

**What development tools did you utilise?**
- **React.js & React Router:** Frontend PWA development, responsive UI, and role-specific portal routing.
- **Django & Django REST Framework (DRF):** Backend logic, API development, and server-side RBAC enforcement.
- **PostgreSQL:** Robust relational database for managing users, roles, and operational logs.
- **Axios & SimpleJWT:** Secure API communication and token-based authentication.
- **Chart.js & jsPDF:** Data visualization and automated report generation.
- **LocalForage:** Managing offline data caching for field operations.

---

# CHALLENGES & SELF EVALUATION

**Technical Challenges & Handling:**
- *Challenge:* Enforcing granular Role-Based Access Control securely.
  *Handling:* Created a detailed permission matrix mapped to server-side DRF checks and unified frontend portal routes.
- *Challenge:* Network latency and Render's "cold start" delay.
  *Handling:* Implemented offline capabilities (LocalForage) and optimized UI loading states to ensure seamless data entry.

**Self Evaluation:**
- *To what extent were the objectives attained:* Objectives were successfully met; the system transitioned fully to a role-based portal architecture with offline support and comprehensive dashboarding ready for deployment.
