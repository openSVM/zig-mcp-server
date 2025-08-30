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
   * Analyzes code style and naming conventions
   */
  static analyzeCodeStyle(code: string): string {
    const issues: string[] = [];

    // Check naming conventions
    if (code.match(/[A-Z][a-z]+(?:[A-Z][a-z]+)*\s*=/)) {
      issues.push('- Use snake_case for variable names instead of PascalCase');
    }
    if (code.match(/[a-z]+[A-Z][a-z]+\s*=/)) {
      issues.push('- Use snake_case for variable names instead of camelCase');
    }

    // Check formatting
    if (code.match(/\s+$/m)) {
      issues.push('- Remove trailing whitespace');
    }
    if (code.match(/\t/)) {
      issues.push('- Use spaces instead of tabs for indentation');
    }

    // Check documentation
    if (!code.match(/\/\/[!/] /)) {
      issues.push('- Add documentation comments for public declarations');
    }

    // Check for long lines (>100 characters)
    const longLines = code.split('\n').filter(line => line.length > 100);
    if (longLines.length > 0) {
      issues.push(`- Consider breaking long lines (${longLines.length} lines >100 chars)`);
    }

    // Check for TODO/FIXME comments
    if (code.match(/\/\/\s*(TODO|FIXME|XXX)/i)) {
      issues.push('- Address TODO/FIXME comments before production');
    }

    return issues.length > 0 ? issues.join('\n') : '- Code follows Zig style guidelines';
  }

  /**
   * Analyzes design patterns and suggests improvements
   */
  static analyzePatterns(code: string): string {
    const patterns: string[] = [];

    // Check for common patterns
    if (code.includes('std.ArrayList') && !code.includes('deinit')) {
      patterns.push('- Consider implementing deinit for proper cleanup');
    }
    if (code.match(/while\s*\(true\)/)) {
      patterns.push('- Consider using labeled breaks for clearer loop control');
    }
    if (code.includes('std.fmt.allocPrint')) {
      patterns.push('- Consider using formatters or bufPrint when possible');
    }
    if (code.includes('@panic')) {
      patterns.push('- Consider using proper error handling instead of @panic');
    }
    if (code.match(/std\.mem\.eql\(u8,/)) {
      patterns.push('- Consider using std.mem.eql for string comparisons');
    }

    return patterns.length > 0 ? patterns.join('\n') : '- No significant pattern issues detected';
  }

  /**
   * Analyzes safety considerations
   */
  static analyzeSafety(code: string): string {
    const safety: string[] = [];

    // Check error handling
    if (code.includes('!void') && !code.includes('try')) {
      safety.push('- Add error handling for functions that can fail');
    }
    if (code.includes('undefined')) {
      safety.push('- Initialize variables explicitly instead of using undefined');
    }
    if (code.includes('@ptrCast')) {
      safety.push('- Review pointer casts for safety implications');
    }
    if (code.includes('@intCast') && !code.includes('try')) {
      safety.push('- Consider using safe integer casting with try');
    }
    if (code.includes('unreachable')) {
      safety.push('- Ensure unreachable paths are truly unreachable');
    }

    return safety.length > 0 ? safety.join('\n') : '- Code appears to follow safe practices';
  }

  /**
   * Analyzes performance considerations
   */
  static analyzePerformance(code: string): string {
    const performance: string[] = [];

    // Check performance patterns
    if (code.includes('std.ArrayList') && !code.match(/initCapacity/)) {
      performance.push('- Consider pre-allocating ArrayList capacity');
    }
    if (code.match(/\+\s*\d+\s*\+/)) {
      performance.push('- Use comptime for constant expressions');
    }
    if (code.includes('std.crypto')) {
      performance.push('- Consider using batch processing for crypto operations');
    }
    if (code.match(/for\s*\([^)]*\)\s*\{[^}]*for/)) {
      performance.push('- Review nested loops for optimization opportunities');
    }
    if (code.includes('std.fmt.allocPrint') && code.includes('loop')) {
      performance.push('- Avoid allocating in hot loops, use bufPrint instead');
    }

    return performance.length > 0 ? performance.join('\n') : '- No immediate performance concerns';
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
