import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SavingsCalculator } from "../SavingsCalculator"
import * as tokenizers from "~/lib/tokenizers"

// Mock the tokenizer module
vi.mock("~/lib/tokenizers", () => ({
  getAllTokenCounts: vi.fn(),
  getAverageTokenCount: vi.fn(),
}))

describe("SavingsCalculator", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should show placeholder when original text is empty", () => {
    render(<SavingsCalculator originalText="" optimizedText="" />)
    expect(screen.getByText(/Enter a prompt/i)).toBeInTheDocument()
  })

  it("should show message when optimized text is empty", () => {
    render(
      <SavingsCalculator originalText="test prompt" optimizedText="" />
    )
    expect(screen.getByText(/Optimize your prompt first/i)).toBeInTheDocument()
  })

  it("should calculate and display savings", async () => {
    const originalCounts = {
      openai: [
        { count: 100, model: "gpt-4", provider: "openai" as const },
        { count: 95, model: "gpt-3.5-turbo", provider: "openai" as const },
      ],
      anthropic: [
        { count: 105, model: "claude-3-opus", provider: "anthropic" as const },
      ],
      gemini: [
        { count: 90, model: "gemini-pro", provider: "gemini" as const },
      ],
    }

    const optimizedCounts = {
      openai: [
        { count: 70, model: "gpt-4", provider: "openai" as const },
        { count: 65, model: "gpt-3.5-turbo", provider: "openai" as const },
      ],
      anthropic: [
        { count: 75, model: "claude-3-opus", provider: "anthropic" as const },
      ],
      gemini: [
        { count: 60, model: "gemini-pro", provider: "gemini" as const },
      ],
    }

    vi.mocked(tokenizers.getAllTokenCounts)
      .mockResolvedValueOnce(originalCounts)
      .mockResolvedValueOnce(optimizedCounts)

    render(
      <SavingsCalculator
        originalText="original prompt"
        optimizedText="optimized prompt"
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Estimated Monthly Savings/i)).toBeInTheDocument()
    })

    // Should show savings for models with token reduction
    expect(screen.getByText("gpt-4")).toBeInTheDocument()
  })

  it("should allow changing requests per month", async () => {
    const counts = {
      openai: [
        { count: 100, model: "gpt-4", provider: "openai" as const },
      ],
      anthropic: [],
      gemini: [],
    }

    vi.mocked(tokenizers.getAllTokenCounts)
      .mockResolvedValueOnce(counts)
      .mockResolvedValueOnce({
        openai: [{ count: 70, model: "gpt-4", provider: "openai" as const }],
        anthropic: [],
        gemini: [],
      })

    const user = userEvent.setup()
    render(
      <SavingsCalculator
        originalText="original"
        optimizedText="optimized"
      />
    )

    await waitFor(() => {
      const input = screen.getByLabelText(/Requests per month/i)
      expect(input).toBeInTheDocument()
    })

    const input = screen.getByLabelText(/Requests per month/i)
    await user.clear(input)
    await user.type(input, "5000")

    expect(input).toHaveValue(5000)
  })
})

