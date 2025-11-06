import { describe, it, expect } from "vitest"
import { optimizeWithHeuristics } from "../heuristics"

describe("Heuristics Optimizer", () => {
  it("should optimize a verbose prompt", () => {
    const prompt = "I would like to kindly request that you please make sure to do this task."
    const result = optimizeWithHeuristics(prompt)
    
    expect(result.optimized).toBeTruthy()
    expect(result.optimized.length).toBeLessThanOrEqual(result.originalLength)
    expect(result.reduction).toBeGreaterThanOrEqual(0)
    expect(result.techniques.length).toBeGreaterThan(0)
  })

  it("should remove redundant whitespace", () => {
    const prompt = "This    has    multiple    spaces    and\n\n\nmultiple newlines."
    const result = optimizeWithHeuristics(prompt)
    
    expect(result.optimized).not.toContain("    ")
    expect(result.reduction).toBeGreaterThan(0)
  })

  it("should simplify verbose phrases", () => {
    const prompt = "Due to the fact that we need to do this, prior to the event."
    const result = optimizeWithHeuristics(prompt)
    
    expect(result.optimized).toContain("because")
    expect(result.optimized).toContain("before")
    expect(result.reduction).toBeGreaterThan(0)
  })

  it("should remove filler words", () => {
    const prompt = "I would like to kindly request that you please do this."
    const result = optimizeWithHeuristics(prompt)
    
    // Should remove "I would like to", "kindly", "please"
    expect(result.optimized.length).toBeLessThan(prompt.length)
    expect(result.reduction).toBeGreaterThan(0)
  })

  it("should handle already optimized text", () => {
    const prompt = "Do this task."
    const result = optimizeWithHeuristics(prompt)
    
    expect(result.optimized).toBeTruthy()
    expect(result.optimized.length).toBeLessThanOrEqual(result.originalLength)
  })

  it("should preserve meaning while reducing length", () => {
    const prompt = "It is important to note that in order to complete this task, you must first understand the requirements."
    const result = optimizeWithHeuristics(prompt)
    
    // Should still contain key words
    expect(result.optimized.toLowerCase()).toContain("task")
    expect(result.optimized.toLowerCase()).toContain("requirements")
    expect(result.reduction).toBeGreaterThan(0)
  })

  it("should return techniques used", () => {
    const prompt = "This    has    spaces    and    filler    words    please."
    const result = optimizeWithHeuristics(prompt)
    
    expect(result.techniques).toBeInstanceOf(Array)
    expect(result.techniques.length).toBeGreaterThan(0)
  })

  it("should handle empty string", () => {
    const result = optimizeWithHeuristics("")
    
    expect(result.optimized).toBe("")
    expect(result.originalLength).toBe(0)
    expect(result.optimizedLength).toBe(0)
    expect(result.reduction).toBe(0)
  })

  it("should handle very long text", () => {
    const longPrompt = "word ".repeat(1000) + "please kindly do this task."
    const result = optimizeWithHeuristics(longPrompt)
    
    expect(result.optimized.length).toBeLessThanOrEqual(result.originalLength)
    expect(result.reduction).toBeGreaterThanOrEqual(0)
  })
})

