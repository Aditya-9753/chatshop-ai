# Production Deployment Guide

## 🚀 Deploy to Production in 1 Hour

### Prerequisites

- GitHub account
- Vercel account (for frontend)
- Heroku/Railway account (for backend)
- MongoDB Atlas account (free tier)
- Domain name (optional)

---

## Part 1: Database Setup (10 minutes)

### MongoDB Atlas

1. **Create Account**

   - Go to https://cloud.mongodb.com
   - Sign up for free tier

2. **Create Cluster**

   - Choose Free Tier (M0)
   - Select region closest to your users
   - Cluster name: `chatshop-prod`

3. **Database Access**

   - Database Access → Add New User
   - Username: `chatshop-admin`
   - Password: Generate secure password (save it!)
   - Role: `Read and write to any database`

4. **Network Access**

   - Network Access → Add IP Address
   - Allow Access from Anywhere: `0.0.0.0/0` (for now)
   - Or add specific IPs later

5. **Get Connection String**
   - Click "Connect" → "Connect your application"
   - Copy connection string:
   ```
   mongodb+srv://chatshop-admin:<password>@cluster0.xxxxx.mongodb.net/whatsapp-automation?retryWrites=true&w=majority
   ```
   - Replace `<password>` with your actual password

---

## Part 2: Backend Deployment (15 minutes)

### Option A: Deploy to Railway (Recommended)

1. **Create Account**

   - Go to https://railway.app
   - Sign in with GitHub

2. **Create New Project**

   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Authorize Railway
   - Select your repository
   - Select `backend` folder as root directory

3. **Add Environment Variables**

   - Click on your service → Variables
   - Add these variables:

   ```env
   MONGODB_URI=<your-mongodb-atlas-connection-string>
   JWT_SECRET=<generate-random-64-character-string>
   PORT=5000
   NODE_ENV=production
   FRONTEND_URL=https://yourdomain.vercel.app

   # Optional: Email
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password

   # Optional: Razorpay
   RAZORPAY_KEY_ID=your-razorpay-key
   RAZORPAY_KEY_SECRET=your-razorpay-secret
   ```

4. **Deploy**

   - Railway will auto-deploy
   - Note your backend URL: `https://your-project.railway.app`

5. **Create Admin User**
   - The default admin will be created automatically
   - Or use MongoDB Compass to manually create

### Option B: Deploy to Heroku

1. **Install Heroku CLI**

   ```bash
   # Windows (PowerShell as Admin)
   choco install heroku-cli

   # Or download from heroku.com/cli
   ```

2. **Login and Create App**

   ```bash
   cd backend
   heroku login
   heroku create chatshop-backend
   ```

3. **Set Environment Variables**

   ```bash
   heroku config:set MONGODB_URI="your-connection-string"
   heroku config:set JWT_SECRET="your-secret"
   heroku config:set NODE_ENV=production
   heroku config:set FRONTEND_URL="https://yourdomain.vercel.app"
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

---

## Part 3: Frontend Deployment (10 minutes)

### Deploy to Vercel (Recommended)

1. **Create Account**

   - Go to https://vercel.com
   - Sign in with GitHub

2. **Import Project**

   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Root Directory: `frontend`
   - Framework Preset: Vite

3. **Configure Build Settings**

   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Add Environment Variables**

   - Environment Variables section
   - Add:

   ```env
   VITE_API_URL=https://your-backend.railway.app/api
   ```

5. **Deploy**

   - Click "Deploy"
   - Wait 2-3 minutes
   - Note your URL: `https://chatshop.vercel.app`

6. **Update Backend CORS**
   - Go back to Railway/Heroku
   - Update `FRONTEND_URL` to your Vercel URL
   - Redeploy backend

### Option B: Deploy to Netlify

1. **Create Account**

   - Go to https://netlify.com
   - Sign in with GitHub

2. **Add New Site**

   - Sites → Add New Site → Import from Git
   - Select repository
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`

3. **Environment Variables**

   - Site settings → Build & deploy → Environment
   - Add:

   ```env
   VITE_API_URL=https://your-backend.railway.app/api
   ```

4. **Deploy**
   - Trigger deploy
   - Get your URL: `https://chatshop.netlify.app`

---

## Part 4: Custom Domain Setup (15 minutes)

### For Vercel Frontend

1. **Add Domain**

   - Project Settings → Domains
   - Add `yourdomain.com` and `www.yourdomain.com`

