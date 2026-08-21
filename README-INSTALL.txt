V64 STABLE FRIDAY FIX

The 2028 date / flashing happened because V63 repeatedly clicked NEXT while the
calendar was still rendering. It kept advancing again and again.

V64 removes that behavior completely.

Keep:
- V51 extra-case base
- V62 for one + beside each day and Existing/New patient

Replace V63 with V64.

V64:
- does NOT click Next repeatedly
- finds the Jump-to date field
- on Friday sets it ONCE to the coming Saturday
- dispatches the change ONCE
- no blank-page hiding

INSTALL
1. DELETE/REMOVE the V63 script line.
2. Upload js/clinic-v64-stable-friday.js
3. Replace app.html with included app.html
4. Ctrl+F5
