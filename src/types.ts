/**
 * Type definitions for the Zig MCP Server
 */

export interface ZigOptimizationLevel {
  Debug: never;
  ReleaseSafe: never;
  ReleaseFast: never;
  ReleaseSmall: never;
}

export type OptimizationLevel = keyof ZigOptimizationLevel;

export interface CodeAnalysisResult {
  memoryUsage: string;
  timeComplexity: string;
  allocations: string;
}

export interface OptimizationSuggestion {
  category: 'general' | 'buildMode';
  suggestions: string[];
}

export interface CodeGenerationRequirements {
  features: Set<string>;
  errorHandling: boolean;
  testing: boolean;
  performance: boolean;
  [key: string]: Set<string> | boolean;
}

export interface MemoryPattern {
  heapAlloc: RegExp;
  stackAlloc: RegExp;
  slices: RegExp;
}

export interface TimeComplexityPattern {
  loops: RegExp;
  nestedLoops: RegExp;
  recursion: RegExp;
}

export interface AllocationPattern {
  comptime: RegExp;
  arena: RegExp;
  fixedBuf: RegExp;
}

export interface CodeRecommendation {
  style: string;
  patterns: string;
  safety: string;
  performance: string;
}

export interface GitHubRepo {
  name: string;
  description: string;
  stars: number;
  url: string;
}

export interface ZigBuildConfig {
  zigVersion: string;
  buildMode: OptimizationLevel;
  targetTriple?: string;
  dependencies: Record<string, string>;
  buildSteps: string[];
}

export interface ZigModuleDependency {
  name: string;
  path: string;
  version?: string;
  url?: string;
}

export interface ZigBuildStep {
  name: string;
  type: 'exe' | 'lib' | 'test' | 'install';
  sources: string[];
  dependencies: string[];
  linkSystemLibs?: string[];
}

export interface ZigProjectStructure {
  buildZig: string;
  srcFiles: string[];
  testFiles: string[];
  dependencies: ZigModuleDependency[];
  buildSteps: ZigBuildStep[];
}

export const ZIG_OPTIMIZATION_LEVELS: OptimizationLevel[] = [
  'Debug',
  'ReleaseSafe',
  'ReleaseFast',
  'ReleaseSmall',
] as const;

export const ZIG_TARGET_ARCHITECTURES = [
  'x86_64-linux-gnu',
  'x86_64-windows-gnu',
  'x86_64-macos-none',
  'aarch64-linux-gnu',
  'aarch64-macos-none',
  'wasm32-freestanding-musl',
] as const;

export type ZigTargetArchitecture = (typeof ZIG_TARGET_ARCHITECTURES)[number];
