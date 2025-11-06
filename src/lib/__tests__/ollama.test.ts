import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  checkOllamaAvailable,
  optimizeWithOllama,
  getOllamaModelInfo,
} from "../ollama"

describe("Ollama Client", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("checkOllamaAvailable", () => {
    it("should return true when Ollama is available", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })

      const available = await checkOllamaAvailable()
      expect(available).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:11434/api/tags",
        expect.objectContaining({
          method: "GET",
        })
      )
    })

    it("should return false when Ollama is not available", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection failed"))

      const available = await checkOllamaAvailable()
      expect(available).toBe(false)
    })

    it("should return false on timeout", async () => {
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Timeout")), 3000)
          })
      )

      const available = await checkOllamaAvailable()
      expect(available).toBe(false)
    })
  })

  describe("optimizeWithOllama", () => {
    it("should optimize prompt when Ollama is available", async () => {
      // Mock checkOllamaAvailable
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            response: "Optimized shorter prompt",
          }),
        })

      const result = await optimizeWithOllama({
        prompt: "This is a very long and verbose prompt that needs optimization.",
      })

      expect(result.optimized).toBe("Optimized shorter prompt")
      expect(result.originalLength).toBeGreaterThan(0)
      expect(result.optimizedLength).toBeGreaterThan(0)
      expect(result.reduction).toBeDefined()
    })

    it("should throw error when Ollama is not available", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection failed"))

      await expect(
        optimizeWithOllama({
          prompt: "test prompt",
        })
      ).rejects.toThrow()
    })

    it("should use default model when not specified", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            response: "optimized",
          }),
        })

      await optimizeWithOllama({
        prompt: "test",
      })

      const callArgs = (global.fetch as any).mock.calls[1][1]
      const body = JSON.parse(callArgs.body)
      expect(body.model).toBe("tinyllama:1.1b")
    })

    it("should use custom model when specified", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            response: "optimized",
          }),
        })

      await optimizeWithOllama({
        prompt: "test",
        model: "custom-model",
      })

      const callArgs = (global.fetch as any).mock.calls[1][1]
      const body = JSON.parse(callArgs.body)
      expect(body.model).toBe("custom-model")
    })
  })

  describe("getOllamaModelInfo", () => {
    it("should return model info when available", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { name: "tinyllama:1.1b" },
            { name: "llama2:7b" },
          ],
        }),
      })

      const info = await getOllamaModelInfo()

      expect(info.available).toBe(true)
      expect(info.models).toContain("tinyllama:1.1b")
      expect(info.model).toBe("tinyllama:1.1b")
    })

    it("should return unavailable when Ollama is not running", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection failed"))

      const info = await getOllamaModelInfo()

      expect(info.available).toBe(false)
    })
  })
})

