/**
 * Utility functions for the Zig MCP Server
 */

import type {
  MemoryPattern,
  TimeComplexityPattern,
  AllocationPattern,
  CodeGenerationRequirements,
} from './types.js';

export class ZigCodeAnalyzer {
  static readonly MEMORY_PATTERNS: MemoryPattern = {
    heapAlloc: /std\.(ArrayList|StringHashMap|AutoHashMap)/g,
    stackAlloc: /var\s+\w+\s*:\s*\[(\d+)\]/g,
    slices: /\[\](?:u8|i32|f64)/g,
  };

  static readonly TIME_COMPLEXITY_PATTERNS: TimeComplexityPattern = {
    loops: /(?:while|for)\s*\(/g,
    nestedLoops: /(?:while|for)[^{]*\{[^}]*(?:while|for)/g,
    recursion: /fn\s+\w+[^{]*\{[^}]*\w+\s*\([^)]*\)/g,
  };

  static readonly ALLOCATION_PATTERNS: AllocationPattern = {
    comptime: /comptime\s/g,
    arena: /std\.heap\.ArenaAllocator/g,
    fixedBuf: /std\.heap\.FixedBufferAllocator/g,
  };

  /**
   * Analyzes memory usage patterns in Zig code
   */
  static analyzeMemoryUsage(code: string): string {
    const heapAllocs = (code.match(this.MEMORY_PATTERNS.heapAlloc) || []).length;
    const stackAllocs = (code.match(this.MEMORY_PATTERNS.stackAlloc) || []).length;
    const sliceUsage = (code.match(this.MEMORY_PATTERNS.slices) || []).length;

    return `
- Heap Allocations: ${heapAllocs} detected
- Stack Allocations: ${stackAllocs} detected
- Slice Usage: ${sliceUsage} instances
- Memory Profile: ${heapAllocs > stackAllocs ? 'Heap-heavy' : 'Stack-optimized'}
    `.trim();
  }

  /**
   * Analyzes time complexity patterns
   */
  static analyzeTimeComplexity(code: string): string {
    const loops = (code.match(this.TIME_COMPLEXITY_PATTERNS.loops) || []).length;
    const nestedLoops = (code.match(this.TIME_COMPLEXITY_PATTERNS.nestedLoops) || []).length;
    const recursion = (code.match(this.TIME_COMPLEXITY_PATTERNS.recursion) || []).length;

    let complexity = 'O(1)';
    if (nestedLoops > 0) {
      complexity = 'O(n²)';
    } else if (loops > 0) {
      complexity = 'O(n)';
    }
    if (recursion > 0) {
      complexity += ' with recursive calls';
    }

    return `
- Estimated Complexity: ${complexity}
- Loop Count: ${loops}
- Nested Loops: ${nestedLoops}
- Recursive Patterns: ${recursion} detected
    `.trim();
  }

  /**
   * Analyzes allocation patterns
   */
  static analyzeAllocations(code: string): string {
    const comptimeUsage = (code.match(this.ALLOCATION_PATTERNS.comptime) || []).length;
    const arenaAlloc = (code.match(this.ALLOCATION_PATTERNS.arena) || []).length;
    const fixedBufAlloc = (code.match(this.ALLOCATION_PATTERNS.fixedBuf) || []).length;

    return `
- Comptime Evaluations: ${comptimeUsage}
- Arena Allocators: ${arenaAlloc}
- Fixed Buffer Allocators: ${fixedBufAlloc}
- Allocation Strategy: ${this.determineAllocStrategy(arenaAlloc, fixedBufAlloc)}
    `.trim();
  }

  private static determineAllocStrategy(arenaCount: number, fixedBufCount: number): string {
    if (arenaCount > 0 && fixedBufCount > 0) {
      return 'Mixed allocation strategy';
    }
    if (arenaCount > 0) {
      return 'Arena-based allocation';
    }
    if (fixedBufCount > 0) {
      return 'Fixed buffer allocation';
    }
    return 'Default allocator usage';
  }
}

export class ZigStyleChecker {
  /**
   * Comprehensively analyzes code style, naming conventions, and formatting
   */
  static analyzeCodeStyle(code: string): string {
    const issues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // === NAMING CONVENTIONS ===
    // Variable naming (snake_case)
    const badVariableNames = code.match(/\b[a-z]+[A-Z][a-zA-Z]*\s*[=:]/g);
    if (badVariableNames) {
      issues.push(
        `- Use snake_case for variables: found ${badVariableNames.length} camelCase variables`
      );
    }

    const pascalCaseVars = code.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\s*[=:]/g);
    if (pascalCaseVars) {
      issues.push(
        `- Use snake_case for variables: found ${pascalCaseVars.length} PascalCase variables`
      );
    }

    // Function naming
    const badFunctionNames = code.match(/(?:pub\s+)?fn\s+[a-z]+[A-Z][a-zA-Z]*\s*\(/g);
    if (badFunctionNames) {
      issues.push(
        `- Use snake_case for functions: found ${badFunctionNames.length} camelCase functions`
      );
    }

    // Type naming (PascalCase)
    const badTypeNames = code.match(/(?:const|var)\s+[a-z][a-zA-Z]*\s*=\s*(?:struct|enum|union)/g);
    if (badTypeNames) {
      issues.push(
        `- Use PascalCase for types: found ${badTypeNames.length} incorrectly named types`
      );
    }

    // Constant naming (ALL_CAPS or PascalCase for types)
    const constantPatterns = code.match(/const\s+[a-z][a-z_]*\s*[=:]/g);
    if (constantPatterns) {
      warnings.push(
        `- Consider SCREAMING_SNAKE_CASE for module-level constants: found ${constantPatterns.length} cases`
      );
    }

    // === FORMATTING AND STYLE ===
    // Whitespace issues
    const lines = code.split('\n');
    const trailingWhitespaceLines = lines.filter(
      (line, i) => line.match(/\s+$/) && i < lines.length - 1
    );
    if (trailingWhitespaceLines.length > 0) {
      issues.push(`- Remove trailing whitespace: found on ${trailingWhitespaceLines.length} lines`);
    }

    // Tabs vs spaces
    const tabLines = lines.filter(line => line.includes('\t'));
    if (tabLines.length > 0) {
      issues.push(`- Use 4 spaces instead of tabs: found on ${tabLines.length} lines`);
    }

    // Inconsistent indentation
    const indentationIssues = this.checkIndentation(lines);
    if (indentationIssues.length > 0) {
      issues.push(...indentationIssues);
    }

    // Line length (Zig recommends 100 chars)
    const longLines = lines.filter(line => line.length > 100);
    if (longLines.length > 0) {
      warnings.push(
        `- Consider breaking long lines: ${longLines.length} lines exceed 100 characters`
      );
    }

    const veryLongLines = lines.filter(line => line.length > 120);
    if (veryLongLines.length > 0) {
      issues.push(`- Break very long lines: ${veryLongLines.length} lines exceed 120 characters`);
    }

    // === DOCUMENTATION ===
    // Missing doc comments for public functions
    const publicFunctions = code.match(/pub\s+fn\s+\w+/g);
    const docComments = code.match(/\/\/[!/][^\n]*/g);
    if (publicFunctions && (!docComments || docComments.length < publicFunctions.length)) {
      const missing = publicFunctions.length - (docComments?.length || 0);
      issues.push(
        `- Add documentation for public functions: ${missing} functions lack doc comments`
      );
    }

    // Missing module-level documentation
    if (!code.match(/^\/\/!/m)) {
      warnings.push('- Add module-level documentation with //! comment');
    }

    // === SPACING AND OPERATORS ===
    // Operator spacing
    const badOperatorSpacing = code.match(/\w[+\-*/%=!<>]+\w/g);
    if (badOperatorSpacing) {
      warnings.push(`- Add spaces around operators: found ${badOperatorSpacing.length} instances`);
    }

    // Comma spacing
    const badCommaSpacing = code.match(/,\w/g);
    if (badCommaSpacing) {
      warnings.push(`- Add space after commas: found ${badCommaSpacing.length} instances`);
    }

    // Semicolon usage (discouraged in Zig except for specific cases)
    const unnecessarySemicolons = code.match(/;\s*$/gm);
    if (unnecessarySemicolons && unnecessarySemicolons.length > 3) {
      suggestions.push(
        `- Remove unnecessary semicolons: found ${unnecessarySemicolons.length} trailing semicolons`
      );
    }

    // === BRACE STYLE ===
    // Check for consistent brace placement
    const openBraceNewline = code.match(/\{\s*\n/g);
    const openBraceSameLine = code.match(/\S\s*\{/g);
    if (openBraceNewline && openBraceSameLine) {
      warnings.push('- Use consistent brace placement (Zig prefers same-line opening braces)');
    }

    // === COMMENT STYLE ===
    // Check for TODO/FIXME comments
    const todoComments = code.match(/\/\/\s*(TODO|FIXME|XXX|HACK|BUG)/gi);
    if (todoComments) {
      warnings.push(`- Address ${todoComments.length} TODO/FIXME comments before production`);
    }

    // Check for empty comments
    const emptyComments = code.match(/\/\/\s*$/gm);
    if (emptyComments) {
      suggestions.push(`- Remove ${emptyComments.length} empty comment lines`);
    }

    // === MODERN ZIG PATTERNS ===
    // Check for old-style array/slice syntax
    const oldArraySyntax = code.match(/\[\]u8\{/g);
    if (oldArraySyntax) {
      suggestions.push(
        `- Use modern array literal syntax: found ${oldArraySyntax.length} old-style arrays`
      );
    }

    // Check for deprecated patterns
    const deprecatedPatterns = this.checkDeprecatedPatterns(code);
    if (deprecatedPatterns.length > 0) {
      issues.push(...deprecatedPatterns);
    }

    // === IMPORT ORGANIZATION ===
    const importIssues = this.analyzeImports(code);
    if (importIssues.length > 0) {
      suggestions.push(...importIssues);
    }

    // === COMBINE RESULTS ===
    const result: string[] = [];

    if (issues.length > 0) {
      result.push('**Critical Issues:**', ...issues, '');
    }

    if (warnings.length > 0) {
      result.push('**Warnings:**', ...warnings, '');
    }

    if (suggestions.length > 0) {
      result.push('**Suggestions:**', ...suggestions);
    }

    if (result.length === 0) {
      return '✅ Code follows Zig style guidelines excellently';
    }

    return result.join('\n');
  }

  private static checkIndentation(lines: string[]): string[] {
    const issues: string[] = [];
    let inconsistentIndent = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') {
        continue;
      }

      const indent = line.match(/^(\s*)/)?.[1]?.length || 0;

      // Check for mixed spaces and tabs
      if (line.match(/^[\s]*\t[\s]*/) || line.match(/^[\s]*\t/)) {
        inconsistentIndent = true;
      }

      // Check for non-4-space indentation
      if (indent % 4 !== 0 && indent > 0) {
        inconsistentIndent = true;
      }
    }

    if (inconsistentIndent) {
      issues.push('- Use consistent 4-space indentation');
    }

    return issues;
  }

  private static checkDeprecatedPatterns(code: string): string[] {
    const deprecated: string[] = [];

    // Old Zig 0.10/0.11 patterns
    if (code.includes('.setTarget(')) {
      deprecated.push('- Replace .setTarget() with target parameter in addExecutable()');
    }

    if (code.includes('.setBuildMode(')) {
      deprecated.push('- Replace .setBuildMode() with optimize parameter in addExecutable()');
    }

    if (code.includes('std.build.Builder')) {
      deprecated.push('- Replace std.build.Builder with *std.Build in Zig 0.12+');
    }

    // Zig 0.15.2 migration patterns
    if (code.includes('.{ .path = ') && !code.includes('b.path(')) {
      deprecated.push(
        '- Modernize to Zig 0.15.2+: use b.path("file.zig") instead of .{ .path = "file.zig" }'
      );
    }

    if (code.includes('.addModule(') && !code.includes('root_module')) {
      deprecated.push(
        '- Modernize to Zig 0.15.2+: use .root_module.addImport() instead of .addModule()'
      );
    }

    if (code.includes('@import("build_options")')) {
      deprecated.push('- Consider using @import("config") for build options in modern Zig');
    }

    if (code.includes('std.fmt.allocPrintZ')) {
      deprecated.push('- Consider using std.fmt.allocPrint with explicit null termination');
    }

    return deprecated;
  }

  private static analyzeImports(code: string): string[] {
    const suggestions: string[] = [];

    // Check import organization
    const imports = code.match(/@import\([^)]+\)/g);
    if (imports && imports.length > 1) {
      // Check if imports are at the top
      const firstImportIndex = code.indexOf('@import');
      const nonCommentCodeBefore = code
        .slice(0, firstImportIndex)
        .replace(/\/\/[^\n]*\n?/g, '')
        .trim();

      if (nonCommentCodeBefore.length > 0) {
        suggestions.push('- Move imports to the top of the file');
      }
    }

    return suggestions;
  }

  /**
   * Comprehensively analyzes design patterns, idioms, and architectural concerns
   */
  static analyzePatterns(code: string): string {
    const antiPatterns: string[] = [];
    const improvements: string[] = [];
    const modernPatterns: string[] = [];
    const architecturalConcerns: string[] = [];

    // === MEMORY MANAGEMENT PATTERNS ===
    // Resource management
    if (code.includes('std.ArrayList') && !code.includes('deinit')) {
      antiPatterns.push('- Missing deinit() for ArrayList - potential memory leak');
    }

    if (code.includes('std.HashMap') && !code.includes('deinit')) {
      antiPatterns.push('- Missing deinit() for HashMap - potential memory leak');
    }

    // Arena allocator patterns
    if (code.includes('allocator.alloc') && !code.includes('defer') && !code.includes('deinit')) {
      antiPatterns.push('- Raw allocations without defer or deinit - memory leak risk');
    }

    // Arena allocator usage
    if (code.includes('std.heap.ArenaAllocator')) {
      improvements.push('✓ Good: Using ArenaAllocator for batch memory management');
    } else if (code.match(/allocator\.alloc.*allocator\.alloc/s)) {
      improvements.push('- Consider ArenaAllocator for multiple related allocations');
    }

    // === CONTROL FLOW PATTERNS ===
    // Loop patterns
    if (code.match(/while\s*\(true\)/)) {
      antiPatterns.push('- Infinite loops: use labeled breaks or better termination conditions');
    }

    // Early returns vs nested conditions
    const nestedIfCount = (code.match(/if\s*\([^)]*\)\s*\{[^}]*if\s*\(/g) || []).length;
    if (nestedIfCount > 2) {
      improvements.push(
        `- Consider early returns to reduce nesting (${nestedIfCount} nested conditions)`
      );
    }

    // Switch vs if-else chains
    const ifElseChains = code.match(
      /if\s*\([^)]*\)\s*\{[^}]*\}\s*else\s+if\s*\([^)]*\)\s*\{[^}]*\}\s*else\s+if/g
    );
    if (ifElseChains && ifElseChains.length > 0) {
      improvements.push('- Consider switch statements for multiple conditions on same variable');
    }

    // === ERROR HANDLING PATTERNS ===
    // Panic usage
    if (code.includes('@panic')) {
      antiPatterns.push('- Avoid @panic: use proper error handling with error unions');
    }

    // Unreachable usage
    if (code.includes('unreachable')) {
      const unreachableCount = (code.match(/unreachable/g) || []).length;
      if (unreachableCount > 2) {
        antiPatterns.push(
          `- Excessive unreachable usage (${unreachableCount}) - review error handling`
        );
      }
    }

    // Error handling patterns
    if (code.includes('!') && !code.includes('try') && !code.includes('catch')) {
      antiPatterns.push('- Error union types without try/catch - potential runtime panics');
    }

    // Proper error propagation
    if (code.match(/try\s+\w+\([^)]*\);\s*return/)) {
      improvements.push('✓ Good: Proper error propagation with try');
    }

    // === STRING AND FORMATTING PATTERNS ===
    // String formatting
    if (code.includes('std.fmt.allocPrint')) {
      improvements.push(
        '- Consider std.fmt.bufPrint for stack-based formatting when size is known'
      );
    }

    // String comparison
    if (code.match(/==\s*"[^"]*"/)) {
      improvements.push('- Use std.mem.eql(u8, str1, str2) for string comparisons');
    }

    // === COMPTIME PATTERNS ===
    // Comptime usage
    const comptimeUsage = (code.match(/comptime/g) || []).length;
    if (comptimeUsage > 0) {
      modernPatterns.push(
        `✓ Excellent: Using comptime (${comptimeUsage} instances) for compile-time evaluation`
      );
    }

    // Generic programming
    if (code.includes('anytype')) {
      modernPatterns.push('✓ Good: Using generic programming with anytype');
    }

    // Metaprogramming patterns
    if (code.includes('@TypeOf') || code.includes('@typeInfo')) {
      modernPatterns.push('✓ Advanced: Using type reflection for metaprogramming');
    }

    // === MODERN ZIG IDIOMS ===
    // Optional handling
    if (code.includes('if (optional) |value|')) {
      modernPatterns.push('✓ Excellent: Using optional unwrapping with if-let syntax');
    }

    // Switch on optionals/errors
    if (code.match(/switch\s*\([^)]*\)\s*\{[^}]*null[^}]*\}/)) {
      modernPatterns.push('✓ Good: Using switch for optional handling');
    }

    // Defer usage
    const deferCount = (code.match(/defer/g) || []).length;
    if (deferCount > 0) {
      modernPatterns.push(
        `✓ Excellent: Using defer (${deferCount} instances) for automatic cleanup`
      );
    }

    // === PERFORMANCE PATTERNS ===
    // Packed structs
    if (code.includes('packed struct')) {
      modernPatterns.push('✓ Good: Using packed structs for memory efficiency');
    }

    // Inline functions
    if (code.includes('inline fn')) {
      improvements.push(
        '- Review inline functions: ensure performance benefit justifies code size increase'
      );
    }

    // SIMD usage
    if (code.includes('@Vector') || code.includes('std.simd')) {
      modernPatterns.push('✓ Advanced: Using SIMD for vectorized operations');
    }

    // === CONCURRENCY PATTERNS ===
    // Async/await usage
    if (code.includes('async') || code.includes('await')) {
      modernPatterns.push('✓ Advanced: Using async/await for concurrent programming');
    }

    // Thread safety
    if (code.includes('std.Thread') && !code.includes('Mutex')) {
      antiPatterns.push(
        '- Multi-threading without synchronization primitives - race condition risk'
      );
    }

    // === ARCHITECTURAL PATTERNS ===
    // Module organization
    const exportCount = (code.match(/pub\s+(?:fn|const|var)/g) || []).length;
    const privateCount = (code.match(/(?:fn|const|var)\s+\w+/g) || []).length - exportCount;

    if (exportCount > privateCount && exportCount > 5) {
      architecturalConcerns.push('- High public API surface - consider reducing exported symbols');
    }

    // Single responsibility
    const functionCount = (code.match(/fn\s+\w+/g) || []).length;
    const avgLinesPerFunction = functionCount > 0 ? code.split('\n').length / functionCount : 0;

    if (avgLinesPerFunction > 50) {
      architecturalConcerns.push(
        '- Large functions detected - consider breaking into smaller units'
      );
    }

    // === TESTING PATTERNS ===
    // Test coverage indicators
    if (code.includes('test ') && !code.includes('testing.expect')) {
      improvements.push('- Add assertions to tests with testing.expect* functions');
    }

    // === BUILD AND INTEROP PATTERNS ===
    // C interop
    if (code.includes('@cImport') || code.includes('extern')) {
      modernPatterns.push('✓ Advanced: Using C interoperability');

      if (!code.includes('std.c.')) {
        improvements.push('- Consider using std.c namespace for C library functions');
      }
    }

    // === COMBINE RESULTS ===
    const result: string[] = [];

    if (antiPatterns.length > 0) {
      result.push('**Anti-patterns & Issues:**', ...antiPatterns, '');
    }

    if (improvements.length > 0) {
      result.push('**Improvement Opportunities:**', ...improvements, '');
    }

    if (modernPatterns.length > 0) {
      result.push('**Modern Zig Patterns Detected:**', ...modernPatterns, '');
    }

    if (architecturalConcerns.length > 0) {
      result.push('**Architectural Considerations:**', ...architecturalConcerns);
    }

    if (result.length === 0) {
      return '✅ No significant pattern issues detected - code follows modern Zig idioms';
    }

    return result.join('\n');
  }

  /**
   * Comprehensively analyzes safety considerations, memory safety, and security concerns
   */
  static analyzeSafety(code: string): string {
    const criticalIssues: string[] = [];
    const safetyWarnings: string[] = [];
    const bestPractices: string[] = [];
    const securityConcerns: string[] = [];

    // === MEMORY SAFETY ===
    // Uninitialized memory
    if (code.includes('undefined')) {
      criticalIssues.push('- Undefined memory usage - initialize variables explicitly');
    }

    // Buffer bounds checking
    const arrayAccess = code.match(/\[[^\]]*\]/g);
    if (arrayAccess && !code.includes('bounds check')) {
      const unsafeAccess = arrayAccess.filter(
        access =>
          (!access.includes('..') && // range syntax
            !access.includes('std.math.min') && // bounds checking
            access.includes('[i]')) ||
          access.includes('[idx]') ||
          /\[\w+\]/.test(access)
      );

      if (unsafeAccess.length > 0) {
        safetyWarnings.push(
          `- Potential bounds violations: ${unsafeAccess.length} unchecked array accesses`
        );
      }
    }

    // Pointer safety
    if (code.includes('@ptrCast')) {
      criticalIssues.push('- Pointer casting detected - verify type safety and alignment');
    }

    if (code.includes('@intToPtr') || code.includes('@ptrToInt')) {
      criticalIssues.push('- Raw pointer/integer conversions - ensure memory safety');
    }

    // Alignment concerns
    if (code.includes('@alignCast')) {
      safetyWarnings.push('- Alignment casting - verify target alignment requirements');
    }

    // === INTEGER SAFETY ===
    // Integer overflow/underflow
    if (code.includes('@intCast') && !code.includes('try')) {
      criticalIssues.push('- Unsafe integer casting - use std.math.cast() for safe conversions');
    }

    // Wrapping arithmetic
    if (code.includes('+%') || code.includes('-%') || code.includes('*%')) {
      safetyWarnings.push('- Wrapping arithmetic detected - ensure overflow behavior is intended');
    }

    // Division by zero
    if (code.match(/\/\s*\w+/) && !code.includes('!= 0')) {
      safetyWarnings.push('- Division operations without zero checks');
    }

    // === ERROR HANDLING SAFETY ===
    // Error union handling
    if (code.includes('!void') && !code.includes('try')) {
      criticalIssues.push('- Error-prone functions called without try/catch - potential crashes');
    }

    // Proper error propagation
    const errorTypes = code.match(/error\s*\{[^}]*\}/g);
    if (errorTypes && !code.includes('try')) {
      safetyWarnings.push('- Error types defined but no error handling visible');
    }

    // Catch-all error handling
    if (code.includes('catch |err|') && code.includes('unreachable')) {
      criticalIssues.push('- Catch-all with unreachable - may hide errors');
    }

    // === CONCURRENCY SAFETY ===
    // Thread safety
    if (code.includes('std.Thread') && !code.includes('std.Thread.Mutex')) {
      securityConcerns.push('- Multi-threading without synchronization - race condition risk');
    }

    // Shared mutable state
    if (code.includes('var ') && code.includes('std.Thread')) {
      safetyWarnings.push('- Shared mutable variables in multi-threaded context');
    }

    // Atomic operations
    if (code.includes('std.atomic')) {
      bestPractices.push('✓ Good: Using atomic operations for thread-safe access');
    }

    // === ALLOCATION SAFETY ===
    // Memory leaks
    const allocPatterns = (code.match(/\.alloc\(|\.create\(/g) || []).length;
    const deallocPatterns = (code.match(/\.free\(|\.destroy\(|deinit\(/g) || []).length;

    if (allocPatterns > deallocPatterns + 1) {
      criticalIssues.push(
        `- Potential memory leaks: ${allocPatterns} allocations vs ${deallocPatterns} deallocations`
      );
    }

    // Double-free protection
    if (code.includes('defer') && code.includes('deinit')) {
      bestPractices.push('✓ Excellent: Using defer for automatic cleanup');
    }

    // Use-after-free prevention
    if (code.match(/\w+\.deinit\(\);[\s\S]*\w+\./)) {
      safetyWarnings.push('- Potential use-after-free: operations after deinit()');
    }

    // === INPUT VALIDATION ===
    // User input handling
    if (code.includes('std.io.getStdIn') && !code.includes('trim')) {
      safetyWarnings.push('- User input without sanitization/validation');
    }

    // Buffer size validation
    if (code.includes('std.fmt.bufPrint') && !code.includes('.len')) {
      safetyWarnings.push('- Buffer operations without size validation');
    }

    // === NUMERIC SAFETY ===
    // Floating point comparisons
    if (code.match(/[0-9.]+\s*==\s*[0-9.]+/) && (code.includes('f32') || code.includes('f64'))) {
      safetyWarnings.push('- Direct floating-point equality comparisons - use epsilon comparison');
    }

    // Integer overflow in loops
    if (code.match(/for\s*\([^)]*\+\+[^)]*\)/)) {
      safetyWarnings.push('- C-style loops with increment - prefer Zig range syntax');
    }

    // === SECURITY CONSIDERATIONS ===
    // Cryptographic operations
    if (code.includes('std.crypto') && code.includes('rand')) {
      bestPractices.push('✓ Good: Using cryptographic random number generation');
    }

    // Timing attacks
    if (code.includes('std.crypto') && code.includes('std.mem.eql')) {
      safetyWarnings.push(
        '- String comparison in crypto context - consider constant-time comparison'
      );
    }

    // File operations security
    if (code.includes('std.fs.openFile') && !code.includes('sanitize')) {
      securityConcerns.push(
        '- File operations without path sanitization - directory traversal risk'
      );
    }

    // === PLATFORM SAFETY ===
    // Platform-specific code
    if (code.includes('@import("builtin")') && code.includes('os.tag')) {
      bestPractices.push('✓ Good: Platform-aware code with proper OS detection');
    }

    // Endianness concerns
    if (
      code.includes('@bitCast') &&
      (code.includes('u16') || code.includes('u32') || code.includes('u64'))
    ) {
      safetyWarnings.push('- Bit casting multi-byte integers - consider endianness implications');
    }

    // === RUNTIME SAFETY ANNOTATIONS ===
    // Runtime safety controls
    if (code.includes('@setRuntimeSafety(false)')) {
      criticalIssues.push('- Runtime safety disabled - ensure this is necessary and well-tested');
    }

    // Safety annotations
    if (code.includes('// SAFETY:')) {
      bestPractices.push('✓ Excellent: Documented safety assumptions with comments');
    }

    // === COMBINE RESULTS ===
    const result: string[] = [];

    if (criticalIssues.length > 0) {
      result.push('🚨 **Critical Safety Issues:**', ...criticalIssues, '');
    }

    if (securityConcerns.length > 0) {
      result.push('🔒 **Security Concerns:**', ...securityConcerns, '');
    }

    if (safetyWarnings.length > 0) {
      result.push('⚠️ **Safety Warnings:**', ...safetyWarnings, '');
    }

    if (bestPractices.length > 0) {
      result.push('✅ **Safety Best Practices:**', ...bestPractices);
    }

    if (result.length === 0) {
      return '✅ Code appears to follow safe programming practices';
    }

    // Add general safety recommendations
    result.push('', '📋 **General Safety Recommendations:**');
    result.push('- Use `zig build -Doptimize=Debug` during development for runtime safety checks');
    result.push('- Enable AddressSanitizer: `zig build -Doptimize=Debug -fsanitize=address`');
    result.push('- Consider fuzzing for user-facing input handling');
    result.push('- Add comprehensive test coverage for error conditions');
    result.push('- Document safety assumptions and invariants');

    return result.join('\n');
  }

  /**
   * Comprehensively analyzes performance characteristics, optimization opportunities, and efficiency concerns
   */
  static analyzePerformance(code: string): string {
    const hotspots: string[] = [];
    const optimizations: string[] = [];
    const benchmarkSuggestions: string[] = [];
    const memoryEfficiency: string[] = [];
    const compiletimeOptimizations: string[] = [];

    // === ALGORITHMIC COMPLEXITY ===
    // Nested loops analysis
    const nestedLoopDepth = this.calculateNestedLoopDepth(code);
    if (nestedLoopDepth >= 3) {
      hotspots.push(
        `- Deep nested loops detected (depth ${nestedLoopDepth}) - O(n³) or worse complexity`
      );
    } else if (nestedLoopDepth === 2) {
      optimizations.push(
        '- Nested loops present - consider algorithm optimization for large datasets'
      );
    }

    // Hash map usage in loops
    if (code.match(/for\s*\([^)]*\)\s*\{[^}]*HashMap[^}]*\}/s)) {
      optimizations.push('- HashMap operations in loops - consider batching or caching lookups');
    }

    // String operations in loops
    if (code.match(/for\s*\([^)]*\)\s*\{[^}]*std\.fmt[^}]*\}/s)) {
      hotspots.push('- String formatting in loops - major performance bottleneck');
    }

    // === MEMORY ALLOCATION PATTERNS ===
    // ArrayList capacity optimization
    if (code.includes('std.ArrayList') && !code.match(/initCapacity|ensureCapacity/)) {
      optimizations.push('- Pre-allocate ArrayList capacity when size is predictable');
    }

    // Frequent small allocations
    const allocCount = (code.match(/\.alloc\(/g) || []).length;
    if (allocCount > 5) {
      memoryEfficiency.push(
        `- Many allocations detected (${allocCount}) - consider arena allocator`
      );
    }

    // String building inefficiency
    if (code.includes('std.fmt.allocPrint') && code.includes('++')) {
      hotspots.push('- String concatenation with allocPrint - use ArrayList(u8) or fixed buffer');
    }

    // === COMPTIME OPTIMIZATION OPPORTUNITIES ===
    // Constant expressions
    const constantMath = code.match(/\d+\s*[+\-*]/g);
    if (constantMath && constantMath.length > 2) {
      compiletimeOptimizations.push(
        `- ${constantMath.length} constant expressions - use comptime evaluation`
      );
    }

    // Type computations
    if (code.includes('@sizeOf') || code.includes('@alignOf')) {
      compiletimeOptimizations.push('✓ Good: Using compile-time type introspection');
    }

    // Comptime usage analysis
    const comptimeCount = (code.match(/comptime/g) || []).length;
    if (comptimeCount === 0 && code.includes('for')) {
      optimizations.push('- Consider comptime loops for compile-time known iterations');
    } else if (comptimeCount > 0) {
      compiletimeOptimizations.push(`✓ Excellent: ${comptimeCount} comptime optimizations present`);
    }

    // === DATA STRUCTURE EFFICIENCY ===
    // Packed structs for memory efficiency
    if (code.includes('struct {') && !code.includes('packed')) {
      const structCount = (code.match(/struct\s*\{/g) || []).length;
      memoryEfficiency.push(
        `- ${structCount} unpacked structs - consider packed structs for memory efficiency`
      );
    }

    // Array of Structs vs Struct of Arrays
    if (code.includes('[]struct') || code.includes('ArrayList(struct')) {
      optimizations.push(
        '- Array of Structs detected - consider Struct of Arrays for better cache locality'
      );
    }

    // === SIMD AND VECTORIZATION ===
    // SIMD opportunities
    if (code.match(/for\s*\([^)]*\)\s*\{[^}]*[+*/-][^}]*\}/s) && !code.includes('@Vector')) {
      optimizations.push('- Math operations in loops - consider SIMD vectorization with @Vector');
    }

    // Vector operations
    if (code.includes('@Vector')) {
      compiletimeOptimizations.push('✓ Advanced: Using SIMD vectorization for performance');
    }

    // === FUNCTION CALL OPTIMIZATION ===
    // Inline function usage
    if (code.includes('inline fn')) {
      const inlineCount = (code.match(/inline fn/g) || []).length;
      optimizations.push(
        `- ${inlineCount} inline functions - verify performance benefit vs code size`
      );
    }

    // Function call overhead in hot loops
    if (code.match(/for\s*\([^)]*\)\s*\{[^}]*\w+\([^)]*\);[^}]*\}/s)) {
      optimizations.push('- Function calls in loops - consider inlining for hot paths');
    }

    // === I/O AND SYSTEM CALLS ===
    // I/O in loops
    if (code.match(/for\s*\([^)]*\)\s*\{[^}]*std\.(?:io|fs)[^}]*\}/s)) {
      hotspots.push('- I/O operations in loops - major performance bottleneck, batch operations');
    }

    // Unbuffered I/O
    if (code.includes('std.io.getStdOut().print') && !code.includes('BufferedWriter')) {
      optimizations.push('- Unbuffered output - use std.io.BufferedWriter for better performance');
    }

    // === BRANCH PREDICTION ===
    // Predictable branches
    if (code.includes('@branchHint')) {
      compiletimeOptimizations.push('✓ Advanced: Using branch hints for optimization');
    }

    // Switch vs if-else performance
    const ifElseChains = (code.match(/else\s+if/g) || []).length;
    if (ifElseChains > 3) {
      optimizations.push(`- Long if-else chain (${ifElseChains}) - switch statement may be faster`);
    }

    // === FLOATING POINT OPTIMIZATION ===
    // Fast math opportunities
    if (code.includes('f32') || code.includes('f64')) {
      optimizations.push('- Floating point operations - consider @setFloatMode() for performance');
    }

    // Integer vs floating point
    if (code.match(/f\d+.*[+*/-].*f\d+/) && code.includes('round')) {
      optimizations.push(
        '- Floating point with rounding - consider integer arithmetic where possible'
      );
    }

    // === CACHE EFFICIENCY ===
    // Cache line considerations
    if (code.includes('struct {') && code.match(/\w+\s*:\s*u8/)) {
      memoryEfficiency.push('- Small fields in structs - consider packing for cache efficiency');
    }

    // Memory access patterns
    if (code.match(/\[\w+\]\[\w+\]/)) {
      optimizations.push('- Multi-dimensional array access - consider access pattern optimization');
    }

    // === SPECIFIC ZIG OPTIMIZATIONS ===
    // Error union performance
    if (code.includes('!') && code.includes('catch')) {
      optimizations.push('- Error unions - use @errorReturnTrace(null) in release builds');
    }

    // Optional performance
    if (code.includes('?') && code.includes('orelse')) {
      optimizations.push('- Optional types - null checks have minimal overhead in Zig');
    }

    // === PROFILING AND BENCHMARKING ===
    // Profiling suggestions
    if (!code.includes('std.time')) {
      benchmarkSuggestions.push('- Add timing measurements with std.time.nanoTimestamp()');
    }

    // Built-in profiling
    benchmarkSuggestions.push('- Use `zig build -Doptimize=ReleaseFast` for production benchmarks');
    benchmarkSuggestions.push(
      '- Consider `zig build -Dcpu=native` for target-specific optimization'
    );
    benchmarkSuggestions.push('- Profile with `perf record` on Linux for detailed analysis');

    // === BUILD SYSTEM OPTIMIZATIONS ===
    compiletimeOptimizations.push('- Use `--strip` flag for smaller binaries in production');
    compiletimeOptimizations.push(
      '- Consider `--release=safe` for optimized builds with safety checks'
    );

    // === COMBINE RESULTS ===
    const result: string[] = [];

    if (hotspots.length > 0) {
      result.push('🔥 **Performance Hotspots:**', ...hotspots, '');
    }

    if (optimizations.length > 0) {
      result.push('⚡ **Optimization Opportunities:**', ...optimizations, '');
    }

    if (memoryEfficiency.length > 0) {
      result.push('🧠 **Memory Efficiency:**', ...memoryEfficiency, '');
    }

    if (compiletimeOptimizations.length > 0) {
      result.push('⏱️ **Compile-time Optimizations:**', ...compiletimeOptimizations, '');
    }

    if (benchmarkSuggestions.length > 0) {
      result.push('📊 **Benchmarking & Profiling:**', ...benchmarkSuggestions);
    }

    if (result.length === 0) {
      return '✅ No immediate performance concerns detected';
    }

    // Add performance analysis summary
    const codeLength = code.split('\n').length;
    const complexityEstimate = this.estimateComplexity(code);

    result.push('', '📈 **Performance Analysis Summary:**');
    result.push(`- Code size: ${codeLength} lines`);
    result.push(`- Estimated complexity: ${complexityEstimate}`);
    result.push(
      `- Optimization potential: ${this.getOptimizationPotential(hotspots, optimizations)}`
    );

    return result.join('\n');
  }

  private static calculateNestedLoopDepth(code: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    let inLoop = false;

    const lines = code.split('\n');

    for (const line of lines) {
      if (line.match(/\b(?:for|while)\s*\(/)) {
        currentDepth++;
        inLoop = true;
        maxDepth = Math.max(maxDepth, currentDepth);
      }

      if (line.includes('}') && inLoop) {
        currentDepth = Math.max(0, currentDepth - 1);
        if (currentDepth === 0) {
          inLoop = false;
        }
      }
    }

    return maxDepth;
  }

  private static estimateComplexity(code: string): string {
    const loops = (code.match(/(?:for|while)\s*\(/g) || []).length;
    const nestedLoops = (code.match(/(?:for|while)[^{]*\{[^}]*(?:for|while)/g) || []).length;
    const recursion = (code.match(/fn\s+\w+[^{]*\{[^}]*\w+\s*\([^)]*\)/g) || []).length;

    if (nestedLoops > 1) {
      return 'O(n³) or higher';
    }
    if (nestedLoops > 0) {
      return 'O(n²)';
    }
    if (loops > 0) {
      return 'O(n)';
    }
    if (recursion > 0) {
      return 'O(log n) to O(n) - depends on recursion';
    }
    return 'O(1)';
  }

  private static getOptimizationPotential(hotspots: string[], optimizations: string[]): string {
    if (hotspots.length > 2) {
      return 'High - significant improvements possible';
    }
    if (optimizations.length > 3) {
      return 'Medium - several improvements available';
    }
    if (optimizations.length > 0) {
      return 'Low - minor improvements possible';
    }
    return 'Minimal - code is well-optimized';
  }

  /**
   * Analyzes concurrency patterns, thread safety, and async programming
   */
  static analyzeConcurrency(code: string): string {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const patterns: string[] = [];

    // === ASYNC/AWAIT PATTERNS ===
    if (code.includes('async') || code.includes('await')) {
      patterns.push('✓ Using async/await for concurrent programming');

      if (!code.includes('suspend') && !code.includes('resume')) {
        recommendations.push('- Consider explicit suspend/resume for fine-grained async control');
      }
    }

    // === THREAD SAFETY ===
    if (code.includes('std.Thread')) {
      patterns.push('✓ Multi-threading implementation detected');

      if (!code.includes('Mutex') && !code.includes('Atomic')) {
        issues.push('- Multi-threading without synchronization primitives - race condition risk');
      }
    }

    // === SYNCHRONIZATION PRIMITIVES ===
    if (code.includes('std.Thread.Mutex')) {
      patterns.push('✓ Using mutexes for thread synchronization');
    }

    if (code.includes('std.atomic')) {
      patterns.push('✓ Using atomic operations for lock-free programming');
    }

    if (code.includes('std.Thread.Condition')) {
      patterns.push('✓ Advanced: Using condition variables for thread coordination');
    }

    // === SHARED STATE ANALYSIS ===
    const globalVars = code.match(/var\s+\w+\s*:/g);
    if (globalVars && code.includes('std.Thread')) {
      issues.push(
        `- ${globalVars.length} global variables in multi-threaded context - ensure thread safety`
      );
    }

    // === DATA RACES ===
    if (code.match(/var\s+\w+.*=.*\w+.*\+\+/) && code.includes('std.Thread')) {
      issues.push('- Potential data race: non-atomic increment operations');
    }

    const result = this.formatAnalysisResults('Concurrency Analysis', {
      issues,
      recommendations,
      patterns,
    });
    return result || '✅ No concurrency patterns detected';
  }

  /**
   * Analyzes metaprogramming, comptime evaluation, and generic programming
   */
  static analyzeMetaprogramming(code: string): string {
    const advanced: string[] = [];
    const suggestions: string[] = [];
    const opportunities: string[] = [];

    // === COMPTIME EVALUATION ===
    const comptimeCount = (code.match(/comptime/g) || []).length;
    if (comptimeCount > 0) {
      advanced.push(
        `✓ Excellent: ${comptimeCount} comptime evaluations for compile-time optimization`
      );
    }

    // === TYPE MANIPULATION ===
    if (code.includes('@TypeOf') || code.includes('@typeInfo')) {
      advanced.push('✓ Advanced: Using type reflection for metaprogramming');
    }

    if (code.includes('@fieldParentPtr') || code.includes('@offsetOf')) {
      advanced.push('✓ Expert: Low-level type introspection');
    }

    // === GENERIC PROGRAMMING ===
    if (code.includes('anytype')) {
      advanced.push('✓ Using generic programming with anytype parameters');

      if (!code.includes('@TypeOf')) {
        suggestions.push('- Consider type constraints with @TypeOf for better error messages');
      }
    }

    // === CODE GENERATION ===
    if (code.includes('@compileError')) {
      advanced.push('✓ Using compile-time error generation');
    }

    if (code.includes('@compileLog')) {
      suggestions.push('- Remove @compileLog statements before production');
    }

    // === TEMPLATE METAPROGRAMMING ===
    if (code.match(/comptime\s+\w+\s*:\s*type/)) {
      advanced.push('✓ Expert: Compile-time type generation');
    }

    // === OPTIMIZATION OPPORTUNITIES ===
    const constantExpressions = code.match(/\d+\s*[+\-*]/g);
    if (constantExpressions && !code.includes('comptime')) {
      opportunities.push(
        `- ${constantExpressions.length} constant expressions could use comptime evaluation`
      );
    }

    const result = this.formatAnalysisResults('Metaprogramming Analysis', {
      advanced,
      suggestions,
      opportunities,
    });
    return result || '✅ Basic metaprogramming - consider advanced patterns for optimization';
  }

  /**
   * Analyzes testing patterns, coverage, and quality assurance
   */
  static analyzeTesting(code: string): string {
    const strengths: string[] = [];
    const gaps: string[] = [];
    const suggestions: string[] = [];

    // === TEST PRESENCE ===
    const testCount = (code.match(/test\s+"[^"]*"/g) || []).length;
    if (testCount > 0) {
      strengths.push(`✓ ${testCount} tests present`);
    } else {
      gaps.push('- No tests detected - add comprehensive test coverage');
    }

    // === ASSERTION PATTERNS ===
    if (code.includes('testing.expect')) {
      strengths.push('✓ Using proper test assertions');
    } else if (testCount > 0) {
      gaps.push('- Tests without assertions - add testing.expect* calls');
    }

    // === ERROR TESTING ===
    if (code.includes('testing.expectError')) {
      strengths.push('✓ Testing error conditions');
    } else if (code.includes('!')) {
      suggestions.push('- Add error condition testing with testing.expectError');
    }

    // === EDGE CASE TESTING ===
    if (code.includes('edge') || code.includes('boundary')) {
      strengths.push('✓ Edge case testing detected');
    }

    // === PERFORMANCE TESTING ===
    if (code.includes('std.time') && code.includes('test')) {
      strengths.push('✓ Performance testing present');
    }

    const result = this.formatAnalysisResults('Testing Analysis', { strengths, gaps, suggestions });
    return result || '✅ No testing patterns analyzed';
  }

  /**
   * Analyzes build system integration and project structure
   */
  static analyzeBuildSystem(code: string): string {
    const insights: string[] = [];
    const recommendations: string[] = [];

    // === BUILD DEPENDENCIES ===
    if (code.includes('@import("build')) {
      insights.push('✓ Build system integration detected');
    }

    // === CONDITIONAL COMPILATION ===
    if (code.includes('@import("builtin")')) {
      insights.push('✓ Platform-aware compilation');
    }

    // === FEATURE FLAGS ===
    if (code.includes('@import("config")') || code.includes('build_options')) {
      insights.push('✓ Using build-time configuration');
    }

    // === CROSS-COMPILATION ===
    if (code.includes('builtin.target') || code.includes('builtin.os')) {
      insights.push('✓ Cross-compilation support');
    }

    const result = this.formatAnalysisResults('Build System Analysis', {
      insights,
      recommendations,
    });
    return result || '✅ No build system patterns detected';
  }

  /**
   * Analyzes interoperability with C/C++ and other languages
   */
  static analyzeInterop(code: string): string {
    const patterns: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // === C INTEROP ===
    if (code.includes('@cImport')) {
      patterns.push('✓ C library integration with @cImport');

      if (!code.includes('std.c.')) {
        suggestions.push('- Consider using std.c namespace for standard C functions');
      }
    }

    if (code.includes('extern')) {
      patterns.push('✓ External function declarations');
    }

    if (code.includes('export')) {
      patterns.push('✓ Exporting functions for external use');
    }

    // === CALLING CONVENTIONS ===
    if (code.includes('callconv(.C)')) {
      patterns.push('✓ Explicit C calling convention');
    }

    // === MEMORY LAYOUT ===
    if (code.includes('extern struct') || code.includes('packed struct')) {
      patterns.push('✓ C-compatible struct layout');
    }

    // === FFI SAFETY ===
    if (code.includes('@cImport') && !code.includes('try')) {
      warnings.push('- C functions may fail - consider error handling');
    }

    const result = this.formatAnalysisResults('Interoperability Analysis', {
      patterns,
      warnings,
      suggestions,
    });
    return result || '✅ No interoperability patterns detected';
  }

  /**
   * Analyzes code metrics, complexity, and maintainability
   */
  static analyzeCodeMetrics(code: string): string {
    const lines = code.split('\n');
    const metrics: string[] = [];
    const concerns: string[] = [];

    // === SIZE METRICS ===
    const totalLines = lines.length;
    const codeLines = lines.filter(line => line.trim() && !line.trim().startsWith('//')).length;
    const commentLines = lines.filter(line => line.trim().startsWith('//')).length;

    metrics.push(`- Total lines: ${totalLines}`);
    metrics.push(`- Code lines: ${codeLines}`);
    metrics.push(`- Comment lines: ${commentLines}`);
    metrics.push(`- Documentation ratio: ${((commentLines / totalLines) * 100).toFixed(1)}%`);

    // === FUNCTION METRICS ===
    const functions = code.match(/fn\s+\w+/g) || [];
    metrics.push(`- Function count: ${functions.length}`);

    if (functions.length > 0) {
      const avgLinesPerFunction = Math.round(codeLines / functions.length);
      metrics.push(`- Average lines per function: ${avgLinesPerFunction}`);

      if (avgLinesPerFunction > 50) {
        concerns.push('- Large functions detected - consider decomposition');
      }
    }

    // === COMPLEXITY METRICS ===
    const conditionals = (code.match(/\b(if|switch|while|for)\b/g) || []).length;
    const complexity = Math.floor(conditionals / Math.max(functions.length, 1));

    metrics.push(`- Cyclomatic complexity: ~${complexity} per function`);

    if (complexity > 10) {
      concerns.push('- High complexity - consider simplifying control flow');
    }

    // === PUBLIC API SURFACE ===
    const publicFns = (code.match(/pub\s+fn/g) || []).length;
    const publicTypes = (code.match(/pub\s+const\s+\w+\s*=\s*(?:struct|enum|union)/g) || []).length;

    metrics.push(`- Public functions: ${publicFns}`);
    metrics.push(`- Public types: ${publicTypes}`);

    const result = this.formatAnalysisResults('Code Metrics', { metrics, concerns });
    return result || '✅ Code metrics within reasonable bounds';
  }

  /**
   * Analyzes modern Zig 0.15.2+ specific patterns and features
   */
  static analyzeModernZigPatterns(code: string): string {
    const modern: string[] = [];
    const upgrades: string[] = [];
    const deprecations: string[] = [];

    // === ZIG 0.15.2+ PATTERNS ===
    if (code.includes('b.path(')) {
      modern.push('✓ Using modern Zig 0.15.2+ b.path() for file references');
    }

    if (code.includes('root_module.addImport(')) {
      modern.push('✓ Using modern Zig 0.15.2+ module system with root_module.addImport()');
    }

    if (code.includes('.{ .path = ') || code.includes('.{ .name = ')) {
      if (!code.includes('b.path(')) {
        upgrades.push('- Upgrade to Zig 0.15.2+: use b.path() instead of .{ .path = }');
      } else {
        modern.push('✓ Using modern struct initialization syntax');
      }
    }

    if (code.includes('b.addExecutable(.{')) {
      modern.push('✓ Modern build.zig API');
    }

    // === DEPRECATED PATTERNS ===
    if (code.includes('setTarget(') || code.includes('setBuildMode(')) {
      deprecations.push('- Update to Zig 0.12+ build API: use .target and .optimize parameters');
    }

    if (code.includes('std.build.Builder')) {
      deprecations.push('- Replace std.build.Builder with *std.Build');
    }

    if (code.includes('.addModule(') && !code.includes('root_module')) {
      deprecations.push(
        '- Upgrade to Zig 0.15.2+: use .root_module.addImport() instead of .addModule()'
      );
    }

    // === STANDARD LIBRARY UPDATES ===
    if (code.includes('std.fmt.allocPrintZ')) {
      upgrades.push('- Consider std.fmt.allocPrint with explicit null termination');
    }

    const result = this.formatAnalysisResults('Modern Zig Analysis', {
      modern,
      upgrades,
      deprecations,
    });
    return result || '✅ Code uses modern Zig patterns';
  }

  /**
   * Helper method to format analysis results consistently
   */
  private static formatAnalysisResults(title: string, sections: Record<string, string[]>): string {
    const results: string[] = [];

    for (const [sectionName, items] of Object.entries(sections)) {
      if (items.length > 0) {
        const emoji = this.getSectionEmoji(sectionName);
        results.push(`${emoji} **${this.capitalizeFirst(sectionName)}:**`, ...items, '');
      }
    }

    return results.length > 0 ? results.join('\n').trim() : '';
  }

  private static getSectionEmoji(sectionName: string): string {
    const emojiMap: Record<string, string> = {
      issues: '🚨',
      warnings: '⚠️',
      concerns: '⚠️',
      gaps: '❌',
      deprecations: '⚠️',
      recommendations: '💡',
      suggestions: '💡',
      upgrades: '⬆️',
      opportunities: '🎯',
      patterns: '✅',
      strengths: '✅',
      insights: '📊',
      advanced: '🚀',
      modern: '✨',
      metrics: '📈',
    };

    return emojiMap[sectionName] || '📋';
  }

  private static capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export class ZigCodeGenerator {
  /**
   * Parses requirements from natural language prompts
   */
  static parseRequirements(prompt: string, context?: string): CodeGenerationRequirements {
    const requirements: CodeGenerationRequirements = {
      features: new Set<string>(),
      errorHandling: false,
      testing: false,
      performance: false,
    };

    const keywords = {
      features: ['create', 'implement', 'build', 'function', 'struct', 'type', 'enum', 'union'],
      errorHandling: ['error', 'handle', 'catch', 'try', 'fail'],
      testing: ['test', 'verify', 'check', 'validate'],
      performance: ['fast', 'optimize', 'performance', 'efficient', 'speed'],
    };

    const fullText = [prompt, context].filter(Boolean).join(' ').toLowerCase();

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => fullText.includes(word))) {
        if (category === 'features') {
          words.forEach(word => {
            if (fullText.includes(word)) {
              requirements.features.add(word);
            }
          });
        } else {
          requirements[category as keyof Omit<CodeGenerationRequirements, 'features'>] = true;
        }
      }
    }

    return requirements;
  }

  /**
   * Generates Zig code based on requirements
   */
  static generateZigCode(requirements: CodeGenerationRequirements): string {
    const hasFeature = (feature: string) => requirements.features.has(feature);

    let code = '//! Generated Zig code\n\n';

    // Add standard imports
    code += 'const std = @import("std");\n';

    // Add testing import if needed
    if (requirements.testing) {
      code += 'const testing = std.testing;\n';
    }

    code += '\n';

    // Add error set if needed
    if (requirements.errorHandling) {
      code +=
        'const Error = error{\n    InvalidInput,\n    OutOfMemory,\n    InvalidOperation,\n};\n\n';
    }

    // Generate main functionality
    if (hasFeature('struct')) {
      code += this.generateStruct(requirements);
    } else if (hasFeature('enum')) {
      code += this.generateEnum(requirements);
    } else if (hasFeature('union')) {
      code += this.generateUnion(requirements);
    } else if (hasFeature('function') || hasFeature('implement')) {
      code += this.generateFunction(requirements);
    } else {
      // Default to function
      code += this.generateFunction(requirements);
    }

    // Add tests if requested
    if (requirements.testing) {
      code += '\n\n' + this.generateTests(requirements);
    }

    return code;
  }

  private static generateStruct(requirements: CodeGenerationRequirements): string {
    const errorReturn = requirements.errorHandling ? 'Error!' : '';

    return `pub const MyStruct = struct {
    data: []const u8,
    allocator: std.mem.Allocator,
    capacity: usize,

    const Self = @This();

    /// Initialize a new instance
    pub fn init(allocator: std.mem.Allocator) ${errorReturn}Self {
        return Self{
            .data = &[_]u8{},
            .allocator = allocator,
            .capacity = 0,
        };
    }

    /// Clean up resources
    pub fn deinit(self: *Self) void {
        if (self.data.len > 0) {
            self.allocator.free(self.data);
        }
    }

    /// Process data
    pub fn process(self: *Self, input: []const u8) ${errorReturn}void {
        ${requirements.errorHandling ? 'if (input.len == 0) return Error.InvalidInput;' : ''}
        // Implementation here
        _ = self;
    }
};`;
  }

  private static generateEnum(requirements: CodeGenerationRequirements): string {
    return `pub const MyEnum = enum {
    variant_a,
    variant_b,
    variant_c,

    const Self = @This();

    /// Convert to string representation
    pub fn toString(self: Self) []const u8 {
        return switch (self) {
            .variant_a => "Variant A",
            .variant_b => "Variant B", 
            .variant_c => "Variant C",
        };
    }

    /// Parse from string
    pub fn fromString(str: []const u8) ${requirements.errorHandling ? 'Error!' : '?'}Self {
        if (std.mem.eql(u8, str, "variant_a")) return .variant_a;
        if (std.mem.eql(u8, str, "variant_b")) return .variant_b;
        if (std.mem.eql(u8, str, "variant_c")) return .variant_c;
        return ${requirements.errorHandling ? 'Error.InvalidInput' : 'null'};
    }
};`;
  }

  private static generateUnion(_requirements: CodeGenerationRequirements): string {
    return `pub const MyUnion = union(enum) {
    integer: i32,
    float: f64,
    string: []const u8,

    const Self = @This();

    /// Get type tag as string
    pub fn getTypeName(self: Self) []const u8 {
        return switch (self) {
            .integer => "integer",
            .float => "float",
            .string => "string",
        };
    }

    /// Format for printing
    pub fn format(
        self: Self,
        comptime fmt: []const u8,
        options: std.fmt.FormatOptions,
        writer: anytype,
    ) !void {
        _ = fmt;
        _ = options;
        
        switch (self) {
            .integer => |val| try writer.print("{d}", .{val}),
            .float => |val| try writer.print("{d}", .{val}),
            .string => |val| try writer.print("{s}", .{val}),
        }
    }
};`;
  }

  private static generateFunction(requirements: CodeGenerationRequirements): string {
    const fnHeader = requirements.errorHandling
      ? 'pub fn process(input: []const u8) Error!void'
      : 'pub fn process(input: []const u8) void';

    return `${fnHeader} {
    ${requirements.errorHandling ? 'if (input.len == 0) return Error.InvalidInput;' : ''}
    
    // Process the input
    for (input, 0..) |byte, i| {
        // Example processing logic
        _ = byte;
        _ = i;
    }
    
    ${requirements.performance ? '// Optimized for performance\n    // Consider using SIMD operations for large datasets' : ''}
}`;
  }

  private static generateTests(requirements: CodeGenerationRequirements): string {
    return `test "basic functionality" {
    ${requirements.errorHandling ? 'try testing.expectError(Error.InvalidInput, process(""));' : ''}
    
    // Test normal operation
    try process("test input");
    
    // Add more comprehensive test cases
    try testing.expect(true); // Placeholder assertion
}

test "edge cases" {
    // Test edge cases
    try process("");
    try testing.expect(true); // Placeholder assertion
}`;
  }
}

/**
 * Logger utility for consistent logging across the application
 */
export class Logger {
  private static formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  static info(message: string): void {
    console.error(this.formatMessage('INFO', message));
  }

  static warn(message: string): void {
    console.error(this.formatMessage('WARN', message));
  }

  static error(message: string, error?: Error): void {
    const errorMsg = error ? `${message}: ${error.message}` : message;
    console.error(this.formatMessage('ERROR', errorMsg));
  }

  static debug(message: string): void {
    if (process.env.DEBUG) {
      console.error(this.formatMessage('DEBUG', message));
    }
  }
}
