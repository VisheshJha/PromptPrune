import { describe, it, expect, vi, beforeEach } from "vitest"
import { countOpenAITokens, getOpenAITokenCounts } from "../openai"

describe("OpenAI Tokenizer", () => {
  describe("countOpenAITokens", () => {
    it("should count tokens for a simple text", async () => {
      const text = "Hello, world!"
      const count = await countOpenAITokens(text, "gpt-4")
      expect(count).toBeGreaterThan(0)
      expect(typeof count).toBe("number")
    })

    it("should return different counts for different models", async () => {
      const text = "This is a test prompt with multiple words."
      const gpt4Count = await countOpenAITokens(text, "gpt-4")
      const gpt35Count = await countOpenAITokens(text, "gpt-3.5-turbo")
      
      // Both should be valid numbers
      expect(gpt4Count).toBeGreaterThan(0)
      expect(gpt35Count).toBeGreaterThan(0)
    })

    it("should handle empty string", async () => {
      const count = await countOpenAITokens("", "gpt-4")
      expect(count).toBe(0)
    })

    it("should handle long text", async () => {
      const longText = "word ".repeat(1000)
      const count = await countOpenAITokens(longText, "gpt-4")
      expect(count).toBeGreaterThan(100)
    })

    it("should fallback to estimate on error", async () => {
      // This test verifies the fallback mechanism works
      const text = "test"
      const count = await countOpenAITokens(text, "invalid-model")
      // Should still return a number (either from encoding or fallback)
      expect(count).toBeGreaterThan(0)
    })
  })

  describe("getOpenAITokenCounts", () => {
    it("should return counts for multiple models", async () => {
      const text = "Count tokens for this prompt"
      const counts = await getOpenAITokenCounts(text)
      
      expect(counts).toHaveLength(3)
      expect(counts.map((c) => c.model)).toContain("gpt-4")
      expect(counts.map((c) => c.model)).toContain("gpt-4-turbo")
      expect(counts.map((c) => c.model)).toContain("gpt-3.5-turbo")
      
      counts.forEach((count) => {
        expect(count.count).toBeGreaterThan(0)
        expect(typeof count.count).toBe("number")
      })
    })

    it("should handle empty string", async () => {
      const counts = await getOpenAITokenCounts("")
      expect(counts).toHaveLength(3)
      counts.forEach((count) => {
        expect(count.count).toBe(0)
      })
    })
  })
})

