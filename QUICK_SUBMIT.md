# Quick Start: Submit to Chrome Web Store

## 🚀 Fast Track (5 Steps)

### 1. Create Developer Account ($5 one-time)
- Go to: https://chrome.google.com/webstore/devconsole
- Pay $5 registration fee
- Takes 5 minutes

### 2. Package Your Extension
```bash
# Build production version
npm run build

# Create ZIP (already done for you!)
# File: promptprune-v1.0.0.zip
```

### 3. Prepare Screenshots
Take 1-5 screenshots of your extension:
- Main popup showing token counts
- Optimization in action
- Savings calculator
- Framework selector

**Recommended size:** 1280x800 or 640x400 pixels

### 4. Create Privacy Policy
Create a simple page (GitHub Pages, or use PrivacyPolicyGenerator.com):

```
PromptPrune Privacy Policy

Data Collection: NONE
- All processing happens locally in your browser
- No data collected, stored, or transmitted
- Your prompts never leave your device

Storage: Local only
- Uses Chrome's local storage (on your device only)
- You can clear anytime through Chrome settings

Permissions:
- storage: For saving optimization history locally
- localhost: Only if you use optional Ollama feature

Contact: [Your GitHub repo]
```

### 5. Submit!
1. Go to: https://chrome.google.com/webstore/devconsole
2. Click "New Item"
3. Upload: `promptprune-v1.0.0.zip`
4. Fill in:
   - **Title:** PromptPrune - AI Prompt Optimizer
   - **Description:** (see CHROME_STORE_GUIDE.md)
   - **Category:** Productivity
   - **Screenshots:** Upload your screenshots
   - **Privacy Policy:** Your privacy policy URL
5. Click "Submit for Review"

## 📋 Store Listing Copy-Paste

### Short Description (132 chars max)
```
Optimize AI prompts to reduce token usage and costs. 100% local, free, no setup required.
```

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

## ✅ Pre-Submission Checklist

- [ ] Developer account created ($5 paid)
- [ ] ZIP file ready: `promptprune-v1.0.0.zip`
- [ ] At least 1 screenshot prepared
- [ ] Privacy policy URL ready
- [ ] Extension tested and working
- [ ] Store listing text written
- [ ] Ready to submit!

## ⏱️ Timeline

- **Account Setup:** 5 minutes
- **Submission:** 10-15 minutes
- **Review:** 1-3 business days
- **Total Time:** ~1 hour (mostly waiting for review)

## 💰 Cost

- **One-time fee:** $5 USD
- **Everything else:** FREE

## 📚 Full Guide

See `CHROME_STORE_GUIDE.md` for detailed instructions.

Good luck! 🎉

