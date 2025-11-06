# Testing Guide

PromptPrune includes a comprehensive test suite using **Vitest** and **React Testing Library**.

## Test Structure

```
src/
├── lib/
│   ├── tokenizers/
│   │   └── __tests__/
│   │       ├── openai.test.ts
│   │       ├── anthropic.test.ts
│   │       └── index.test.ts
│   └── __tests__/
│       ├── heuristics.test.ts
│       └── ollama.test.ts
├── popup/
│   └── components/
│       └── __tests__/
│           ├── TokenDisplay.test.tsx
│           ├── SmartOptimizer.test.tsx
│           └── SavingsCalculator.test.tsx
└── test/
    └── setup.ts
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests with coverage
```bash
npm run test:coverage
```

Coverage report will be generated in the `coverage/` directory.

## Test Coverage

### Unit Tests

1. **Tokenizer Services** (`src/lib/tokenizers/__tests__/`)
   - OpenAI token counting
   - Anthropic token counting
   - Gemini token counting
   - Multi-provider token aggregation
   - Average token calculation

2. **Heuristics Optimizer** (`src/lib/__tests__/heuristics.test.ts`)
   - Whitespace removal
   - Filler word removal
   - Verbose phrase simplification
   - Redundant qualifier removal
   - Edge cases (empty strings, long text)

3. **Ollama Client** (`src/lib/__tests__/ollama.test.ts`)
   - Ollama availability checking
   - Prompt optimization
   - Model information retrieval
   - Error handling and fallbacks

### Component Tests

1. **TokenDisplay** (`src/popup/components/__tests__/TokenDisplay.test.tsx`)
   - Empty state handling
   - Loading states
   - Token count display
   - Error handling

2. **SmartOptimizer** (`src/popup/components/__tests__/SmartOptimizer.test.tsx`)
   - Ollama integration
   - Heuristics fallback
   - Optimization results display
   - Copy functionality

3. **SavingsCalculator** (`src/popup/components/__tests__/SavingsCalculator.test.tsx`)
   - Savings calculation
   - Monthly request adjustment
   - Multi-model savings display

## Writing New Tests

### Example: Testing a utility function

```typescript
import { describe, it, expect } from "vitest"
import { myFunction } from "../myFunction"

describe("myFunction", () => {
  it("should handle normal case", () => {
    const result = myFunction("input")
    expect(result).toBe("expected")
  })

  it("should handle edge case", () => {
    const result = myFunction("")
    expect(result).toBe("")
  })
})
```

### Example: Testing a React component

```typescript
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MyComponent } from "../MyComponent"

describe("MyComponent", () => {
  it("should render correctly", () => {
    render(<MyComponent />)
    expect(screen.getByText("Expected Text")).toBeInTheDocument()
  })

  it("should handle user interaction", async () => {
    const user = userEvent.setup()
    render(<MyComponent />)
    
    const button = screen.getByRole("button")
    await user.click(button)
    
    expect(screen.getByText("Clicked!")).toBeInTheDocument()
  })
})
```

## Mocking

The test setup includes mocks for:
- Chrome APIs (`chrome.storage`, `chrome.runtime`, etc.)
- Fetch API (for Ollama requests)

### Mocking modules

```typescript
import { vi } from "vitest"

vi.mock("~/lib/someModule", () => ({
  someFunction: vi.fn().mockReturnValue("mocked value"),
}))
```

## Best Practices

1. **Test behavior, not implementation** - Focus on what the code does, not how it does it
2. **Use descriptive test names** - Test names should clearly describe what they're testing
3. **Keep tests isolated** - Each test should be independent and not rely on other tests
4. **Test edge cases** - Empty strings, null values, very long inputs, etc.
5. **Mock external dependencies** - Don't make real API calls or access real storage in tests
6. **Maintain high coverage** - Aim for >80% code coverage

## Continuous Integration

To run tests in CI/CD:

```yaml
# Example GitHub Actions
- name: Run tests
  run: npm test -- --run --coverage
```

## Troubleshooting

### Tests fail with "Cannot find module"
- Run `npm install` to ensure all dependencies are installed

### React component tests fail
- Ensure `@testing-library/react` and `@testing-library/jest-dom` are installed
- Check that `src/test/setup.ts` is properly configured

### Chrome API mocks not working
- Verify `src/test/setup.ts` includes proper Chrome API mocks
- Check that mocks are set up before tests run

