import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { TokenDisplay } from "../TokenDisplay"
import * as tokenizers from "~/lib/tokenizers"

// Mock the tokenizer module
vi.mock("~/lib/tokenizers", () => ({
  getAllTokenCounts: vi.fn(),
  getAverageTokenCount: vi.fn(),
}))

describe("TokenDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should show placeholder when text is empty", () => {
    render(<TokenDisplay text="" />)
    expect(screen.getByText(/Enter a prompt to see token counts/i)).toBeInTheDocument()
  })

  it("should show loading state", async () => {
    vi.mocked(tokenizers.getAllTokenCounts).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ openai: [], anthropic: [], gemini: [] }), 100)
        })
    )

    render(<TokenDisplay text="test prompt" />)
    expect(screen.getByText(/Counting tokens/i)).toBeInTheDocument()
  })

  it("should display token counts when loaded", async () => {
    const mockCounts = {
      openai: [
        { count: 10, model: "gpt-4", provider: "openai" as const },
        { count: 12, model: "gpt-3.5-turbo", provider: "openai" as const },
      ],
      anthropic: [
        { count: 11, model: "claude-3-opus", provider: "anthropic" as const },
      ],
      gemini: [
        { count: 9, model: "gemini-pro", provider: "gemini" as const },
      ],
    }

    vi.mocked(tokenizers.getAllTokenCounts).mockResolvedValue(mockCounts)
    vi.mocked(tokenizers.getAverageTokenCount).mockReturnValue(10)

    render(<TokenDisplay text="test prompt" />)

    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument()
    })

    expect(screen.getByText("gpt-4")).toBeInTheDocument()
    expect(screen.getByText("claude-3-opus")).toBeInTheDocument()
    expect(screen.getByText("gemini-pro")).toBeInTheDocument()
  })

  it("should handle errors gracefully", async () => {
    vi.mocked(tokenizers.getAllTokenCounts).mockRejectedValue(
      new Error("Token counting failed")
    )

    render(<TokenDisplay text="test prompt" />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to count tokens/i)).toBeInTheDocument()
    })
  })
})

