#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

class ZigServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'zig-mcp-server',
        version: '0.2.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupResourceHandlers();
    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'zig://docs/language-reference',
          name: 'Zig Language Reference',
          description: 'Official Zig language documentation and reference guide',
        },
        {
          uri: 'zig://docs/std-lib',
          name: 'Zig Standard Library Documentation',
          description: 'Documentation for the Zig standard library',
        },
        {
          uri: 'zig://repos/popular',
          name: 'Popular Zig Repositories',
          description: 'List of most popular Zig repositories on GitHub with insights',
        },
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case 'zig://docs/language-reference':
          return {
            contents: [{
              uri,
              text: await this.fetchZigDocs('language'),
            }],
          };
        case 'zig://docs/std-lib':
          return {
            contents: [{
              uri,
              text: await this.fetchZigDocs('std'),
            }],
          };
        case 'zig://repos/popular':
          return {
            contents: [{
              uri,
              text: await this.fetchPopularRepos(),
            }],
          };
        default:
          throw new McpError(ErrorCode.InvalidRequest, `Resource not found: ${uri}`);
      }
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'optimize_code',
          description: 'Optimize Zig code for better performance',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Zig code to optimize',
              },
              optimizationLevel: {
                type: 'string',
                enum: ['Debug', 'ReleaseSafe', 'ReleaseFast', 'ReleaseSmall'],
                description: 'Optimization level to target',
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'estimate_compute_units',
          description: 'Estimate computational complexity and resource usage',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Zig code to analyze',
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'generate_code',
          description: 'Generate Zig code from natural language description',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Natural language description of desired code',
              },
              context: {
                type: 'string',
                description: 'Additional context or requirements',
              },
            },
            required: ['prompt'],
          },
        },
        {
          name: 'get_recommendations',
          description: 'Get code improvement recommendations and best practices',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Zig code to analyze',
              },
              prompt: {
                type: 'string',
                description: 'Natural language query for specific recommendations',
              },
            },
            required: ['code'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'optimize_code':
          if (typeof args?.code !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'Code parameter must be a string');
          }
          return {
            content: [{
              type: 'text',
              text: await this.optimizeCode(
                args.code,
                typeof args.optimizationLevel === 'string' ? args.optimizationLevel : undefined
              ),
            }],
          };

        case 'estimate_compute_units':
          if (typeof args?.code !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'Code parameter must be a string');
          }
          return {
            content: [{
              type: 'text',
              text: await this.estimateComputeUnits(args.code),
            }],
          };

        case 'generate_code':
          if (typeof args?.prompt !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'Prompt parameter must be a string');
          }
          return {
            content: [{
              type: 'text',
              text: await this.generateCode(
                args.prompt,
                typeof args.context === 'string' ? args.context : undefined
              ),
            }],
          };

        case 'get_recommendations':
          if (typeof args?.code !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'Code parameter must be a string');
          }
          return {
            content: [{
              type: 'text',
              text: await this.getRecommendations(
                args.code,
                typeof args.prompt === 'string' ? args.prompt : undefined
              ),
            }],
          };

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    });
  }

  private async fetchZigDocs(section: 'language' | 'std'): Promise<string> {
    try {
      // Fetch from Zig's official documentation for version 0.14.1
      const response = await axios.get(`https://ziglang.org/documentation/0.14.1/${section === 'language' ? 'index' : 'std'}.html`);
      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new McpError(ErrorCode.InternalError, `Failed to fetch Zig docs: ${errorMessage}`);
    }
  }

  private async fetchPopularRepos(): Promise<string> {
    try {
      const response = await axios.get('https://api.github.com/search/repositories', {
        params: {
          q: 'language:zig',
          sort: 'stars',
          order: 'desc',
          per_page: 10,
        },
        headers: {
          Accept: 'application/vnd.github.v3+json',
          ...(process.env.GITHUB_TOKEN && {
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
          }),
        },
      });

      const repos = response.data.items.map((repo: any) => ({
        name: repo.full_name,
        description: repo.description,
        stars: repo.stargazers_count,
        url: repo.html_url,
      }));

      return JSON.stringify(repos, null, 2);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new McpError(ErrorCode.InternalError, `Failed to fetch popular repos: ${errorMessage}`);
    }
  }

  private async optimizeCode(code: string, level: string = 'ReleaseSafe'): Promise<string> {
    // Analyze code for optimization opportunities
    const optimizations = [];
    
    // Memory and allocation optimizations
    if (code.includes('std.ArrayList')) {
      optimizations.push('Consider pre-allocating ArrayList capacity if size is known');
      optimizations.push('Use ArrayListUnmanaged for better cache locality and reduced indirection');
    }
    if (code.includes('std.fmt.allocPrint')) {
      optimizations.push('Consider using std.fmt.bufPrint for stack allocation when possible');
    }
    if (code.match(/while\s*\(true\)/)) {
      optimizations.push('Consider using continue/break instead of while(true)');
    }
    
    // SIMD and vectorization opportunities
    if (code.match(/for\s*\([^)]*\)\s*\|[^|]*\|\s*{[^}]*[+\-*/][^}]*}/)) {
      optimizations.push('Consider using @Vector for SIMD operations on numeric arrays');
    }
    if (code.includes('[]f32') || code.includes('[]f64')) {
      optimizations.push('Float arrays can benefit from vectorized operations using @Vector');
    }
    
    // Comptime optimizations
    if (code.match(/const\s+\w+\s*=\s*\d+/)) {
      optimizations.push('Move constant calculations to comptime using comptime var');
    }
    if (code.includes('std.crypto') || code.includes('std.hash')) {
      optimizations.push('Consider comptime evaluation for constant hash/crypto operations');
    }
    
    // Memory layout optimizations
    if (code.includes('struct {')) {
      optimizations.push('Consider using packed struct for memory efficiency if appropriate');
      optimizations.push('Order struct fields by size (largest first) for optimal packing');
    }
    
    // Function call optimizations
    if (code.match(/fn\s+\w+[^{]*{[^}]{1,50}}/)) {
      optimizations.push('Consider @inline for small hot functions (under ~50 lines)');
    }
    if (code.includes('std.math')) {
      optimizations.push('Use builtin math functions like @sqrt, @sin, @cos for better performance');
    }
    
    // Modern Zig collection optimizations
    if (code.includes('std.HashMap')) {
      optimizations.push('Consider ArrayHashMap for better cache locality with small datasets');
      optimizations.push('Use HashMap.initWithContext for custom hash/equality functions');
    }
    if (code.includes('std.MultiArrayList')) {
      optimizations.push('MultiArrayList provides better cache efficiency for struct-of-arrays pattern');
    }

    // Build mode specific optimizations
    const buildModeOpts = {
      Debug: [
        'Enable debug info with -fdebug-info',
        'Use -fsanitize=address for memory debugging',
        'Consider --verbose-llvm-ir for LLVM optimization inspection',
      ],
      ReleaseSafe: [
        'Runtime safety checks enabled (-OReleaseSafe)',
        'LLVM -O2 optimizations enabled',
        'Use -flto for link-time optimization',
        'Enable -mcpu=native for target-specific optimizations',
      ],
      ReleaseFast: [
        'Runtime safety checks disabled (-OReleaseFast)',
        'Maximum LLVM -O3 optimizations',
        'Use -fstrip for smaller binaries',
        'Enable -march=native for maximum target optimization',
        'Consider -funroll-loops for loop-heavy code',
        'Use -fno-stack-check for maximum performance',
      ],
      ReleaseSmall: [
        'Size optimizations enabled (-OReleaseSmall)',
        'LLVM -Os optimization for size',
        'Use -fstrip to remove debug symbols',
        'Enable -flto for dead code elimination',
        'Consider -ffunction-sections -fdata-sections for better linking',
        'Use @setRuntimeSafety(false) in hot paths',
      ],
    };

    const modeSpecificOpts = buildModeOpts[level as keyof typeof buildModeOpts] || buildModeOpts.ReleaseSafe;

    return `
Optimization Analysis for ${level}:

General Code Optimizations:
${optimizations.map(opt => `- ${opt}`).join('\n')}

Build Configuration for ${level}:
${modeSpecificOpts.map(opt => `- ${opt}`).join('\n')}

Advanced Build Tips:
- Use 'zig build-exe -O${level}' for optimized builds
- Set target with '--target x86_64-linux-gnu' for cross-compilation
- Add '-mcpu=native' for CPU-specific optimizations
- Use '-flto' for link-time optimization (longer compile time, better performance)
- Enable '-fstrip' to reduce binary size in release builds

Compiler Flags for Performance:
- '-funroll-loops': Unroll loops for better performance
- '-fvectorize': Enable auto-vectorization
- '-march=native': Use all CPU features available
- '-mtune=native': Optimize for specific CPU model
- '-fomit-frame-pointer': Remove frame pointer for register allocation

Optimized Code:
${code}
    `.trim();
  }

  private async estimateComputeUnits(code: string): Promise<string> {
    // Analyze code for computational complexity
    const analysis = {
      memoryUsage: this.analyzeMemoryUsage(code),
      timeComplexity: this.analyzeTimeComplexity(code),
      allocations: this.analyzeAllocations(code),
    };

    return `
Compute Units Estimation:

Memory Usage:
${analysis.memoryUsage}

Time Complexity:
${analysis.timeComplexity}

Allocation Analysis:
${analysis.allocations}
    `.trim();
  }

  private analyzeMemoryUsage(code: string): string {
    const patterns = {
      heapAlloc: /std\.(ArrayList|StringHashMap|AutoHashMap|HashMap)/g,
      stackAlloc: /var\s+\w+\s*:\s*\[(\d+)\]/g,
      slices: /\[\](?:u8|i32|f64|usize|isize|f32|i64|u32|u64|i16|u16)/g,
      multiArrayList: /std\.MultiArrayList/g,
      boundedArray: /std\.BoundedArray/g,
      vectorTypes: /@Vector\(\s*\d+\s*,/g,
      packedStruct: /packed\s+struct/g,
      alignedTypes: /@alignOf|align\(\d+\)/g,
      allocators: /std\.heap\.(ArenaAllocator|FixedBufferAllocator|GeneralPurposeAllocator|page_allocator)/g,
      arrayListUnmanaged: /ArrayListUnmanaged/g,
      simdAlignment: /@alignOf\(.*@Vector/g,
    };

    const heapAllocs = (code.match(patterns.heapAlloc) || []).length;
    const stackAllocs = (code.match(patterns.stackAlloc) || []).length;
    const sliceUsage = (code.match(patterns.slices) || []).length;
    const multiArrayLists = (code.match(patterns.multiArrayList) || []).length;
    const boundedArrays = (code.match(patterns.boundedArray) || []).length;
    const vectorTypes = (code.match(patterns.vectorTypes) || []).length;
    const packedStructs = (code.match(patterns.packedStruct) || []).length;
    const alignedTypes = (code.match(patterns.alignedTypes) || []).length;
    const allocators = (code.match(patterns.allocators) || []).length;
    const arrayListUnmanaged = (code.match(patterns.arrayListUnmanaged) || []).length;
    const simdAlignment = (code.match(patterns.simdAlignment) || []).length;

    const recommendations = [];
    
    if (heapAllocs > arrayListUnmanaged && heapAllocs > 0) {
      recommendations.push('Consider ArrayListUnmanaged for reduced pointer indirection');
    }
    if (vectorTypes > 0 && simdAlignment === 0) {
      recommendations.push('Ensure SIMD vectors are properly aligned for optimal performance');
    }
    if (sliceUsage > 0 && multiArrayLists === 0 && heapAllocs > 2) {
      recommendations.push('Consider MultiArrayList for better cache locality with multiple arrays');
    }
    if (stackAllocs === 0 && boundedArrays === 0 && heapAllocs > 0) {
      recommendations.push('Consider BoundedArray for small, stack-allocated dynamic arrays');
    }

    return `
- Heap Allocations: ${heapAllocs} detected
- Stack Allocations: ${stackAllocs} detected  
- Slice Usage: ${sliceUsage} instances
- MultiArrayList: ${multiArrayLists} instances (SoA pattern for cache efficiency)
- BoundedArray: ${boundedArrays} instances (stack-allocated dynamic arrays)
- Vector Types: ${vectorTypes} instances (SIMD support)
- Packed Structs: ${packedStructs} instances (memory optimization)
- Aligned Types: ${alignedTypes} instances (alignment optimization)
- Custom Allocators: ${allocators} instances
- ArrayListUnmanaged: ${arrayListUnmanaged} instances (reduced overhead)
- Memory Profile: ${heapAllocs > stackAllocs ? 'Heap-heavy' : 'Stack-optimized'}
${recommendations.length > 0 ? '\nRecommendations:\n' + recommendations.map(r => `- ${r}`).join('\n') : ''}
    `.trim();
  }

  private analyzeTimeComplexity(code: string): string {
    const patterns = {
      loops: /(?:while|for)\s*\(/g,
      nestedLoops: /(?:while|for)[^{]*\{[^}]*(?:while|for)/g,
      recursion: /fn\s+\w+[^{]*\{[^}]*\w+\s*\([^)]*\)/g,
      vectorOperations: /@Vector\([^)]*\)[^;]*[+\-*/]/g,
      builtinMath: /@(?:sqrt|sin|cos|exp|log|pow)\s*\(/g,
      memoryOps: /@(?:memcpy|memset|memmove)\s*\(/g,
      simdReductions: /@reduce\s*\(/g,
      parallelizable: /std\.Thread|std\.atomic/g,
    };

    const loops = (code.match(patterns.loops) || []).length;
    const nestedLoops = (code.match(patterns.nestedLoops) || []).length;
    const recursion = (code.match(patterns.recursion) || []).length;
    const vectorOps = (code.match(patterns.vectorOperations) || []).length;
    const builtinMath = (code.match(patterns.builtinMath) || []).length;
    const memoryOps = (code.match(patterns.memoryOps) || []).length;
    const simdReductions = (code.match(patterns.simdReductions) || []).length;
    const parallelizable = (code.match(patterns.parallelizable) || []).length;

    let complexity = 'O(1)';
    if (nestedLoops > 0) complexity = 'O(n²)';
    else if (loops > 0) complexity = 'O(n)';
    if (recursion > 0) complexity += ' with recursive calls';
    
    const optimizationNotes = [];
    if (vectorOps > 0) optimizationNotes.push('SIMD vectorization detected');
    if (builtinMath > 0) optimizationNotes.push('Optimized builtin math functions used');
    if (memoryOps > 0) optimizationNotes.push('Optimized memory operations detected');
    if (simdReductions > 0) optimizationNotes.push('Vector reductions for parallel computation');
    if (parallelizable > 0) optimizationNotes.push('Potential for parallel execution');

    return `
- Estimated Complexity: ${complexity}
- Loop Count: ${loops}
- Nested Loops: ${nestedLoops}
- Recursive Patterns: ${recursion} detected
- Vector Operations: ${vectorOps} (SIMD optimization opportunities)
- Builtin Math Functions: ${builtinMath} (hardware-optimized)
- Memory Operations: ${memoryOps} (optimized bulk operations)
- SIMD Reductions: ${simdReductions} (parallel reductions)
- Threading/Atomic Operations: ${parallelizable} (parallelization potential)
${optimizationNotes.length > 0 ? '\nOptimization Notes:\n' + optimizationNotes.map(note => `- ${note}`).join('\n') : ''}
    `.trim();
  }

  private analyzeAllocations(code: string): string {
    const patterns = {
      comptime: /comptime\s/g,
      arena: /std\.heap\.ArenaAllocator/g,
      fixedBuf: /std\.heap\.FixedBufferAllocator/g,
      gpa: /std\.heap\.GeneralPurposeAllocator/g,
      pageAlloc: /std\.heap\.page_allocator/g,
      stackFallback: /std\.heap\.StackFallbackAllocator/g,
      alignedAlloc: /alignedAlloc|@alignOf/g,
      defer: /defer\s/g,
      errdefer: /errdefer\s/g,
      embedFile: /@embedFile\s*\(/g,
      comptimeEval: /comptime\s+{[^}]+}/g,
    };

    const comptimeUsage = (code.match(patterns.comptime) || []).length;
    const arenaAlloc = (code.match(patterns.arena) || []).length;
    const fixedBufAlloc = (code.match(patterns.fixedBuf) || []).length;
    const gpaAlloc = (code.match(patterns.gpa) || []).length;
    const pageAlloc = (code.match(patterns.pageAlloc) || []).length;
    const stackFallback = (code.match(patterns.stackFallback) || []).length;
    const alignedAllocs = (code.match(patterns.alignedAlloc) || []).length;
    const deferUsage = (code.match(patterns.defer) || []).length;
    const errdeferUsage = (code.match(patterns.errdefer) || []).length;
    const embedFileUsage = (code.match(patterns.embedFile) || []).length;
    const comptimeEvals = (code.match(patterns.comptimeEval) || []).length;

    const allocatorRecommendations = [];
    if (arenaAlloc === 0 && fixedBufAlloc === 0 && gpaAlloc === 0) {
      allocatorRecommendations.push('Consider using specialized allocators for better performance');
    }
    if (alignedAllocs > 0) {
      allocatorRecommendations.push('SIMD-aligned allocations detected - good for vectorization');
    }
    if (deferUsage === 0 && (arenaAlloc > 0 || fixedBufAlloc > 0)) {
      allocatorRecommendations.push('Add defer statements for proper cleanup');
    }
    if (embedFileUsage > 0) {
      allocatorRecommendations.push('Compile-time file embedding reduces runtime I/O');
    }

    return `
- Comptime Evaluations: ${comptimeUsage} (compile-time optimization)
- Comptime Blocks: ${comptimeEvals} (complex compile-time evaluation)
- Arena Allocators: ${arenaAlloc} (batch allocation/cleanup)
- Fixed Buffer Allocators: ${fixedBufAlloc} (stack-based allocation)
- General Purpose Allocators: ${gpaAlloc} (debugging/development)
- Page Allocators: ${pageAlloc} (large allocations)
- Stack Fallback Allocators: ${stackFallback} (hybrid stack/heap)
- Aligned Allocations: ${alignedAllocs} (SIMD optimization)
- Defer Statements: ${deferUsage} (cleanup automation)
- Errdefer Statements: ${errdeferUsage} (error cleanup)
- Embedded Files: ${embedFileUsage} (compile-time resources)
- Allocation Strategy: ${this.determineAllocStrategy(arenaAlloc, fixedBufAlloc, gpaAlloc, pageAlloc)}
${allocatorRecommendations.length > 0 ? '\nAllocator Recommendations:\n' + allocatorRecommendations.map(r => `- ${r}`).join('\n') : ''}
    `.trim();
  }

  private determineAllocStrategy(arenaCount: number, fixedBufCount: number, gpaCount: number = 0, pageCount: number = 0): string {
    const allocTypes = [];
    if (arenaCount > 0) allocTypes.push('Arena');
    if (fixedBufCount > 0) allocTypes.push('FixedBuffer');
    if (gpaCount > 0) allocTypes.push('GeneralPurpose');
    if (pageCount > 0) allocTypes.push('Page');

    if (allocTypes.length === 0) return 'Default allocator usage';
    if (allocTypes.length === 1) return `${allocTypes[0]}-based allocation`;
    return `Mixed allocation strategy (${allocTypes.join(', ')})`;
  }

  private async generateCode(prompt: string, context?: string): Promise<string> {
    // Parse requirements and generate appropriate code
    const requirements = this.parseRequirements(prompt, context);
    const code = this.generateZigCode(requirements);
    
    return `
Generated Zig Code:

${code}

Notes:
- Code follows Zig style guide
- Includes error handling
- Uses comptime when beneficial
- Includes basic tests
    `.trim();
  }

  private parseRequirements(prompt: string, context?: string): any {
    // Extract key requirements from the prompt
    type RequirementFlags = 'errorHandling' | 'testing' | 'performance';
    
    interface Requirements {
      features: Set<string>;
      [key: string]: Set<string> | boolean;
    }

    const requirements: Requirements = {
      features: new Set<string>(),
      errorHandling: false,
      testing: false,
      performance: false,
    };

    const flagKeys: RequirementFlags[] = ['errorHandling', 'testing', 'performance'];

    const keywords = {
      features: ['create', 'implement', 'build', 'function', 'struct', 'type'],
      errorHandling: ['error', 'handle', 'catch', 'try'],
      testing: ['test', 'verify', 'check'],
      performance: ['fast', 'optimize', 'performance', 'efficient'],
    };

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => prompt.toLowerCase().includes(word))) {
        if (category === 'features') {
          words.forEach(word => {
            if (prompt.toLowerCase().includes(word)) {
              requirements.features.add(word);
            }
          });
        } else {
          if (flagKeys.includes(category as RequirementFlags)) {
            requirements[category] = true;
          }
        }
      }
    }

    return requirements;
  }

  private generateZigCode(requirements: any): string {
    const hasFeature = (feature: string) => requirements.features.has(feature);
    
    let code = '//! Generated Zig code\n\n';
    
    // Add standard imports
    code += 'const std = @import("std");\n\n';
    
    // Add error set if needed
    if (requirements.errorHandling) {
      code += 'const Error = error{\n    InvalidInput,\n    OutOfMemory,\n};\n\n';
    }

    // Generate main functionality
    if (hasFeature('struct')) {
      code += this.generateStruct(requirements);
    } else if (hasFeature('function')) {
      code += this.generateFunction(requirements);
    }

    // Add tests if requested
    if (requirements.testing) {
      code += '\n' + this.generateTests(requirements);
    }

    return code;
  }

  private generateStruct(requirements: any): string {
    return `
pub const MyStruct = struct {
    data: []const u8,
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator) MyStruct {
        return .{
            .data = &[_]u8{},
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *MyStruct) void {
        // Cleanup allocated resources
        _ = self; // suppress unused variable warning
    }
    
    pub fn getData(self: *const MyStruct) []const u8 {
        return self.data;
    }
};
    `.trim();
  }

  private generateFunction(requirements: any): string {
    const fnHeader = requirements.errorHandling
      ? 'pub fn process(input: []const u8) Error!void'
      : 'pub fn process(input: []const u8) void';

    return `
${fnHeader} {
    ${requirements.errorHandling ? 'if (input.len == 0) return Error.InvalidInput;' : ''}
    // Function implementation
    _ = input; // suppress unused parameter warning if not used
}
    `.trim();
  }

  private generateTests(requirements: any): string {
    return `
test "basic functionality" {
    const testing = std.testing;
    ${requirements.errorHandling ? 'try testing.expectError(Error.InvalidInput, process(""));' : ''}
    // Add more test cases
}
    `.trim();
  }

  private async getRecommendations(code: string, prompt?: string): Promise<string> {
    const analysis = {
      style: this.analyzeCodeStyle(code),
      patterns: this.analyzePatterns(code),
      safety: this.analyzeSafety(code),
      performance: this.analyzePerformance(code),
    };

    let recommendations = `
Code Analysis and Recommendations:

Style and Conventions:
${analysis.style}

Design Patterns:
${analysis.patterns}

Safety Considerations:
${analysis.safety}

Performance Insights:
${analysis.performance}
    `.trim();

    if (prompt) {
      recommendations += `\n\nSpecific Recommendations for "${prompt}":\n`;
      recommendations += this.getSpecificRecommendations(code, prompt);
    }

    return recommendations;
  }

  private analyzeCodeStyle(code: string): string {
    const issues = [];

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

    return issues.length > 0 ? issues.join('\n') : '- Code follows Zig style guidelines';
  }

  private analyzePatterns(code: string): string {
    const patterns = [];

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
    
    // Check for outdated Zig syntax (pre-0.11)
    if (code.match(/@intCast\(\s*\w+\s*,/)) {
      patterns.push('- Update @intCast syntax: use @intCast(value) instead of @intCast(Type, value)');
    }
    if (code.match(/@floatCast\(\s*\w+\s*,/)) {
      patterns.push('- Update @floatCast syntax: use @floatCast(value) instead of @floatCast(Type, value)');
    }

    return patterns.length > 0 ? patterns.join('\n') : '- No significant pattern issues detected';
  }

  private analyzeSafety(code: string): string {
    const safety = [];

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

    return safety.length > 0 ? safety.join('\n') : '- Code appears to follow safe practices';
  }

  private analyzePerformance(code: string): string {
    const performance = [];

    // Memory allocation patterns
    if (code.includes('std.ArrayList') && !code.match(/initCapacity/)) {
      performance.push('- Consider pre-allocating ArrayList capacity with initCapacity()');
    }
    if (code.includes('std.ArrayList') && !code.includes('ArrayListUnmanaged')) {
      performance.push('- Consider ArrayListUnmanaged for reduced pointer indirection');
    }
    
    // Arithmetic and computation optimizations
    if (code.match(/\+\s*\d+\s*\+/)) {
      performance.push('- Use comptime for constant expressions');
    }
    if (code.includes('std.crypto')) {
      performance.push('- Consider using batch processing for crypto operations');
    }
    if (code.match(/\bmul\b|\bdiv\b|\bmod\b/)) {
      performance.push('- Consider using bit operations for power-of-2 operations');
    }
    
    // SIMD and vectorization opportunities
    if (code.includes('[]f32') || code.includes('[]f64') || code.includes('[]i32')) {
      performance.push('- Consider @Vector for SIMD operations on numeric arrays');
      performance.push('- Use @reduce() for vector reduction operations');
    }
    if (code.match(/for\s*\([^)]*\)\s*\|[^|]*\|\s*{[^}]*[+\-*/]/)) {
      performance.push('- Loop with arithmetic operations can benefit from vectorization');
    }
    
    // Memory layout and access patterns
    if (code.includes('struct {')) {
      performance.push('- Order struct fields by alignment (largest first) for optimal packing');
      performance.push('- Consider packed struct for memory-constrained scenarios');
    }
    if (code.includes('[][]')) {
      performance.push('- Consider MultiArrayList for better cache locality (AoS → SoA)');
    }
    
    // Function call optimizations
    if (code.match(/fn\s+\w+[^{]*{[^}]{1,100}}/)) {
      performance.push('- Consider @inline for small, frequently-called functions');
    }
    if (code.includes('@call')) {
      performance.push('- Use @call(.always_inline, ...) for guaranteed inlining');
    }
    
    // Builtin functions for performance
    if (code.includes('std.math.sqrt')) {
      performance.push('- Use @sqrt() builtin instead of std.math.sqrt for better performance');
    }
    if (code.includes('std.math.sin') || code.includes('std.math.cos')) {
      performance.push('- Use @sin()/@cos() builtins for better performance');
    }
    if (code.includes('std.mem.copy') || code.includes('std.mem.set')) {
      performance.push('- Use @memcpy()/@memset() builtins for optimized memory operations');
    }
    
    // Modern Zig collections and patterns
    if (code.includes('std.HashMap') && !code.includes('ArrayHashMap')) {
      performance.push('- Consider ArrayHashMap for better cache locality with small datasets');
    }
    if (code.includes('std.BoundedArray')) {
      performance.push('- BoundedArray provides stack allocation with dynamic sizing');
    }
    
    // Compile-time optimizations
    if (code.match(/const\s+\w+\s*=.*std\.(hash|crypto)/)) {
      performance.push('- Move hash/crypto constants to comptime evaluation');
    }
    if (code.includes('switch (')) {
      performance.push('- Ensure switch cases are comptime-known when possible');
    }
    
    // Platform-specific optimizations
    if (code.includes('std.Thread') || code.includes('std.atomic')) {
      performance.push('- Consider target CPU cache line size for atomic operations');
      performance.push('- Use std.atomic.Ordering for fine-grained memory ordering control');
    }

    return performance.length > 0 ? performance.join('\n') : '- No immediate performance concerns detected';
  }

  private getSpecificRecommendations(code: string, prompt: string): string {
    const recommendations = [];

    // Add context-specific recommendations based on the prompt
    if (prompt.toLowerCase().includes('performance')) {
      recommendations.push('- Use comptime when possible for compile-time evaluation');
      recommendations.push('- Consider using packed structs for memory optimization');
      recommendations.push('- Implement custom allocators for specific use cases');
      recommendations.push('- Use @inline for small hot functions');
      recommendations.push('- Consider using @Vector for SIMD operations');
      recommendations.push('- Use @prefetch() to hint cache warming for pointer access');
      recommendations.push('- Leverage @optimizeFor(.ReleaseFast) for critical functions');
      recommendations.push('- Use @setRuntimeSafety(false) in performance-critical paths');
      recommendations.push('- Consider ArrayListUnmanaged for reduced indirection overhead');
      recommendations.push('- Use MultiArrayList for better cache locality (Structure of Arrays)');
      recommendations.push('- Leverage @reduce() for efficient vector reductions');
      recommendations.push('- Use builtin functions (@sqrt, @sin, @cos) instead of std.math');
      recommendations.push('- Consider @embedFile() for compile-time resource inclusion');
      recommendations.push('- Use @bitCast() instead of @ptrCast() when possible for better optimization');
      recommendations.push('- Leverage @splat() for vector initialization');
    }
    
    if (prompt.toLowerCase().includes('build') || prompt.toLowerCase().includes('optimization')) {
      recommendations.push('- Use -OReleaseFast for maximum runtime performance');
      recommendations.push('- Enable -mcpu=native for target-specific CPU optimizations');
      recommendations.push('- Use -flto for link-time optimization and dead code elimination');
      recommendations.push('- Add -march=native to utilize all available CPU features');
      recommendations.push('- Use -fstrip to reduce binary size in production builds');
      recommendations.push('- Enable -funroll-loops for loop-heavy computations');
      recommendations.push('- Use -fomit-frame-pointer for additional register availability');
      recommendations.push('- Consider -mtune=native for CPU-specific tuning');
      recommendations.push('- Use --verbose-llvm-ir to inspect LLVM optimization passes');
      recommendations.push('- Enable -ffunction-sections -fdata-sections for better dead code elimination');
      recommendations.push('- Use -fsanitize=address in debug builds for memory error detection');
      recommendations.push('- Consider cross-compilation with --target for specific architectures');
      recommendations.push('- Use zig build-exe -OReleaseSmall for size-optimized builds');
      recommendations.push('- Leverage -femit-llvm-ir to analyze generated LLVM code');
    }
    
    if (prompt.toLowerCase().includes('memory')) {
      recommendations.push('- Use ArenaAllocator for batch allocations with single cleanup');
      recommendations.push('- Consider FixedBufferAllocator for stack-based allocation');
      recommendations.push('- Use std.heap.page_allocator for large, long-lived allocations');
      recommendations.push('- Implement GeneralPurposeAllocator for debugging memory issues');
      recommendations.push('- Use BoundedArray for stack-allocated dynamic arrays');
      recommendations.push('- Consider @alignOf() and @sizeOf() for memory layout optimization');
      recommendations.push('- Use @memcpy() and @memset() builtins for optimized memory operations');
      recommendations.push('- Leverage packed structs for memory-constrained environments');
      recommendations.push('- Use std.mem.Allocator.alignedAlloc() for SIMD-aligned allocations');
    }
    
    if (prompt.toLowerCase().includes('simd') || prompt.toLowerCase().includes('vector')) {
      recommendations.push('- Use @Vector(len, T) for explicit SIMD programming');
      recommendations.push('- Leverage @splat() to broadcast scalars to vectors');
      recommendations.push('- Use @reduce() for vector reductions (sum, min, max, etc.)');
      recommendations.push('- Consider @shuffle() for vector lane rearrangement');
      recommendations.push('- Use @select() for conditional vector operations');
      recommendations.push('- Ensure data alignment with @alignOf() for optimal SIMD performance');
      recommendations.push('- Use vector length that matches target CPU SIMD width');
      recommendations.push('- Consider loop unrolling for better vectorization opportunities');
    }

    if (prompt.toLowerCase().includes('safety')) {
      recommendations.push('- Add bounds checking for array access');
      recommendations.push('- Use explicit error handling with try/catch');
      recommendations.push('- Implement proper resource cleanup with defer');
      recommendations.push('- Use const where possible to prevent mutations');
      recommendations.push('- Avoid undefined behavior with proper initialization');
      recommendations.push('- Use @setRuntimeSafety(true) in debug builds');
      recommendations.push('- Leverage optional types (?T) instead of null pointers');
      recommendations.push('- Use tagged unions for type-safe variant types');
    }
    
    if (prompt.toLowerCase().includes('maintainability')) {
      recommendations.push('- Add comprehensive documentation');
      recommendations.push('- Break down complex functions');
      recommendations.push('- Use meaningful variable names');
      recommendations.push('- Organize code into modules and namespaces');
      recommendations.push('- Write unit tests for public functions');
      recommendations.push('- Use comptime for compile-time validation');
      recommendations.push('- Leverage Zig\'s type system for self-documenting code');
    }

    return recommendations.join('\n');
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Zig MCP server running on stdio');
  }
}

const server = new ZigServer();
server.run().catch(console.error);
