/**
 * Test case for framework-to-framework switching
 * Verifies that format-to-format conversion uses originalPrompt, not previous framework output
 */

import { describe, it, expect, beforeEach } from "vitest"
import { applyFramework, type FrameworkType } from "../prompt-frameworks"

describe("Framework-to-Framework Switching", () => {
  const originalPrompt = "write about ai and robots make it good"
  
  it("should use original prompt when switching from CoT to RACE", () => {
    // Apply CoT framework
    const cotOutput = applyFramework(originalPrompt, "cot")
    const cotOptimized = cotOutput.optimized
    
    // Verify CoT was applied
    expect(cotOptimized).toContain("Chain of Thought")
    expect(cotOptimized).not.toBe(originalPrompt)
    
    // Switch to RACE - should use ORIGINAL, not CoT output
    const raceOutput = applyFramework(originalPrompt, "race")
    const raceOptimized = raceOutput.optimized
    
    // Verify RACE was applied to original, not CoT output
    expect(raceOptimized).toContain("Role")
    expect(raceOptimized).toContain("Action")
    expect(raceOptimized).toContain("Context")
    expect(raceOptimized).toContain("Expectation")
    
    // Should NOT contain CoT-specific text
    expect(raceOptimized).not.toContain("Chain of Thought")
    expect(raceOptimized).not.toContain("Step 1")
    
    // Should contain original topic
    expect(raceOptimized.toLowerCase()).toMatch(/ai|robot|artificial intelligence/i)
  })
  
  it("should use original prompt when switching from APE to ROSES", () => {
    // Apply APE framework
    const apeOutput = applyFramework(originalPrompt, "ape")
    const apeOptimized = apeOutput.optimized
    
    // Verify APE was applied
    expect(apeOptimized).toContain("Action")
    expect(apeOptimized).toContain("Purpose")
    expect(apeOptimized).toContain("Expectation")
    
    // Switch to ROSES - should use ORIGINAL, not APE output
    const rosesOutput = applyFramework(originalPrompt, "roses")
    const rosesOptimized = rosesOutput.optimized
    
    // Verify ROSES was applied to original, not APE output
    expect(rosesOptimized).toContain("Role")
    expect(rosesOptimized).toContain("Objective")
    expect(rosesOptimized).toContain("Style")
    expect(rosesOptimized).toContain("Example")
    expect(rosesOptimized).toContain("Scope")
    
    // Should NOT contain duplicate "Action" or "Purpose" from APE
    // ROSES has its own structure, so it shouldn't have APE's structure
    const actionCount = (rosesOptimized.match(/Action:/gi) || []).length
    expect(actionCount).toBeLessThanOrEqual(1) // Only ROSES's own action, not APE's
    
    // Should contain original topic
    expect(rosesOptimized.toLowerCase()).toMatch(/ai|robot|artificial intelligence/i)
  })
  
  it("should not duplicate framework-specific keywords when switching", () => {
    const frameworks: FrameworkType[] = ["cot", "race", "ape", "roses", "create"]
    
    let lastOutput = originalPrompt
    
    for (const framework of frameworks) {
      // Always apply to original, not last output
      const output = applyFramework(originalPrompt, framework)
      const optimized = output.optimized
      
      // Check for duplicate keywords
      const roleMatches = (optimized.match(/Role:/gi) || []).length
      const actionMatches = (optimized.match(/Action:/gi) || []).length
      const youAreMatches = (optimized.match(/You are/gi) || []).length
      
      // Should not have excessive duplicates (max 2-3 per framework structure)
      expect(roleMatches).toBeLessThan(5)
      expect(actionMatches).toBeLessThan(5)
      expect(youAreMatches).toBeLessThan(3)
      
      lastOutput = optimized
    }
  })
  
  it("should preserve original intent when switching frameworks", () => {
    const testPrompt = "write a blog post about climate change for general audience"
    
    const frameworks: FrameworkType[] = ["cot", "race", "ape", "roses"]
    
    for (const framework of frameworks) {
      const output = applyFramework(testPrompt, framework)
      const optimized = output.optimized
      
      // Should preserve original intent
      expect(optimized.toLowerCase()).toMatch(/blog|post|article/i)
      expect(optimized.toLowerCase()).toMatch(/climate change|climate/i)
      expect(optimized.toLowerCase()).toMatch(/general|audience|readers/i)
    }
  })
  
  it("should handle structured prompts correctly", () => {
    const structuredPrompt = `Role: expert writer
Task: write
Topic: technology trends
Format: article
Tone: professional`
    
    // Apply first framework
    const firstOutput = applyFramework(structuredPrompt, "race")
    
    // Switch to second framework - should use original structured prompt
    const secondOutput = applyFramework(structuredPrompt, "roses")
    
    // Both should extract the same information from original
    expect(secondOutput.optimized.toLowerCase()).toMatch(/expert|writer/i)
    expect(secondOutput.optimized.toLowerCase()).toMatch(/technology|trend/i)
    expect(secondOutput.optimized.toLowerCase()).toMatch(/article/i)
    expect(secondOutput.optimized.toLowerCase()).toMatch(/professional/i)
    
    // Should not have duplicate Role/Task/Topic from first framework
    const roleCount = (secondOutput.optimized.match(/Role:/gi) || []).length
    expect(roleCount).toBeLessThanOrEqual(2) // ROSES structure + maybe one reference
  })
})

