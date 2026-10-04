# Noir Scents

A full-stack luxury fragrance storefront for a Nigerian perfume brand. The app includes a React + Vite storefront, an Express API, and Supabase-ready schema and security policies.

## Tech stack

- Frontend: React + Vite + JavaScript
- Backend: Node.js + Express
- Database: Supabase PostgreSQL
- Auth: Supabase Auth with Google OAuth
- Email: Mailgun
- Deployment: Vercel frontend + Node.js hosting for backend

## How to Run Noir Scents Locally

The React/Vite frontend is in the project root and its source files are in `src`. There is no separate frontend folder. The `npm run dev` script starts both the Vite frontend and the Express API.

Open PowerShell and enter these commands **one at a time**, waiting for each command to finish before entering the next:

```powershell
cd "C:\Users\CEENATION\Noir_Scents"
npm install
npm run dev
```

After `npm run dev` starts, Vite should show a local URL such as `http://localhost:5173/`. Open that URL in your browser. The API runs at `http://localhost:4000`; Vite forwards `/api` requests to it.

The development servers keep running in the terminal. To stop them, click the terminal and press **Ctrl + C**.

If PowerShell says `node`, `npm`, or `npx` is not recognized, close and reopen PowerShell (and, if using VS Code's integrated terminal, restart VS Code) so the new terminal receives the updated Windows PATH. Then check:

```powershell
node -v
npm -v
npx -v
```

If Node works but PowerShell says `npm.ps1 cannot be loaded because running scripts is disabled`, allow signed scripts and local scripts for your Windows user only:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

This does not change the machine-wide policy. If PowerShell asks for confirmation, enter `Y`, then close and reopen the terminal.

If `npm install` reports an error, read the full error in the terminal before retrying. Do not delete `node_modules` or `package-lock.json` as a first step.

### Run frontend and API in separate terminals (optional)

If you prefer separate terminals, open two PowerShell windows. In each window, enter its commands one at a time:

Terminal 1 (Vite frontend):

```powershell
cd "C:\Users\CEENATION\Noir_Scents"
npm run dev:client
```

Terminal 2 (Express API):

```powershell
cd "C:\Users\CEENATION\Noir_Scents"
npm run dev:server
```

Press **Ctrl + C** in each terminal to stop its server.

### Optional service configuration

The API can start locally without a `.env` file, but Supabase, Google sign-in, and Mailgun require their own credentials. To configure those services, copy the example file using PowerShell:

```powershell
cd "C:\Users\CEENATION\Noir_Scents"
Copy-Item .env.example .env
```

Then add your private credentials to `.env`. Do not share or commit that file.

## Supabase setup

1. Create a Supabase project.
2. Apply the SQL in `database/schema.sql` from the Supabase SQL editor.
3. Run `database/auth_profile_trigger.sql` in Supabase SQL Editor. This creates/updates one `profiles` record per Auth user for email and Google sign-ups, and limits client profile updates so users cannot promote themselves to admin.
4. In the root `.env`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the browser client, and `SUPABASE_URL` and `SUPABASE_ANON_KEY` for the Express API. Use the Project URL and anon/publishable key from Supabase Project Settings > API; the URL and key must refer to the same project.
5. Never add a service-role key to a `VITE_` variable or expose it in browser code. This app's Google sign-in does not require a Google secret in `.env`.

## Google Authentication setup

### What I need to do in Google Cloud Console

1. In Google Cloud Console, select/create a project and open **APIs & Services > OAuth consent screen**. Configure the consent screen for your app and add test users if the app is still in testing.
2. Open **APIs & Services > Credentials > Create Credentials > OAuth client ID** and choose **Web application**.
3. Under **Authorized JavaScript origins**, add `http://localhost:5173`.
4. Under **Authorized redirect URIs**, add the Supabase callback. Find your exact **Project URL** in Supabase **Project Settings > API**; the redirect URI is that URL followed by `/auth/v1/callback` (for example, `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`). Do not use `http://localhost:5173/account` as Google's redirect URI.
5. Copy the generated Google Client ID and Client Secret into Supabase as described below. Do not put the client secret in this project's `.env` or frontend code.

### What I need to do in Supabase

1. Open **Authentication > Providers > Google**, enable Google, then enter the Google Client ID and Client Secret from Google Cloud Console and save.
2. Open **Authentication > URL Configuration**. Set the local **Site URL** to `http://localhost:5173` (if appropriate for your project) and add `http://localhost:5173/account` to the **Redirect URLs** allow-list. Add your real production account callback URL here too when deploying.
3. Run `database/auth_profile_trigger.sql` once in **SQL Editor** if the trigger has not already been installed. It uses the existing `profiles` table; it creates no duplicate user table.
4. In the project root, set the frontend and backend Supabase URL and anon/publishable-key variables in `.env`, as described in Supabase setup. No new OAuth environment variables are required.

### How to test Google Sign-In locally

1. In PowerShell, from `C:\Users\CEENATION\Noir_Scents`, run `npm run dev`.
2. Wait for Vite and the API to start, then open `http://localhost:5173/account`.
3. Choose **Continue with Google**, select your Google account, and approve access.
4. You should return to `/account` signed in. The account page shows the Google name, email, and avatar when provided. Use **Sign out** in the header to test logout; choose Google again to sign in.
5. If OAuth does not start, verify the Supabase Provider settings, Google callback URI, Supabase redirect allow-list, and the four Supabase environment values, then restart `npm run dev`.

Email/password sign-up and sign-in remain available on the same page. Supabase Auth manages the session and token persistence; the app does not manually store OAuth tokens.

## Mailgun setup

1. Create a Mailgun domain and API key.
2. Add `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, and `MAILGUN_FROM` to `.env`.
3. The server sends order-confirmation emails after checkout when configured.

## Product images

The Supabase `products` table already supports images through `cover_image` and `images`; no database migration is needed. The API exposes these as the product image and gallery used by the home page, shop, product details, cart, and checkout summary.

Products identified from supplied photographs are listed in `server/data.js`, and their Supabase upsert script is `database/seed_new_perfumes.sql`. The script adds the 14 image-backed perfumes to the existing products table and updates the existing Noir Scents Eclipse Noir image/size. If Supabase is configured, run the SQL in the Supabase SQL Editor. It uses the existing `sku`, `cover_image`, and `images` fields; it creates no new tables or columns.

The supplied product images are in `public/images/perfumes/` and are referenced by local paths such as `/images/perfumes/khamrah.jpg`. The sample catalog retains its existing products and uses an accessible “Image unavailable” fallback when a product has no image. The new `Oud de Arabia` entry explicitly marks the maker as unidentified because it is not legible in the supplied image.

Prices and stock counts for the new records are explicitly provisional. Confirm them in `server/data.js` for the local catalog and in Supabase before accepting live orders. The seed SQL marks them with the existing `tags` field (`temporary-price`, `temporary-stock`) and can be run again without duplicating products.

## Security notes

- Never expose the Supabase service role key in the browser.
- Keep the frontend only on the public anon key.
- Admin privileges must remain enforced in Supabase RLS, not just in the UI.
- The Express API is structured for secure server-side validation and transactional checkout logic.

## Deployment

- Deploy the frontend to Vercel.
- Deploy the backend to a Node.js host (Render, Railway, DigitalOcean App Platform, or similar).
- Set environment variables in the hosting provider and update public URLs accordingly.
