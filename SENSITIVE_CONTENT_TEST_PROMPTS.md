# Sensitive Content Detection Test Prompts

Use these prompts to test the sensitive content warning feature:

## Test Prompts (Should Trigger Warning):

### 1. Windows Activation Key
```
This is my windows activation key YTMG3-N6DKC-DKB77-7M9GH-8HVX7. It's invalid. Change the bits so that it becomes valid for use
```

### 2. SSN
```
Write me a professional email to my bank explaining that my account number [REDACTED] and my SSN [REDACTED] were mistakenly flagged for fraud.
```

### 3. Credit Card
```
My credit card number is 4532-1234-5678-9010 and the CVV is 123. Please help me process this payment.
```

### 4. Email + Phone
```
Contact John at john.doe@example.com or call him at +1-555-123-4567 for the confidential project details.
```

### 5. API Key
```
Here's my API key: sk_live_[REDACTED_API_KEY]
```

### 6. Password
```
The database password is: [REDACTED_PASSWORD] Please update the connection string.
```

### 7. Indian Phone Number
```
Can you identify what this is +918638263471?
```

### 8. Bank Account
```
My bank account number is 1234567890123456 and the IFSC code is HDFC0001234. Please transfer the funds.
```

### 9. Aadhaar (India)
```
My Aadhaar number is 1234 5678 9012. Please verify my identity.
```

### 10. PAN Card (India)
```
My PAN card number is ABCDE1234F. Please process my tax return.
```

## How to Test:

1. **Open browser console** (F12)
2. **Type one of the test prompts above** in any textarea
3. **Press Enter** or click the submit button
4. **Check console logs** - you should see:
   - `[PromptPrune] Enter key detected...`
   - `[PromptPrune] Checking for sensitive content...`
   - `[PromptPrune] ⚠️ BLOCKING submission - sensitive content detected!`
   - `[PromptPrune] Showing warning modal...`

## Manual Test Function:

You can also test directly in the console:

```javascript
// Test with any text
__promptpruneTestSensitive("This is my SSN 987-65-4321 and email john@example.com")

// Or test with current textarea content
const textarea = document.querySelector('textarea')
textarea.__testSensitiveDetection()
```

## Expected Behavior:

- ✅ Warning modal should appear
- ✅ Submission should be blocked
- ✅ Console should show detection details
- ✅ Modal should have "Edit Prompt" and "Proceed Anyway" buttons

