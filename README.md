# Inch Solar Development - Objection Letter Generator

Automatically generates personalized planning objection letters using Claude AI.

## One-Click Deploy to Vercel

Click this button to deploy (no installation needed):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/inch-solar-generator&env=ANTHROPIC_API_KEY&envDescription=Your%20Anthropic%20API%20key&envLink=https://console.anthropic.com/account/keys&project-name=inch-solar-generator&repository-name=inch-solar-generator)

## What This Does

- Receives form submissions from Tally
- Generates personalized 500-700 word objection letters
- Follows Cork County Council format
- Includes verified community research
- Each letter is unique

## After Deployment

1. Copy your function URL: `https://your-project.vercel.app/api/generate-letter`
2. Add it as a webhook in your Tally form
3. Test by submitting the form

## Environment Variables Needed

When you click Deploy, Vercel will ask for:

- **ANTHROPIC_API_KEY**: Your Claude API key from anthropic.com

## Manual Deployment

If the button doesn't work, follow these steps:

1. Fork this repository
2. Import it to Vercel
3. Add environment variables
4. Deploy

## Updating Committee Research

Edit `api/generate-letter.js` and find the `COMMITTEE_RESEARCH` object to update facts.

## Version

v0.2 (Draft) - December 10, 2024
