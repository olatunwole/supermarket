# Supermarket Inventory & POS System Project Rules

All changes, extensions, or refactoring on this codebase must adhere strictly to these architectural constraints:

## 1. Financial Transactions & Manual Currency Converter
- **GBP Base Currency**: The backend and database store all costs, retail prices, total sales, and financials strictly in **GBP (£)**.
- **Conversion Calculations**:
  - Always multiply GBP values by active manual exchange rates (`rates[currency]`) for display/receipt printing.
  - Convert any cashier inputs (e.g., cart or line-item discounts entered in active currency) *back* to GBP by dividing by the active exchange rate (`val / rates[currency]`) before sending payloads to the backend API.
- **Dynamic Price Labels**: Numeric input fields and table columns for prices must display dynamic currency labels (e.g. `Cost Price (NGN)`) reflecting the user's active currency.

## 2. Dynamic Color Preset Swatches
- **Accent Color Variables**: Swatch color selection changes `--accent-cyan`, `--accent-cyan-hover`, and `--accent-cyan-glow` custom CSS properties on `document.documentElement` dynamically.
- **Background Glow Colors**: Swatch colors also set the `--background-glow-1` and `--background-glow-2` variables, allowing the page's radial background gradient glow to match the selected theme color profile (rose, emerald, indigo, orange, etc.).
- **Transparent Layout Panels**: Never hardcode background colors on layout wrappers (such as `aside` in `Sidebar.tsx` or `header` in `Header.tsx`). They must resolve to `--bg-secondary` and `--glass-bg` so they adapt immediately to theme switches.

## 3. Custom Logo Uploads (Base64)
- **Base64 Storage**: Store settings custom logo is read via `FileReader` as a Data URL (base64 string) and saved inside `localStorage` under `pos_store_settings`.
- **Dynamic Render**: If `storeSettings.logo` is set, render the logo image on the login page card, sidebar branding header, and at the top of POS receipts.
- **Receipt Greyscale**: Receipts are optimized for thermal POS printers. Render the logo in monochrome using `filter: grayscale(100%) contrast(200%)`.

## 4. Terminal Inactivity timeouts
- **Session Lockouts**: Monitor user activity events (`mousemove`, `keydown`, `mousedown`, `touchstart`, `scroll`) globally inside `AuthContext.tsx`.
- **Reset Logic**: Reset the logout timer upon activity. If no events occur for the duration defined in `storeSettings.inactivityTimeout` (in minutes), automatically trigger `logout()` and show an idle notification warning.

## 5. Security & Modular Staff Management
- **Self-Service Passwords**: General users are allowed to change their passwords via `/api/auth/change-password` routes. The username is audit-locked and cannot be modified.
- **Modular Pages**: Keep "Staff Users" registry accounts management on its own administrative page `/users` and separate from "Settings" which is for system configuration.

## 6. Local Git & Environment Constraints
- **Root Gitignore Protection**: Always maintain a `.gitignore` at the root directory level. Never track local database directories (`pg-data/`), portable database binaries (`pg-env/`), or node environments (`node-env/`, `node_modules/`).
- **Non-Admin Git Installer**: If Git is missing on Windows, use `winget install --id Git.MinGit -e` to download the portable/zip-based version. Avoid standard installers to bypass UAC administrator privilege prompts.
- **Terminal PATH Refresh**: When executing commands immediately after package installations, prefix shell commands with `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")` to ensure recently added binary directories are registered in the current terminal instance.

