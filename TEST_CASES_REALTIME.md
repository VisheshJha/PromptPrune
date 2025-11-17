# Real-Time Features Test Cases

## Test Setup
1. Load the extension in your browser
2. Navigate to any AI chat platform (ChatGPT, Copilot, etc.)
3. Click on the textarea to start typing

---

## 1. Spell Check Test Cases

### Test 1.1: Basic Misspelling Detection
**Input:** `I want to writte an email`
**Expected:** Red squiggle under "writte"
**Action:** Hover over "writte" - should show suggestions like "write"
**Click suggestion:** Should replace "writte" with "write"

### Test 1.2: Multiple Misspellings
**Input:** `Ths is a tst for spell chek`
**Expected:** Red squiggles under: "Ths", "tst", "chek"
**Action:** Click each word to see suggestions

### Test 1.3: Common Typos
**Input:** `teh quick brown fox`
**Expected:** Red squiggle under "teh" with suggestion "the"

### Test 1.4: Case-Sensitive Words
**Input:** `I am a Developer`
**Expected:** Should NOT flag "Developer" (proper noun)

### Test 1.5: Technical Terms
**Input:** `I need to use JavaScript and TypeScript`
**Expected:** Should NOT flag technical terms

---

## 2. Autocomplete Test Cases

### Test 2.1: Pattern-Based Suggestions
**Input:** Type `write`
**Expected:** Should show suggestions like "an email", "a report", "a blog post"
**Action:** Press Tab or click to accept

### Test 2.2: Two-Word Patterns
**Input:** Type `write an email`
**Expected:** Should show suggestions like "as a sales rep", "to a client"

### Test 2.3: Token Optimization
**Input:** Type `in order to`
**Expected:** Should suggest "to" (saves tokens)
**Action:** Accept suggestion - should replace with shorter version

### Test 2.4: Mid-Word Prevention
**Input:** Type `develop` (cursor in middle of word)
**Expected:** Should NOT show autocomplete mid-word

### Test 2.5: End of Word
**Input:** Type `write ` (with space at end)
**Expected:** Should show autocomplete suggestions

---

## 3. Context Suggestions Test Cases

### Test 3.1: Short Prompt - Show Context
**Input:** `write email`
**Expected:** Above textarea, should show: "💡 Add context: about [topic] for [purpose]"
**Action:** Click "about [topic]" - should insert at cursor position

### Test 3.2: Short Prompt - Hide After Adding
**Input:** `write email about [topic]`
**Expected:** Context suggestions should disappear

### Test 3.3: Long Prompt - Hide Context
**Input:** `write a professional email to my client explaining the new product features and pricing`
**Expected:** Context suggestions should NOT appear (too long)

### Test 3.4: Context Already Present
**Input:** `write email for marketing purpose`
**Expected:** Context suggestions should NOT appear

---

## 4. Framework Suggestions Test Cases

### Test 4.1: Framework Chips Below Smart Analysis
**Input:** Type `write a cold email as a sales rep`
**Expected:** 
- Smart Analysis button appears below P icon
- Framework chips appear below Smart Analysis button
- Top 3 frameworks shown as chips
- Best framework highlighted in green with "BEST" badge

### Test 4.2: Click Framework Chip
**Input:** Click on a framework chip (e.g., "RACE")
**Expected:** 
- Prompt should be transformed with framework
- Notification: "Applied RACE framework"
- Framework chips should disappear

### Test 4.3: Framework Updates on Typing
**Input:** Start with `write email`, then change to `analyze data`
**Expected:** Framework suggestions should update based on new content

### Test 4.4: Hide for Short Prompts
**Input:** `hi`
**Expected:** Framework suggestions should NOT appear (too short)

---

## 5. Quality Score Test Cases

### Test 5.1: Quality Score Circle
**Input:** Type any prompt
**Expected:** 
- Circle with number (0-100) appears
- Hover shows tooltip: "Prompt Quality Score (0-100) - Based on clarity, specificity, structure, and completeness"

### Test 5.2: Score Updates
**Input:** Start with `hi` (low score), then expand to `write a professional email to my client about the new product launch`
**Expected:** Score should increase as prompt becomes more detailed

### Test 5.3: Empty Textarea
**Input:** Clear all text
**Expected:** Quality score should show 0

---

## 6. Token Counter Test Cases

### Test 6.1: Token Count Display
**Input:** Type `Hello world`
**Expected:** Should show token count and cost (e.g., "5 tokens $0.0001")

### Test 6.2: Token Count Updates
**Input:** Keep typing more text
**Expected:** Token count should update in real-time

### Test 6.3: Empty Textarea
**Input:** Clear all text
**Expected:** Should show "0 tokens $0.0000"

