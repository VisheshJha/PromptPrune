import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SmartOptimizer } from "../SmartOptimizer"
import * as ollama from "~/lib/ollama"
import * as heuristics from "~/lib/heuristics"

// Mock the modules
vi.mock("~/lib/ollama")
vi.mock("~/lib/heuristics")

describe("SmartOptimizer", () => {
  const mockOnOptimized = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ollama.checkOllamaAvailable).mockResolvedValue(false)
  })

  it("should show placeholder when prompt is empty", () => {
    render(<SmartOptimizer originalPrompt="" onOptimized={mockOnOptimized} />)
    expect(screen.getByText(/Enter a prompt to optimize/i)).toBeInTheDocument()
  })

  it("should show optimize button when prompt is provided", () => {
    render(
      <SmartOptimizer originalPrompt="test prompt" onOptimized={mockOnOptimized} />
    )
    expect(screen.getByText(/Optimize Prompt/i)).toBeInTheDocument()
  })

  it("should use heuristics when Ollama is not available", async () => {
    const mockResult = {
      optimized: "optimized prompt",
      originalLength: 20,
      optimizedLength: 15,
      reduction: 5,
      techniques: ["Removed filler words"],
    }

    vi.mocked(ollama.checkOllamaAvailable).mockResolvedValue(false)
    vi.mocked(heuristics.optimizeWithHeuristics).mockReturnValue(mockResult)

    const user = userEvent.setup()
    render(
      <SmartOptimizer originalPrompt="test prompt" onOptimized={mockOnOptimized} />
    )

    const button = screen.getByText(/Optimize Prompt/i)
    await user.click(button)

    await waitFor(() => {
      expect(mockOnOptimized).toHaveBeenCalledWith("optimized prompt")
      expect(screen.getByText("optimized prompt")).toBeInTheDocument()
    })
  })

  it("should use Ollama when available", async () => {
    const mockOllamaResult = {
      optimized: "ollama optimized",
      originalLength: 20,
      optimizedLength: 12,
      reduction: 8,
    }

    vi.mocked(ollama.checkOllamaAvailable).mockResolvedValue(true)
    vi.mocked(ollama.optimizeWithOllama).mockResolvedValue(mockOllamaResult)

    const user = userEvent.setup()
    render(
      <SmartOptimizer originalPrompt="test prompt" onOptimized={mockOnOptimized} />
    )

    const button = screen.getByText(/Optimize Prompt/i)
    await user.click(button)

    await waitFor(() => {
      expect(ollama.optimizeWithOllama).toHaveBeenCalled()
      expect(mockOnOptimized).toHaveBeenCalledWith("ollama optimized")
    })
  })

  it("should fallback to heuristics if Ollama fails", async () => {
    const mockHeuristicsResult = {
      optimized: "heuristics optimized",
      originalLength: 20,
      optimizedLength: 15,
      reduction: 5,
      techniques: ["Removed filler words"],
    }

    vi.mocked(ollama.checkOllamaAvailable).mockResolvedValue(true)
    vi.mocked(ollama.optimizeWithOllama).mockRejectedValue(
      new Error("Ollama failed")
    )
    vi.mocked(heuristics.optimizeWithHeuristics).mockReturnValue(
      mockHeuristicsResult
    )

    const user = userEvent.setup()
    render(
      <SmartOptimizer originalPrompt="test prompt" onOptimized={mockOnOptimized} />
    )

    const button = screen.getByText(/Optimize Prompt/i)
    await user.click(button)

    await waitFor(() => {
      expect(mockOnOptimized).toHaveBeenCalledWith("heuristics optimized")
    })
  })

  it("should show copy button after optimization", async () => {
    const mockResult = {
      optimized: "optimized",
      originalLength: 10,
      optimizedLength: 8,
      reduction: 2,
      techniques: ["Test"],
    }

    vi.mocked(heuristics.optimizeWithHeuristics).mockReturnValue(mockResult)

    const user = userEvent.setup()
    render(
      <SmartOptimizer originalPrompt="test" onOptimized={mockOnOptimized} />
    )

    const button = screen.getByText(/Optimize Prompt/i)
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText(/Copy Optimized Prompt/i)).toBeInTheDocument()
    })
  })
})

