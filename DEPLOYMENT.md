# INCH SOLAR OBJECTION GENERATOR - DEPLOYMENT GUIDE

## What This Does
Automatically generates personalized planning objection letters for the Inch Solar Development using Claude AI, incorporating committee research and individual concerns.

## Files Created
1. `api/generate-letter.js` - Main serverless function
2. `package.json` - Node.js configuration
3. `vercel.json` - Vercel deployment settings
4. `DEPLOYMENT.md` - This file

---

## STEP-BY-STEP DEPLOYMENT TO VERCEL

### STEP 1: Create Vercel Account
1. Go to: https://vercel.com/signup
2. Click "Continue with Email" or use GitHub/GitLab
3. Verify your email
4. You'll land on the Vercel dashboard

### STEP 2: Download the Project Files
1. Download all 3 files from Claude:
   - `api/generate-letter.js`
   - `package.json`
   - `vercel.json`

2. Create a folder on your computer called: `inch-solar-function`

3. Inside that folder, create a subfolder called: `api`

4. Place files like this:
   ```
   inch-solar-function/
   ├── api/
   │   └── generate-letter.js
   ├── package.json
   └── vercel.json
   ```

### STEP 3: Deploy to Vercel

**Option A: Using Vercel CLI (Recommended)**

1. Install Vercel CLI:
   - Open Terminal (Mac) or Command Prompt (Windows)
   - Run: `npm install -g vercel`
   
2. Navigate to your project folder:
   ```bash
   cd path/to/inch-solar-function
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Follow prompts:
   - "Set up and deploy"? → YES
   - "Which scope"? → Your account
   - "Link to existing project"? → NO
   - "Project name"? → inch-solar-generator (or whatever you want)
   - "In which directory is your code"? → ./ (current directory)
   - "Want to modify settings"? → NO

5. Vercel will deploy and give you a URL like:
   ```
   https://inch-solar-generator.vercel.app
   ```

**Option B: Using Vercel Web Interface**

1. In Vercel dashboard, click "Add New..." → "Project"
2. Click "Deploy" or "Import Git Repository"
3. If you don't use Git, upload the folder directly
4. Vercel will detect it's a Node.js project
5. Click "Deploy"

### STEP 4: Add Environment Variables

After deployment, you need to add your API keys:

1. In Vercel dashboard, click on your project
2. Click "Settings" tab
3. Click "Environment Variables" in left sidebar
4. Add these variables:

**Variable 1:**
- Key: `ANTHROPIC_API_KEY`
- Value: `[PASTE YOUR ANTHROPIC API KEY HERE]`
- Environment: Production, Preview, Development (check all)
- Click "Save"

**Variable 2: (Optional - for email later)**
- Key: `GMAIL_APP_PASSWORD`
- Value: `[PASTE YOUR 16-CHARACTER GMAIL APP PASSWORD]`
- Environment: Production, Preview, Development
- Click "Save"

**Variable 3: (Optional)**
- Key: `GMAIL_USER`
- Value: `inchsolaraction@gmail.com`
- Environment: All
- Click "Save"

5. After adding variables, click "Redeploy" to apply them

### STEP 5: Get Your Function URL

Your function will be available at:
```
https://your-project-name.vercel.app/api/generate-letter
```

Example:
```
https://inch-solar-generator.vercel.app/api/generate-letter
```

**Copy this URL - you'll need it for Tally!**

### STEP 6: Connect Tally Form to Your Function

1. Go to your Tally form: https://tally.so/r/nPaO2V
2. Click "..." menu → "Settings"
3. Click "Integrations" tab
4. Scroll to "Webhooks"
5. Click "Add webhook"
6. **Webhook URL:** Paste your Vercel function URL:
   ```
   https://your-project-name.vercel.app/api/generate-letter
   ```
7. **Events:** Select "Form submitted" or "New response"
8. Click "Save"

### STEP 7: Test It!

1. Go to your Tally form
2. Fill it out with test data
3. Submit it
4. Check Vercel logs:
   - Go to Vercel dashboard
   - Click your project
   - Click "Functions" tab
   - Click on `generate-letter`
   - You should see logs showing the letter generation

---

## TROUBLESHOOTING

### Error: "ANTHROPIC_API_KEY not configured"
- Go to Vercel → Settings → Environment Variables
- Make sure you added `ANTHROPIC_API_KEY`
- Click "Redeploy" after adding it

### Error: "Function timeout"
- This shouldn't happen (60 second limit)
- Check Vercel logs for details

### Error: "Invalid request"
- Check that Tally field names match the code
- Look at Vercel function logs for details

### Can't find the function URL
- Format is always: `https://[project-name].vercel.app/api/[filename-without-.js]`
- Example: `https://inch-solar-generator.vercel.app/api/generate-letter`

### Tally webhook not firing
- Check webhook is enabled in Tally
- Verify the URL is correct (must be full URL with https://)
- Check "Events" is set to "Form submitted"

---

## UPDATING THE CODE LATER

### To Update Committee Research:

1. Go to Vercel dashboard
2. Click your project
3. Click "Source" or "Files"
4. Find `api/generate-letter.js`
5. Click "Edit"
6. Find the `COMMITTEE_RESEARCH` section (lines 10-50)
7. Update the facts
8. Click "Save"
9. Vercel will auto-redeploy (takes 30 seconds)

### To Add New Tally Fields:

1. Add the field to your Tally form
2. Edit `api/generate-letter.js`
3. Find the section that extracts form data (around line 110)
4. Add a new line like:
   ```javascript
   new_field_name: cleanText(formData.new_field_name || ''),
   ```
5. Add it to the prompt building section
6. Save and redeploy

---

## MONITORING & LOGS

### View Function Logs:
1. Vercel Dashboard → Your Project
2. Click "Functions" tab
3. Click on `generate-letter`
4. See real-time logs of every execution

### Check How Many Letters Generated:
- Vercel shows execution count
- Each form submission = 1 execution

### Costs:
- Vercel: FREE (generous free tier)
- Anthropic API: ~$0.003-0.015 per letter
- Very affordable even with hundreds of submissions

---

## NEXT STEPS (OPTIONAL)

### Phase 2: Add Email Sending
Currently the function generates letters but doesn't send emails. To add this:
1. Sign up for Resend (https://resend.com) - free tier
2. Get API key
3. Add to Vercel environment variables
4. Update code to actually send emails (I can provide updated code)

### Phase 3: Add Google Drive Saving
To save letters to Drive:
1. Set up Google Cloud Project
2. Enable Drive API
3. Create service account
4. Add credentials to Vercel
5. Update code (I can provide this)

### Phase 4: Add Google Sheets Logging
Log each submission to a spreadsheet for tracking

---

## SUPPORT

If you get stuck:
1. Check Vercel function logs (most errors show there)
2. Test the function directly using a tool like Postman
3. Message me with the specific error and I'll help debug

---

## VERSION TRACKING

Current version: 0.2 (DRAFT)
Last updated: December 10, 2024
Committee research status: Draft - awaiting verification

When you verify facts, just edit the COMMITTEE_RESEARCH section and save!
