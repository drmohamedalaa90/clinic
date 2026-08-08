# Operation Clinic — Starter Frontend

This package contains the first working frontend for the Operation Clinic system.

## Included

- Supabase email/password login
- Arabic / English language switch
- RTL / LTR layout
- Responsive desktop and mobile design
- Role-based navigation
- Owner dashboard shell
- Doctor dashboard shell
- Technical-admin extra menu
- Supabase project already connected with the publishable browser key

## Structure

```text
operation-clinic/
├── index.html
├── app.html
├── css/
│   └── style.css
└── js/
    ├── supabase-client.js
    ├── auth.js
    └── app.js
```

## GitHub upload

1. Create a new GitHub repository.
2. Upload the CONTENTS of this folder to the repository root.
3. Keep `index.html` in the repository root.
4. If using GitHub Pages:
   - Repository → Settings → Pages
   - Deploy from branch
   - Select your main branch and `/ (root)`

## Supabase Auth URL settings

If you deploy to GitHub Pages or another host, add the deployed site URL in:

Supabase → Authentication → URL Configuration

Set your Site URL and add the deployed URL to Redirect URLs if required.

## Security

The file `js/supabase-client.js` contains only the Supabase publishable key. This is intended for browser use.

Never add a `service_role`, `sb_secret_...`, database password, or other server secret to this repository.
