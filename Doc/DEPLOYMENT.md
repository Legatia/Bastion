# Deploying Bastion to Vercel 🚀

Great choice! Vercel is perfect for the Dashboard.

## Part 1: Prerequisites (The Database)
Since Vercel is "serverless", your local database won't work there. We need a cloud database.
1.  **Create a Vercel Postgres Storage**:
    *   Go to [Vercel Storage](https://vercel.com/dashboard/storage) -> Create Database -> Postgres.
    *   Select "Neon" (default).
    *   Copy the `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING`.

2.  **Update Backend**:
    *   Update your `backend/.env` with these new URLs.
    *   Run `npx prisma migrate deploy` locally to push your schema to the cloud.

## Part 2: Deploying the Dashboard (Frontend)
1.  **Push your code to GitHub** (if you haven't yet).
2.  Go to **Vercel Dashboard** -> **Add New...** -> **Project**.
3.  Import your Repository.
4.  **Root Directory**: Click "Edit" and select `dashboard`.
5.  **Environment Variables**:
    *   Add `NEXT_PUBLIC_BASTION_API_KEY` (use a random string for now).
    *   Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (your ID).
    *   Add `NEXT_PUBLIC_POLAR_LINK_STARTER` (your Polar links).
6.  Click **Deploy**.
    *   🎉 **Success!** You now have a URL like `https://bastion-dashboard.vercel.app`.
    *   **Action**: Go back to Polar and update your **Success URL** to this new link.

## Part 3: Deploying the Backend (API)
The backend is an Express app, which needs a slight tweak to run on Vercel Serverless.

1.  Create a `vercel.json` in the `backend/` folder:
    ```json
    {
      "rewrites": [{ "source": "/v1/(.*)", "destination": "/api/index.js" }]
    }
    ```
2.  Create a new Vercel Project for the Backend.
3.  **Root Directory**: Select `backend`.
4.  **Environment Variables**:
    *   `DATABASE_URL`: Your Vercel Postgres URL.
5.  Click **Deploy**.
    *   You will get a URL like `https://bastion-backend.vercel.app`.
    *   **Action**: Update your Dashboard's `NEXT_PUBLIC_API_URL` to point here.
