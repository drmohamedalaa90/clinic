# Operation Clinic — Tasks 13B–13F Combined Package

This package upgrades the starter frontend into the first operational clinic workflow.

## Included in this package

### Task 13B — Live dashboards + schedules
- Live owner/management dashboard counts
- Live doctor dashboard counts
- Doctor schedule management
- Weekly working hours
- Extra clinic / apology / vacation / blocked period / changed hours
- Doctor My Schedule page
- Doctor schedule-change requests and management approve/reject

### Task 13C — Patients
- Patient registry
- Search by name / MRN / mobile
- New patient form
- Patient profile
- Appointment history
- Clinical visits for authorized doctors
- Referrals for authorized doctors
- Billing tab for finance/reception roles
- Book directly from patient profile

### Task 13D — Booking + reception
- Real available slots from Supabase
- New/follow-up appointment booking
- Appointment day view
- Reception desk
- Confirm
- Check in
- Send to doctor
- No-show
- Cancel
- Reschedule

### Task 13E — Doctor queue + consultation
- Live waiting queue
- Start consultation
- Clinical visit workspace
- History / examination / diagnosis / plan / notes
- Vitals
- Structured diagnoses
- Investigation orders
- Prescription items
- Clinical document upload
- Refer patient
- Finalize visit
- Amendment after finalization
- Complete consultation

### Task 13F — Referrals + live notification drawer
- Incoming/outgoing referrals
- Routine/urgent referrals
- Accept / reject
- Start review
- Complete with specialist response
- Shared referred visit information
- Shared diagnoses / investigations / medications / documents
- Notification badge/drawer for referrals, waiting patients and schedule requests

---

# IMPORTANT — Run the SQL helper first

Before replacing the website files, open:

`sql/task-13b-13f-helper.sql`

Copy the entire file into:

**Supabase → SQL Editor → New query → Run**

The helper does two things:

1. Adds a safe `list_active_doctors()` function so the interface can populate doctor dropdowns without exposing role-management tables.
2. Adds stable `frontend_*` wrapper RPCs around the secure backend functions already created in earlier tasks.

It does not replace your existing RLS/security model.

---

# GitHub update

After the SQL helper succeeds:

1. Open your `clinic` GitHub repository.
2. Replace the old website files with the CONTENTS of this package.
3. Keep this structure at the repository root:

```text
clinic/
├── index.html
├── app.html
├── css/
│   └── style.css
├── js/
│   ├── supabase-client.js
│   ├── auth.js
│   ├── core.js
│   ├── dashboard.js
│   ├── schedules.js
│   ├── patients.js
│   ├── appointments.js
│   ├── clinical.js
│   ├── referrals.js
│   └── notifications.js
└── sql/
    └── task-13b-13f-helper.sql
```

4. Commit to `main`.
5. Wait for GitHub Pages to redeploy.
6. Hard refresh the site with **Ctrl + Shift + R**.

Your existing Supabase project URL and publishable key are already present in `js/supabase-client.js`.

---

# Recommended test order

### Test 1 — Dr Mohamed
- Login
- Dashboard values load
- My Schedule opens
- Referrals opens

### Test 2 — Owner
- Login
- Doctors' Schedules
- Add one working-hours rule for Dr Mohamed or Dr Ahmed
- Add an approved extra clinic or apology

### Test 3 — Reception/Secretary after that account is created
- Create patient
- Book appointment
- Confirm
- Check in
- Send to doctor

### Test 4 — Doctor
- Open My Queue
- Start consultation
- Save draft
- Add diagnosis
- Add investigation
- Add medication
- Finalize visit
- Complete consultation

### Test 5 — Referral
- Refer the finalized/open consultation to the other doctor
- Login as receiving doctor
- Accept → Start → Complete

---

# Security reminder

The browser package contains only the Supabase publishable key. Never place a `service_role`, `sb_secret_...`, database password, or other private server credential in GitHub/browser files.
