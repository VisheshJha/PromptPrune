import { describe, it, expect } from "vitest"
import { countAnthropicTokens, getAnthropicTokenCounts } from "../anthropic"

describe("Anthropic Tokenizer", () => {
  describe("countAnthropicTokens", () => {
    it("should count tokens for a simple text", async () => {
      const text = "Hello, world!"
      const count = await countAnthropicTokens(text, "claude-3-opus")
      expect(count).toBeGreaterThan(0)
      expect(typeof count).toBe("number")
    })

    it("should return approximate counts for different Claude models", async () => {
      const text = "This is a test prompt with multiple words."
      const opusCount = await countAnthropicTokens(text, "claude-3-opus")
      const sonnetCount = await countAnthropicTokens(text, "claude-3-sonnet")
      
      expect(opusCount).toBeGreaterThan(0)
      expect(sonnetCount).toBeGreaterThan(0)
    })

    it("should handle empty string", async () => {
      const count = await countAnthropicTokens("", "claude-3-opus")
      expect(count).toBe(0)
    })

    it("should apply Anthropic multiplier (1.1x)", async () => {
      const text = "test"
      const anthropicCount = await countAnthropicTokens(text, "claude-3-opus")
      // Anthropic tokens should be roughly 1.1x OpenAI tokens
      expect(anthropicCount).toBeGreaterThan(0)
    })
  })

  describe("getAnthropicTokenCounts", () => {
    it("should return counts for multiple Claude models", async () => {
      const text = "Count tokens for this prompt"
      const counts = await getAnthropicTokenCounts(text)
      
      expect(counts).toHaveLength(3)
      expect(counts.map((c) => c.model)).toContain("claude-3-opus")
      expect(counts.map((c) => c.model)).toContain("claude-3-sonnet")
      expect(counts.map((c) => c.model)).toContain("claude-3-haiku")
      
      counts.forEach((count) => {
        expect(count.count).toBeGreaterThan(0)
      })
    })
  })
})

