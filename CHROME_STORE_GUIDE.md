# Chrome Web Store Submission Guide

## Step 1: Create a Chrome Web Store Developer Account

1. **Go to Chrome Web Store Developer Dashboard**
   - Visit: https://chrome.google.com/webstore/devconsole
   - Sign in with your Google account

2. **Pay One-Time Registration Fee**
   - **Cost: $5 USD (one-time payment)**
   - This is required to publish extensions
   - Payment is processed through Google Pay

3. **Complete Developer Account Setup**
   - Accept the Developer Agreement
   - Complete payment
   - Your account will be activated immediately

## Step 2: Prepare Your Extension Package

### Build Production Version

```bash
npm run build
```

This creates the production build in `build/chrome-mv3-prod/`

### Create ZIP Package

```bash
# On macOS/Linux
cd build/chrome-mv3-prod
zip -r ../../promptprune-v1.0.0.zip .
cd ../..

# Or use the package command
npm run package
```

**Important:** The ZIP file should contain:
- `manifest.json`
- All JavaScript files
- All assets (icons, images)
- **NOT** include source files, node_modules, or build configs

## Step 3: Prepare Store Assets

### Required Assets

1. **Icons** (you already have these):
   - 128x128px: `assets/icon.png` ✅
   - 16x16px, 32x32px, 48x48px, 128x128px (Plasmo generates these)

2. **Screenshots** (required):
   - At least 1 screenshot (1280x800 or 640x400 recommended)
   - Maximum 5 screenshots
   - Show your extension in action

3. **Promotional Images** (optional but recommended):
   - Small promotional tile: 440x280px
   - Large promotional tile: 920x680px
   - Marquee promotional tile: 1400x560px

### Create Screenshots

Take screenshots of:
1. Main popup with token counting
2. Optimization in action
3. Savings calculator
4. Framework selector
5. History view

## Step 4: Write Store Listing

### Title
```
PromptPrune - AI Prompt Optimizer
```
(Max 45 characters)

### Short Description
```
Optimize AI prompts to reduce token usage and costs. 100% local, free, no setup required.
```
(Max 132 characters)

### Detailed Description
```
PromptPrune helps you optimize AI prompts to reduce token usage and lower costs across 12+ AI providers and 50+ models.

✨ Key Features:
• Real-time token counting for GPT-4, Claude, Gemini, and more
• Smart prompt optimization using proven frameworks (CoT, ToT, APE, RACE, ROSES, GUIDE, SMART)
• Cost savings calculator with transparent pricing
• Support for 12 AI providers: OpenAI, Anthropic, Google, Cohere, Mistral, Meta Llama, Groq, Perplexity, Together AI, Fireworks, Azure OpenAI, AWS Bedrock
• 100% local processing - your prompts never leave your device
• One-click copy optimized prompts
• Savings history tracking

🎯 Perfect For:
• Developers using AI APIs
• Content creators optimizing prompts
• Anyone looking to reduce AI costs
• Teams managing multiple AI models

🔒 Privacy First:
All processing happens locally in your browser. No data is sent to external servers. Your prompts stay private.

💡 How It Works:
1. Enter your AI prompt
2. View token counts across all major AI models
3. Apply optimization frameworks or use automatic optimization
4. See estimated cost savings
5. Copy the optimized prompt with one click

No setup required - works immediately after installation!
```

### Category
- **Primary:** Productivity
- **Secondary:** Developer Tools

### Language
- English (United States)

## Step 5: Privacy & Permissions

### Privacy Policy (Required)

You need a privacy policy URL. Options:

1. **Create a simple privacy policy page:**
   - Host on GitHub Pages (free)
   - Or use a service like PrivacyPolicyGenerator.com
   - Or add to your README and link to GitHub

**Sample Privacy Policy:**
```
PromptPrune Privacy Policy

Last Updated: [Date]

Data Collection:
- PromptPrune does NOT collect, store, or transmit any user data
- All processing happens locally in your browser
- No analytics, tracking, or external API calls
- Your prompts never leave your device

Storage:
- Uses Chrome's local storage API to save optimization history (stored locally on your device only)
- You can clear this data anytime through Chrome settings

Permissions:
- storage: Required to save optimization history locally
- host_permissions (localhost): Only used if you have Ollama installed locally (optional feature)

Contact:
- For questions, visit: [Your GitHub repo URL]
```

### Permissions Explanation

In your store listing, explain why you need:
- **Storage:** "To save your optimization history locally on your device"
- **Host permissions (localhost):** "Only used if you have Ollama installed for optional ML features"

## Step 6: Submit to Chrome Web Store

1. **Go to Developer Dashboard**
   - https://chrome.google.com/webstore/devconsole

2. **Click "New Item"**
   - Upload your ZIP file
   - Wait for upload to complete

3. **Fill in Store Listing**
   - Title
   - Description
   - Category
   - Language
   - Upload screenshots
   - Add promotional images (optional)

4. **Privacy & Compliance**
   - Add privacy policy URL
   - Answer compliance questions:
     - Does your extension handle user data? **No** (everything is local)
     - Does it use external APIs? **No** (except optional localhost for Ollama)
     - Does it collect personal information? **No**

5. **Distribution**
   - Choose visibility: **Public** (recommended) or **Unlisted**
   - Select regions: **All regions** (or specific ones)

6. **Submit for Review**
   - Review all information
   - Click "Submit for Review"

## Step 7: Review Process

### Timeline
- **Initial Review:** 1-3 business days
- **Updates:** Usually faster (few hours to 1 day)

### Common Rejection Reasons
- Missing privacy policy
- Unclear permission usage
- Poor screenshots/description
- Violation of Chrome Web Store policies

### If Rejected
- Read the feedback carefully
- Make requested changes
- Resubmit

## Step 8: After Approval

1. **Your extension goes live!**
2. **Monitor reviews and ratings**
3. **Update as needed:**
   - Update version in `package.json`
   - Rebuild and create new ZIP
   - Upload new version in developer dashboard

## Tips for Success

✅ **Do:**
- Write clear, honest descriptions
- Use high-quality screenshots
- Respond to user reviews
- Keep your extension updated
- Test thoroughly before submission

❌ **Don't:**
- Mislead about features
- Use copyrighted material without permission
- Violate user privacy
- Submit incomplete extensions

## Cost Summary

- **Developer Account:** $5 USD (one-time)
- **Extension Listing:** FREE
- **Updates:** FREE
- **Total Cost:** $5 USD one-time

## Quick Checklist

- [ ] Developer account created ($5 paid)
- [ ] Production build created (`npm run build`)
- [ ] ZIP package created
- [ ] Screenshots prepared (at least 1, up to 5)
- [ ] Privacy policy URL ready
- [ ] Store listing written
- [ ] Extension tested thoroughly
- [ ] Ready to submit!

## Need Help?

- Chrome Web Store Policies: https://developer.chrome.com/docs/webstore/program-policies/
- Developer Support: https://support.google.com/chrome_webstore/contact/developer_support
- Community Forum: https://groups.google.com/a/chromium.org/g/chromium-extensions

Good luck with your submission! 🚀

