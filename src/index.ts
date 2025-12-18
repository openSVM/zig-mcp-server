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

import type { OptimizationLevel, CodeAnalysisResult, GitHubRepo, ZigBuildConfig } from './types.js';
import { ZigBuildSystemHelper } from './zig-build.js';
import { ZigCodeAnalyzer, ZigStyleChecker, ZigCodeGenerator, Logger } from './utils.js';

/**
 * Main Zig MCP Server class
 * Provides comprehensive Zig language assistance including build system support
 */
class ZigServer {
  private readonly server: Server;
  private readonly version = '0.2.0';

  constructor() {
    this.server = new Server(
      {
        name: 'zig-mcp-server',
        version: this.version,
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

    this.server.onerror = error => Logger.error('MCP Error', error);

    // Graceful shutdown handling
    process.on('SIGINT', async () => {
      Logger.info('Received SIGINT, shutting down gracefully...');
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      Logger.info('Received SIGTERM, shutting down gracefully...');
      await this.server.close();
      process.exit(0);
    });

    Logger.info(`Zig MCP Server v${this.version} initialized`);
  }

  private setupResourceHandlers(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'zig://docs/language-reference',
          name: 'Zig Language Reference',
          description: 'Official Zig language documentation and reference guide',
          mimeType: 'text/html',
        },
        {
          uri: 'zig://docs/std-lib',
          name: 'Zig Standard Library Documentation',
          description: 'Documentation for the Zig standard library',
          mimeType: 'text/html',
        },
        {
          uri: 'zig://repos/popular',
          name: 'Popular Zig Repositories',
          description: 'List of most popular Zig repositories on GitHub with insights',
          mimeType: 'application/json',
        },
        {
          uri: 'zig://build/best-practices',
          name: 'Zig Build System Best Practices',
          description: 'Comprehensive guide to modern Zig build system patterns',
          mimeType: 'text/markdown',
        },
        {
          uri: 'zig://build/troubleshooting',
          name: 'Build System Troubleshooting',
          description: 'Common build issues and their solutions',
          mimeType: 'text/markdown',
        },
        {
          uri: 'zig://examples/build-configs',
          name: 'Example Build Configurations',
          description: 'Sample build.zig files for different project types',
          mimeType: 'text/plain',
        },
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async request => {
      const { uri } = request.params;
      Logger.debug(`Fetching resource: ${uri}`);

      try {
        switch (uri) {
          case 'zig://docs/language-reference':
            return {
              contents: [
                {
                  uri,
                  mimeType: 'text/html',
                  text: await this.fetchZigDocs('language'),
                },
              ],
            };
          case 'zig://docs/std-lib':
            return {
              contents: [
                {
                  uri,
                  mimeType: 'text/html',
                  text: await this.fetchZigDocs('std'),
                },
              ],
            };
          case 'zig://repos/popular':
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: await this.fetchPopularRepos(),
                },
              ],
            };
          case 'zig://build/best-practices':
            return {
              contents: [
                {
                  uri,
                  mimeType: 'text/markdown',
                  text: ZigBuildSystemHelper.getBuildSystemBestPractices(),
                },
              ],
            };
          case 'zig://build/troubleshooting':
            return {
              contents: [
                {
                  uri,
                  mimeType: 'text/markdown',
                  text: ZigBuildSystemHelper.getBuildTroubleshooting(),
                },
              ],
            };
          case 'zig://examples/build-configs':
            return {
              contents: [
                {
                  uri,
                  mimeType: 'text/plain',
                  text: this.generateBuildExamples(),
                },
              ],
            };
          default:
            throw new McpError(ErrorCode.InvalidRequest, `Resource not found: ${uri}`);
        }
      } catch (error) {
        Logger.error(`Failed to fetch resource ${uri}`, error as Error);
        throw error;
      }
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'optimize_code',
          description: 'Optimize Zig code for better performance with modern patterns',
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
                default: 'ReleaseSafe',
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'estimate_compute_units',
          description:
            'Estimate computational complexity and resource usage with detailed analysis',
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
          description: 'Generate modern Zig code from natural language descriptions',
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
          description: 'Get comprehensive, multi-dimensional code analysis with 10+ specialized analyzers covering style, safety, performance, concurrency, metaprogramming, testing, build systems, interop, metrics, and modern Zig patterns',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Zig code to analyze',
              },
              prompt: {
                type: 'string',
                description: 'Natural language query for specific recommendations (performance, safety, maintainability, concurrency, architecture, etc.)',
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'generate_build_zig',
          description: 'Generate a modern build.zig file with best practices',
          inputSchema: {
            type: 'object',
            properties: {
              projectName: {
                type: 'string',
                description: 'Name of the project',
                default: 'my-project',
              },
              projectType: {
                type: 'string',
                enum: ['executable', 'library', 'both'],
                description: 'Type of project to generate',
                default: 'executable',
              },
              zigVersion: {
                type: 'string',
                description: 'Target Zig version',
                default: '0.12.0',
              },
              dependencies: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of dependencies to include',
                default: [],
              },
            },
            required: [],
          },
        },
        {
          name: 'analyze_build_zig',
          description: 'Analyze a build.zig file and provide modernization recommendations',
          inputSchema: {
            type: 'object',
            properties: {
              buildZigContent: {
                type: 'string',
                description: 'Content of the build.zig file to analyze',
              },
            },
            required: ['buildZigContent'],
          },
        },
        {
          name: 'generate_build_zon',
          description: 'Generate a build.zig.zon file for dependency management',
          inputSchema: {
            type: 'object',
            properties: {
              projectName: {
                type: 'string',
                description: 'Name of the project',
                default: 'my-project',
              },
              dependencies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    url: { type: 'string' },
                  },
                  required: ['name', 'url'],
                },
                description: 'List of dependencies with their URLs',
                default: [],
              },
            },
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;
      Logger.debug(`Tool called: ${name}`);

      try {
        switch (name) {
          case 'optimize_code':
            this.validateStringParam(args?.code, 'code');
            return {
              content: [
                {
                  type: 'text',
                  text: await this.optimizeCode(
                    args.code,
                    (args.optimizationLevel as OptimizationLevel) ?? 'ReleaseSafe'
                  ),
                },
              ],
            };

          case 'estimate_compute_units':
            this.validateStringParam(args?.code, 'code');
            return {
              content: [
                {
                  type: 'text',
                  text: await this.estimateComputeUnits(args.code),
                },
              ],
            };

          case 'generate_code':
            this.validateStringParam(args?.prompt, 'prompt');
            return {
              content: [
                {
                  type: 'text',
                  text: await this.generateCode(args.prompt, args.context as string | undefined),
                },
              ],
            };

          case 'get_recommendations':
            this.validateStringParam(args?.code, 'code');
            return {
              content: [
                {
                  type: 'text',
                  text: await this.getRecommendations(args.code, args.prompt as string | undefined),
                },
              ],
            };

          case 'generate_build_zig':
            return {
              content: [
                {
                  type: 'text',
                  text: await this.generateBuildZig(args || {}),
                },
              ],
            };

          case 'analyze_build_zig':
            this.validateStringParam(args?.buildZigContent, 'buildZigContent');
            return {
              content: [
                {
                  type: 'text',
                  text: this.analyzeBuildZig(args.buildZigContent),
                },
              ],
            };

          case 'generate_build_zon':
            return {
              content: [
                {
                  type: 'text',
                  text: this.generateBuildZon(args || {}),
                },
              ],
            };

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        Logger.error(`Tool execution failed for ${name}`, error as Error);
        throw error;
      }
    });
  }

  private validateStringParam(value: unknown, paramName: string): asserts value is string {
    if (typeof value !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, `${paramName} parameter must be a string`);
    }
  }

  private async fetchZigDocs(section: 'language' | 'std'): Promise<string> {
    try {

      Logger.debug(`Fetching Zig docs for section: ${section}`);
      // Fetch from Zig's official documentation
      const url = `https://ziglang.org/documentation/master/${section === 'language' ? 'index' : 'std'}.html`;
      const response = await axios.get(url, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'zig-mcp-server/0.2.0',
        },
      });
      Logger.debug(`Successfully fetched Zig docs for ${section}`);
      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(`Failed to fetch Zig docs for ${section}`, error as Error);
      throw new McpError(ErrorCode.InternalError, `Failed to fetch Zig docs: ${errorMessage}`);
    }
  }

  private async fetchPopularRepos(): Promise<string> {
    try {
      Logger.debug('Fetching popular Zig repositories');
      const response = await axios.get('https://api.github.com/search/repositories', {
        params: {
          q: 'language:zig',
          sort: 'stars',
          order: 'desc',
          per_page: 10,
        },
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'zig-mcp-server/0.2.0',
          ...(process.env.GITHUB_TOKEN && {
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
          }),
        },
        timeout: 10000, // 10 second timeout
      });

      const repos: GitHubRepo[] = response.data.items.map((repo: any) => ({
        name: repo.full_name,
        description: repo.description || 'No description available',
        stars: repo.stargazers_count,
        url: repo.html_url,
      }));

      Logger.debug(`Successfully fetched ${repos.length} popular repositories`);
      return JSON.stringify(repos, null, 2);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Failed to fetch popular repositories', error as Error);
      throw new McpError(ErrorCode.InternalError, `Failed to fetch popular repos: ${errorMessage}`);
    }
  }

  private async optimizeCode(
    code: string,
    level: OptimizationLevel = 'ReleaseSafe'
  ): Promise<string> {
    Logger.debug(`Optimizing code for level: ${level}`);

    // Analyze code for optimization opportunities
    const optimizations: string[] = [];

    // Check for common patterns that can be optimized
    if (code.includes('std.ArrayList')) {
      optimizations.push('Consider pre-allocating ArrayList capacity if size is known');
      optimizations.push('Use ArrayListUnmanaged for better cache locality and reduced indirection');
    }
    if (code.includes('std.fmt.allocPrint')) {
      optimizations.push('Consider using std.fmt.bufPrint for stack allocation when possible');
    }
    if (code.match(/while\s*\(true\)/)) {
      optimizations.push('Consider using labeled breaks instead of while(true)');
    }
    if (code.includes('@intCast') && !code.includes('try')) {
      optimizations.push('Use safe integer casting: try std.math.cast() instead of @intCast');
    }
    if (code.match(/for\s*\([^)]*\)\s*\{[^}]*std\.fmt\.print/)) {
      optimizations.push('Avoid I/O operations in hot loops for better performance');
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
        'Debug symbols enabled',
        'Runtime safety checks enabled',
        'No optimizations - fastest compile time',
      ],
      ReleaseSafe: [
        'Runtime safety checks enabled',
        'Optimizations enabled',
        'Good balance of safety and performance',
      ],
      ReleaseFast: [
        'Runtime safety checks disabled',
        'Maximum performance optimizations',
        'Consider adding debug assertions for critical paths',
        'Use @setRuntimeSafety(true) for critical sections if needed',
      ],
      ReleaseSmall: [
        'Size optimizations enabled',
        'Consider removing debug information',
        'Minimize template instantiations',
        'Use packed structs to reduce memory footprint',
      ],
    } as const;

    const modeSpecificOpts = buildModeOpts[level];

    return `
# Optimization Analysis for ${level}

## General Optimizations:
${optimizations.length > 0 ? optimizations.map(opt => `- ${opt}`).join('\n') : '- No immediate optimization opportunities detected'}

## Build Mode Specific:
${modeSpecificOpts.map(opt => `- ${opt}`).join('\n')}

## Modern Zig Patterns to Consider:
- Use comptime for compile-time computations
- Leverage Zig's zero-cost abstractions
- Consider using packed structs for memory efficiency
- Use defer for automatic cleanup
- Implement proper error handling with error unions

## Optimized Code Suggestions:
\`\`\`zig
${this.generateOptimizedCodeSuggestions(code, level)}
\`\`\`
    `.trim();
  }

  private generateOptimizedCodeSuggestions(code: string, level: OptimizationLevel): string {
    let optimizedCode = code;

    // Apply common optimizations
    if (optimizedCode.includes('std.ArrayList') && !optimizedCode.includes('initCapacity')) {
      optimizedCode = optimizedCode.replace(
        /std\.ArrayList\([^)]+\)\.init\([^)]+\)/,
        'std.ArrayList($1).initCapacity(allocator, expected_capacity)'
      );
    }

    // Add safety annotations for ReleaseFast
    if (level === 'ReleaseFast' && !optimizedCode.includes('@setRuntimeSafety')) {
      optimizedCode = `// Consider adding runtime safety for critical sections:\n// @setRuntimeSafety(true);\n\n${optimizedCode}`;
    }

    return optimizedCode;
  }

  private async estimateComputeUnits(code: string): Promise<string> {
    Logger.debug('Estimating compute units for code');

    // Analyze code for computational complexity using new utility classes
    const analysis: CodeAnalysisResult = {
      memoryUsage: ZigCodeAnalyzer.analyzeMemoryUsage(code),
      timeComplexity: ZigCodeAnalyzer.analyzeTimeComplexity(code),
      allocations: ZigCodeAnalyzer.analyzeAllocations(code),
    };

    return `
# Compute Units Estimation

## Memory Usage:
${analysis.memoryUsage}

## Time Complexity:
${analysis.timeComplexity}

## Allocation Analysis:
${analysis.allocations}

## Recommendations:
- Consider using arena allocators for batch allocations
- Profile memory usage with --enable-logging
- Use comptime evaluation to reduce runtime overhead
- Consider memory pool allocation for frequent allocations
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
    if (nestedLoops > 0) {
      complexity = 'O(n²)';
    } else if (loops > 0) {
      complexity = 'O(n)';
    }
    if (recursion > 0) {
      complexity += ' with recursive calls';
    }

    const optimizationNotes: string[] = [];
    if (vectorOps === 0 && loops > 0) {
      optimizationNotes.push('Consider vectorization for numeric operations');
    }
    if (parallelizable > 0) {
      optimizationNotes.push('Thread safety requires careful synchronization');
    }

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

  private determineAllocStrategy(arenaCount: number, fixedBufCount: number, gpaCount: number, pageAllocCount: number): string {
    const counts = { arenaCount, fixedBufCount, gpaCount, pageAllocCount };
    const activeStrategies = Object.entries(counts).filter(([_, count]) => count > 0);
    
    if (activeStrategies.length > 1) {
      return 'Mixed allocation strategy';
    }
    if (arenaCount > 0) {
      return 'Arena-based allocation';
    }
    if (fixedBufCount > 0) {
      return 'Fixed buffer allocation';
    }
    if (gpaCount > 0) {
      return 'General purpose allocation';
    }
    if (pageAllocCount > 0) {
      return 'Page-based allocation';
    }
    return 'Default allocator usage';
  }

  private async generateCode(prompt: string, context?: string): Promise<string> {
    Logger.debug(`Generating code for prompt: ${prompt}`);

    // Parse requirements and generate appropriate code using new utility classes
    const requirements = ZigCodeGenerator.parseRequirements(prompt, context);
    const code = ZigCodeGenerator.generateZigCode(requirements);

    return `
# Generated Zig Code

${code}

## Generation Notes:
- Code follows modern Zig patterns and style guide
- Includes comprehensive error handling where appropriate
- Uses comptime optimizations when beneficial
- Includes basic tests and documentation
- Follows zero-cost abstraction principles

## Next Steps:
1. Review and customize the generated code for your specific needs
2. Add comprehensive tests
3. Consider performance implications for your use case
4. Add proper documentation comments
    `.trim();
  }

  private async getRecommendations(code: string, prompt?: string): Promise<string> {
    Logger.debug(`Analyzing code for recommendations${prompt ? ` with focus: ${prompt}` : ''}`);

    // Comprehensive analysis using all enhanced analysis methods
    const analysis = {
      style: ZigStyleChecker.analyzeCodeStyle(code),
      patterns: ZigStyleChecker.analyzePatterns(code),
      safety: ZigStyleChecker.analyzeSafety(code),
      performance: ZigStyleChecker.analyzePerformance(code),
      concurrency: ZigStyleChecker.analyzeConcurrency(code),
      metaprogramming: ZigStyleChecker.analyzeMetaprogramming(code),
      testing: ZigStyleChecker.analyzeTesting(code),
      buildSystem: ZigStyleChecker.analyzeBuildSystem(code),
      interop: ZigStyleChecker.analyzeInterop(code),
      metrics: ZigStyleChecker.analyzeCodeMetrics(code),
      modernPatterns: ZigStyleChecker.analyzeModernZigPatterns(code),
    };

    let recommendations = `
# 🔍 Comprehensive Zig Code Analysis

## 📐 Style and Conventions
${analysis.style}

## 🏗️ Design Patterns & Architecture
${analysis.patterns}

## 🛡️ Safety & Security Analysis
${analysis.safety}

## ⚡ Performance Analysis
${analysis.performance}

## 🧵 Concurrency & Threading
${analysis.concurrency}

## 🎨 Metaprogramming & Compile-time
${analysis.metaprogramming}

## 🧪 Testing & Quality Assurance
${analysis.testing}

## 🔧 Build System Integration
${analysis.buildSystem}

## 🔗 Interoperability
${analysis.interop}

## 📊 Code Metrics & Maintainability
${analysis.metrics}

## ✨ Modern Zig Patterns (0.12+)
${analysis.modernPatterns}

## 🎯 Best Practices Summary
- **Memory Management**: Use RAII patterns with defer, prefer arena allocators for batch operations
- **Error Handling**: Implement comprehensive error unions and proper propagation
- **Performance**: Leverage comptime evaluation, consider SIMD for data-parallel operations
- **Safety**: Enable runtime safety in debug builds, use explicit initialization
- **Testing**: Maintain high test coverage with property-based testing where applicable
- **Documentation**: Use comprehensive doc comments (//!) for modules and (///) for functions
- **Modern Patterns**: Adopt Zig 0.12+ syntax and leverage new standard library features
- **Build System**: Use build.zig.zon for dependency management, support cross-compilation
- **Code Quality**: Maintain low cyclomatic complexity, follow single responsibility principle
- **Concurrency**: Use proper synchronization primitives, consider async/await for I/O bound tasks

## 🚀 Advanced Optimization Recommendations
- **Compile-time Optimization**: Move more computations to comptime where possible
- **Memory Layout**: Use packed structs for memory-critical applications
- **SIMD Utilization**: Consider vectorization for mathematical operations
- **Profile-Guided Optimization**: Use zig build -Doptimize=ReleaseFast -Dcpu=native
- **Static Analysis**: Integrate additional linting tools in your build pipeline
- **Fuzzing**: Implement fuzz testing for input validation functions
- **Benchmarking**: Add performance regression tests for critical paths
    `.trim();

    // Add context-specific recommendations based on the prompt
    if (prompt) {
      recommendations += `\n\n## 🎯 Specific Recommendations for "${prompt}":\n`;
      recommendations += this.getSpecificRecommendations(code, prompt);
      
      // Add advanced context-specific analysis
      recommendations += this.getAdvancedContextRecommendations(code, prompt);
    }

    return recommendations;
  }

  private getAdvancedContextRecommendations(code: string, prompt: string): string {
    const advanced: string[] = [];
    const contextLower = prompt.toLowerCase();

    // === PERFORMANCE CONTEXT ===
    if (contextLower.includes('performance') || contextLower.includes('optimization')) {
      advanced.push('\n### 🔥 Advanced Performance Strategies:');
      advanced.push('- **Hot Path Analysis**: Profile with perf to identify bottlenecks');
      advanced.push('- **Memory Allocator Tuning**: Consider custom allocators for specific workloads');
      advanced.push('- **Cache Optimization**: Align data structures to cache line boundaries');
      advanced.push('- **Branch Prediction**: Use @branchHint for predictable branches');
      advanced.push('- **Inlining Strategy**: Profile inline vs call overhead for hot functions');
      advanced.push('- **SIMD Exploitation**: Use @Vector for parallel arithmetic operations');
      advanced.push('- **Compile-time Constants**: Move runtime calculations to comptime where possible');
    }

    // === SAFETY CONTEXT ===
    if (contextLower.includes('safety') || contextLower.includes('security')) {
      advanced.push('\n### 🛡️ Advanced Safety & Security:');
      advanced.push('- **Memory Safety**: Enable AddressSanitizer in debug builds');
      advanced.push('- **Integer Safety**: Use @setRuntimeSafety(true) for critical calculations');
      advanced.push('- **Crypto Safety**: Use constant-time operations for sensitive data');
      advanced.push('- **Input Validation**: Implement comprehensive bounds checking');
      advanced.push('- **Error Recovery**: Design graceful degradation for error conditions');
      advanced.push('- **Resource Limits**: Implement timeouts and resource quotas');
      advanced.push('- **Fuzzing Strategy**: Generate test cases for edge conditions');
    }

    // === MAINTAINABILITY CONTEXT ===
    if (contextLower.includes('maintainability') || contextLower.includes('refactor')) {
      advanced.push('\n### 🔧 Advanced Maintainability:');
      advanced.push('- **Module Design**: Follow single responsibility principle strictly');
      advanced.push('- **API Design**: Minimize public surface area, use const parameters');
      advanced.push('- **Type Safety**: Leverage Zig\'s type system for compile-time guarantees');
      advanced.push('- **Documentation**: Use doctests for executable examples');
      advanced.push('- **Versioning**: Plan for API evolution with semantic versioning');
      advanced.push('- **Testing Strategy**: Implement property-based testing for complex functions');
      advanced.push('- **Code Metrics**: Monitor complexity trends over time');
    }

    // === CONCURRENCY CONTEXT ===
    if (contextLower.includes('concurrent') || contextLower.includes('thread') || contextLower.includes('async')) {
      advanced.push('\n### 🧵 Advanced Concurrency Patterns:');
      advanced.push('- **Lock-free Design**: Use atomic operations where possible');
      advanced.push('- **Work Stealing**: Implement efficient task distribution');
      advanced.push('- **Memory Ordering**: Understand acquire/release semantics');
      advanced.push('- **Async Patterns**: Design for cooperative multitasking');
      advanced.push('- **Resource Pooling**: Minimize allocation in concurrent contexts');
      advanced.push('- **Deadlock Prevention**: Establish lock ordering conventions');
      advanced.push('- **Performance Monitoring**: Track contention and utilization metrics');
    }

    // === ARCHITECTURE CONTEXT ===
    if (contextLower.includes('architecture') || contextLower.includes('design')) {
      advanced.push('\n### 🏗️ Advanced Architectural Patterns:');
      advanced.push('- **Dependency Injection**: Use comptime-based DI for testability');
      advanced.push('- **Event Sourcing**: Consider immutable event logs for state management');
      advanced.push('- **Plugin Architecture**: Design for extensibility with comptime interfaces');
      advanced.push('- **Error Boundaries**: Implement fault isolation strategies');
      advanced.push('- **Configuration Management**: Use comptime for compile-time configuration');
      advanced.push('- **Observability**: Build in logging, metrics, and tracing from the start');
      advanced.push('- **Backward Compatibility**: Plan for API evolution strategies');
    }

    return advanced.join('\n');
  }

  private getSpecificRecommendations(code: string, prompt: string): string {
    const recommendations: string[] = [];

    // Add context-specific recommendations based on the prompt
    if (prompt.toLowerCase().includes('performance')) {
      recommendations.push('- Use comptime when possible to move computations to compile time');
      recommendations.push('- Consider using packed structs for memory optimization');
      recommendations.push('- Implement custom allocators for specific use cases');
      recommendations.push('- Profile with `zig build -Doptimize=ReleaseFast` for production');
      recommendations.push('- Use SIMD operations for data-parallel computations');
    }

    if (prompt.toLowerCase().includes('safety')) {
      recommendations.push('- Add bounds checking for array access');
      recommendations.push('- Use explicit error handling with try/catch');
      recommendations.push('- Implement proper resource cleanup with defer');
      recommendations.push('- Avoid undefined behavior with proper initialization');
      recommendations.push('- Use runtime safety checks in debug builds');
    }

    if (prompt.toLowerCase().includes('maintainability')) {
      recommendations.push('- Add comprehensive documentation with //! and ///');
      recommendations.push('- Break down complex functions into smaller, focused units');
      recommendations.push('- Use meaningful variable and function names');
      recommendations.push('- Implement proper module structure');
      recommendations.push('- Add comprehensive test coverage');
    }
    
    // Check for outdated Zig syntax (pre-0.11)
    if (code.match(/@intCast\(\s*\w+\s*,/)) {
      recommendations.push('- Update @intCast syntax: use @intCast(value) instead of @intCast(Type, value)');
    }
    if (code.match(/@floatCast\(\s*\w+\s*,/)) {
      recommendations.push('- Update @floatCast syntax: use @floatCast(value) instead of @floatCast(Type, value)');
    }

    if (prompt.toLowerCase().includes('memory')) {
      recommendations.push('- Consider arena allocators for batch allocations');
      recommendations.push('- Use fixed buffer allocators for known-size data');
      recommendations.push('- Implement proper deinitialization patterns');
      recommendations.push('- Profile memory usage in production scenarios');
    }

    return recommendations.length > 0
      ? recommendations.join('\n')
      : '- No specific recommendations for this context';
  }

  private async generateBuildZig(args: Record<string, any>): Promise<string> {
    Logger.debug('Generating build.zig file');

    const config: Partial<ZigBuildConfig> = {
      zigVersion: args.zigVersion || '0.12.0',
      buildMode: args.optimizationLevel || 'ReleaseSafe',
      dependencies: {},
      buildSteps: [],
    };

    // Add dependencies if provided
    if (Array.isArray(args.dependencies)) {
      for (const dep of args.dependencies) {
        config.dependencies![dep] = `dependency("${dep}")`;
      }
    }

    const buildZigContent = ZigBuildSystemHelper.generateBuildZig(config);

    return `
# Generated build.zig

\`\`\`zig
${buildZigContent}
\`\`\`

## Usage Instructions:

1. **Build the project:**
   \`\`\`bash
   zig build
   \`\`\`

2. **Run the application:**
   \`\`\`bash
   zig build run
   \`\`\`

3. **Run tests:**
   \`\`\`bash
   zig build test
   \`\`\`

4. **Build for different targets:**
   \`\`\`bash
   zig build -Dtarget=x86_64-windows-gnu
   zig build -Dtarget=aarch64-linux-gnu
   \`\`\`

5. **Different optimization modes:**
   \`\`\`bash
   zig build -Doptimize=Debug
   zig build -Doptimize=ReleaseFast
   \`\`\`

## Next Steps:
- Customize the build script for your specific needs
- Add additional build steps or dependencies as required
- Consider using build.zig.zon for dependency management
    `.trim();
  }

  private analyzeBuildZig(buildZigContent: string): string {
    Logger.debug('Analyzing build.zig content');

    const recommendations = ZigBuildSystemHelper.analyzeBuildZig(buildZigContent);

    return `
# Build.zig Analysis Results

## Recommendations:
${recommendations.map(rec => `- ${rec}`).join('\n')}

## Modern Zig Build System Features to Consider:

### 1. Dependency Management (Zig 0.11+)
- Use build.zig.zon for managing dependencies
- Replace manual @import() with b.dependency()

### 2. Cross-compilation Support
- Use standardTargetOptions() for flexible target selection
- Support multiple architectures out of the box

### 3. Build Options
- Add configurable build options with b.addOptions()
- Support feature flags and conditional compilation

### 4. Testing Integration
- Include comprehensive test steps
- Support different test configurations

### 5. Documentation Generation
- Add documentation generation steps
- Include examples and usage guides

## Example Modernization:

\`\`\`zig
// Old pattern (deprecated)
exe.setTarget(target);
exe.setBuildMode(mode);

// New pattern (modern)
const exe = b.addExecutable(.{
    .name = "my-app",
    .root_source_file = .{ .path = "src/main.zig" },
    .target = target,
    .optimize = optimize,
});
\`\`\`
    `.trim();
  }

  private generateBuildZon(args: Record<string, any>): string {
    Logger.debug('Generating build.zig.zon file');

    const _projectName = args.projectName || 'my-project';
    const dependencies = Array.isArray(args.dependencies) ? args.dependencies : [];

    const buildZonContent = ZigBuildSystemHelper.generateBuildZon(dependencies);

    return `
# Generated build.zig.zon

\`\`\`zig
${buildZonContent}
\`\`\`

## Dependency Management Instructions:

1. **Add a new dependency:**
   - Add the dependency to the .dependencies section
   - Run \`zig build --fetch\` to download and validate

2. **Update dependency hashes:**
   - Zig will provide the correct hash when a mismatch is detected
   - Copy the hash from the error message to build.zig.zon

3. **Use dependencies in build.zig:**
   \`\`\`zig
   const my_dep = b.dependency("my_dep", .{
       .target = target,
       .optimize = optimize,
   });
   exe.linkLibrary(my_dep.artifact("my_dep"));
   \`\`\`

## Popular Zig Dependencies:
${Object.entries(ZigBuildSystemHelper.getExampleDependencies())
  .map(([_key, dep]) => `- **${dep.name}**: ${dep.url}`)
  .join('\n')}

## Best Practices:
- Keep dependencies minimal and well-maintained
- Pin to specific versions or commits for reproducible builds
- Regularly update dependencies for security fixes
- Document why each dependency is needed
    `.trim();
  }

  private generateBuildExamples(): string {
    const examples = [
      {
        name: 'Basic Executable',
        description: 'Simple executable with modern build patterns',
        config: { zigVersion: '0.12.0', buildMode: 'ReleaseSafe' as OptimizationLevel },
      },
      {
        name: 'Library with Dependencies',
        description: 'Library project with external dependencies',
        config: {
          zigVersion: '0.12.0',
          buildMode: 'ReleaseSafe' as OptimizationLevel,
          dependencies: { args: 'https://github.com/MasterQ32/zig-args' },
        },
      },
      {
        name: 'Cross-platform Application',
        description: 'Application configured for multiple platforms',
        config: {
          zigVersion: '0.12.0',
          buildMode: 'ReleaseFast' as OptimizationLevel,
          targetTriple: 'native',
        },
      },
    ];

    return examples
      .map(
        example => `
## ${example.name}
${example.description}

\`\`\`zig
${ZigBuildSystemHelper.generateBuildZig(example.config)}
\`\`\`
`
      )
      .join('\n---\n');
  }

  async run(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      Logger.info('Zig MCP server running on stdio');
    } catch (error) {
      Logger.error('Failed to start server', error as Error);
      process.exit(1);
    }
  }
}

const server = new ZigServer();
server.run().catch(console.error);