2. **DNS Configuration**

   - Go to your domain registrar (GoDaddy, Namecheap, etc.)
   - Add these DNS records:

   ```
   Type: A
   Name: @
   Value: 76.76.21.21

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

3. **Wait for SSL**
   - Vercel auto-generates SSL certificate
   - Takes 5-10 minutes

### For Railway Backend

1. **Custom Domain**

   - Railway Project → Settings → Custom Domain
   - Add: `api.yourdomain.com`

2. **DNS Configuration**

   ```
   Type: CNAME
   Name: api
   Value: your-project.railway.app
   ```

3. **Update Frontend**
   - Update Vercel environment variable:
   ```env
   VITE_API_URL=https://api.yourdomain.com/api
   ```
   - Redeploy frontend

---

## Part 5: Post-Deployment Checklist (10 minutes)

### ✅ Test Everything

1. **Authentication**

   - [ ] Register new user
   - [ ] Login works
   - [ ] Logout works
   - [ ] Protected routes redirect

2. **CRUD Operations**

   - [ ] Create customer
   - [ ] Edit customer
   - [ ] Delete customer
   - [ ] Same for products and orders

3. **Data Persistence**

   - [ ] Refresh page → data still there
   - [ ] Logout → Login → data persists

4. **API Endpoints**

   - [ ] All CRUD endpoints working
   - [ ] Error handling works
   - [ ] 401 redirects to login

5. **UI/UX**
   - [ ] Toast notifications show
   - [ ] Loading states appear
   - [ ] Mobile responsive
   - [ ] No console errors

### 🔒 Security Hardening

1. **Environment Variables**

   - [ ] No secrets in code
   - [ ] All sensitive data in env vars
   - [ ] .env files not committed to git

2. **Database**

   - [ ] MongoDB user has limited permissions
   - [ ] Network access restricted (optional)
   - [ ] Backups enabled

3. **CORS**

   - [ ] Only production frontend URL allowed
   - [ ] No `*` wildcard in production

4. **Rate Limiting** (Optional)

   ```javascript
   // backend/src/app.js
   const rateLimit = require("express-rate-limit");

   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100, // limit each IP to 100 requests per windowMs
   });

   app.use("/api/", limiter);
   ```

### 📊 Monitoring Setup

1. **Error Tracking (Sentry)**

   ```bash
   cd backend
   npm install @sentry/node
   ```

   ```javascript
   // backend/src/app.js
   const Sentry = require("@sentry/node");

   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
   });
   ```

2. **Uptime Monitoring**

   - Use UptimeRobot (free)
   - Monitor: `https://api.yourdomain.com/health`
   - Alert via email if down

3. **Analytics**
   - Google Analytics for frontend
   - Track user behavior
   - Monitor conversion rates

---

## Production URLs

After deployment, you'll have:

- **Frontend:** https://chatshop.vercel.app (or your custom domain)
- **Backend API:** https://your-project.railway.app (or api.yourdomain.com)
- **Database:** MongoDB Atlas cluster

### Share These Credentials for Demo

```
Demo Account:
Email: demo@chatshopai.com
Password: Demo@12345

Admin Account:
Email: admin@chatshopai.com
Password: Admin@123456
```

---

## Troubleshooting

### Issue: Frontend can't connect to backend

**Solution:** Check CORS settings in backend, verify VITE_API_URL

### Issue: Database connection failed

**Solution:** Check MongoDB connection string, verify network access in Atlas

### Issue: Build failed

**Solution:** Check build logs, ensure all dependencies in package.json

### Issue: Environment variables not working

**Solution:** Restart deployment, check variable names match code

### Issue: 404 on routes

**Solution:** Add `vercel.json` for SPA routing:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

## Rollback Plan

If something goes wrong:

1. **Revert Frontend**

   - Vercel → Deployments → Previous deployment → Promote to Production

2. **Revert Backend**

   - Railway → Deployments → Previous deployment → Redeploy
   - Or: `git revert <commit-hash>` and push

3. **Database Backup**
   - MongoDB Atlas → Backups → Restore to point in time

---

## Cost Breakdown (Monthly)

- **Vercel:** $0 (Hobby plan, 100GB bandwidth)
- **Railway:** $5 (if usage > free tier)
- **MongoDB Atlas:** $0 (M0 free tier, 512MB storage)
- **Domain:** $10-15/year
- **Total:** ~$5-10/month

### Free Tier Limits

- Vercel: 100GB bandwidth, unlimited projects
- Railway: $5 free credit/month
- MongoDB Atlas: 512MB storage, shared CPU

---

## Next Steps After Deployment

1. **Day 1-2:** Monitor error logs, fix critical bugs
2. **Day 3-5:** Collect user feedback, add requested features
3. **Week 2:** Implement WhatsApp/Instagram real APIs
4. **Week 3:** Add AI chatbot responses
5. **Week 4:** Scale based on user growth

---

## 🎉 Congratulations!

Your WhatsApp & Instagram automation platform is now LIVE! 🚀

**Marketing Tips:**

- Share on LinkedIn, Twitter, ProductHunt
- Create demo video
- Write blog post about the project
- Reach out to potential users
- Collect testimonials

**Support Resources:**

- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- MongoDB Atlas Docs: https://docs.atlas.mongodb.com

Good luck with your launch! 🎊
