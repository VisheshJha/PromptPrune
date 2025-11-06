import { describe, it, expect } from "vitest"
import { getAllTokenCounts, getAverageTokenCount } from "../index"

describe("Tokenizer Index", () => {
  describe("getAllTokenCounts", () => {
    it("should return counts for all providers", async () => {
      const text = "This is a test prompt"
      const counts = await getAllTokenCounts(text)
      
      expect(counts).toHaveProperty("openai")
      expect(counts).toHaveProperty("anthropic")
      expect(counts).toHaveProperty("gemini")
      
      expect(counts.openai.length).toBeGreaterThan(0)
      expect(counts.anthropic.length).toBeGreaterThan(0)
      expect(counts.gemini.length).toBeGreaterThan(0)
    })

    it("should include provider information", async () => {
      const text = "test"
      const counts = await getAllTokenCounts(text)
      
      counts.openai.forEach((count) => {
        expect(count.provider).toBe("openai")
      })
      
      counts.anthropic.forEach((count) => {
        expect(count.provider).toBe("anthropic")
      })
      
      counts.gemini.forEach((count) => {
        expect(count.provider).toBe("gemini")
      })
    })
  })

  describe("getAverageTokenCount", () => {
    it("should calculate average across all models", () => {
      const counts = {
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
      
      const average = getAverageTokenCount(counts)
      // (10 + 12 + 11 + 9) / 4 = 10.5, rounded to 11
      expect(average).toBe(11)
    })

    it("should return 0 for empty counts", () => {
      const counts = {
        openai: [],
        anthropic: [],
        gemini: [],
      }
      
      const average = getAverageTokenCount(counts)
      expect(average).toBe(0)
    })
  })
})