### Test 6.4: Draggable Token Counter
**Input:** Drag the token counter
**Expected:** Should move to new position and remember position

---

## 7. Redundancy Detection Test Cases

### Test 7.1: Redundant Phrases
**Input:** `I think that I think we should go`
**Expected:** Yellow squiggle under redundant "I think"

### Test 7.2: Repeated Words
**Input:** `The the quick brown fox`
**Expected:** Yellow squiggle under second "the"

### Test 7.3: Similar Phrases
**Input:** `We need to analyze and examine the data`
**Expected:** Yellow squiggle under "analyze and examine" (similar meaning)

---

## 8. Grammar Check Test Cases

### Test 8.1: Grammar Issues
**Input:** `I are going to the store`
**Expected:** Blue squiggle under "I are" with suggestion "I am"

### Test 8.2: Style Improvements
**Input:** `In order to complete the task, we need to...`
**Expected:** Blue squiggle suggesting "To complete the task, we need to..."

### Test 8.3: Passive Voice
**Input:** `The report was written by me`
**Expected:** Blue squiggle suggesting active voice: "I wrote the report"

---

## 9. Smart Suggestions Test Cases

### Test 9.1: Missing Role
**Input:** `write an email`
**Expected:** Suggestion chip: "Add role: 'as a [role]'"

### Test 9.2: Missing Format
**Input:** `explain quantum computing`
**Expected:** Suggestion chip: "Specify format: 'in [format]'"

### Test 9.3: Missing Tone
**Input:** `write a message`
**Expected:** Suggestion chip: "Add tone: '[tone]'"

---

## 10. Layout Test Cases

### Test 10.1: Component Positions
**Expected Layout:**
- **P Icon:** Right of textarea
- **Clear All:** Right of P icon
- **Smart Analysis:** Below P icon
- **Framework Chips:** Below Smart Analysis button
- **Context Suggestions:** Above textarea
- **Token Counter:** Top-right (draggable)
- **Quality Score:** To the right of Token Counter (draggable)

### Test 10.2: No Overlap
**Input:** Type a long prompt
**Expected:** All components should be visible without overlapping the textarea

### Test 10.3: Scroll/Resize
**Input:** Scroll page or resize window
**Expected:** All components should reposition correctly

---

## 11. Integration Test Cases

### Test 11.1: All Features Together
**Input:** Type `writte an emial as a sales rep` (with typos)
**Expected:**
- Red squiggles for misspellings
- Context suggestions above
- Framework chips below Smart Analysis
- Token count updates
- Quality score updates
- Autocomplete suggestions appear

### Test 11.2: Feature Interactions
**Input:** Fix a spelling error
**Expected:** Token count should update, quality score may improve

### Test 11.3: Framework Application
**Input:** Click a framework chip
**Expected:** 
- Prompt transforms
- Token count updates
- Quality score may change
- Context suggestions may disappear (if prompt becomes long)

---

## Troubleshooting

### If spell check doesn't work:
1. Check browser console for errors
2. Verify RealTimeAssistant is initialized (check console logs)
3. Try refreshing the page
4. Check if spell check is enabled in localStorage: `localStorage.getItem('pp-realtime-spell-check')`

### If autocomplete doesn't work:
1. Make sure you're typing at the end of a word (not mid-word)
2. Check console for errors
3. Verify autocomplete is enabled: `localStorage.getItem('pp-realtime-autocomplete')`

### If framework suggestions don't appear:
1. Make sure prompt is > 10 characters
2. Check console for errors in `rankFrameworks`
3. Verify Smart Analysis button is visible first

### If context suggestions don't appear:
1. Make sure prompt is < 10 words
2. Check that prompt doesn't already contain "context", "about [topic]", or "for [purpose]"
3. Verify textarea is focused

---

## Quick Test Script

Copy and paste these one by one into the textarea:

1. **Spell Check:** `I want to writte an emial`
2. **Autocomplete:** `write` (then wait for suggestions)
3. **Context:** `write email` (should show context suggestions above)
4. **Framework:** `write a cold email as a sales rep` (should show framework chips)
5. **All Together:** `writte an emial as a sales rep` (should trigger all features)

---

## Expected Console Logs

When features are working, you should see:
- `[PromptPrune] Real-time assistant initialized with all features`
- `[PromptPrune] Fixed "writte" → "write"` (when fixing spelling)
- `[PromptPrune] Autocomplete accepted: ...` (when accepting autocomplete)

If you see errors, check:
- `ReferenceError: RealTimeAssistant is not defined` - Import issue
- `TypeError: Cannot read property 'update' of null` - Component not initialized
- `Failed to execute 'observe' on 'MutationObserver'` - DOM issue

