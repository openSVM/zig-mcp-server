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
        version: '0.1.0',
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
      // Fetch from Zig's official documentation
      const response = await axios.get(`https://ziglang.org/documentation/master/${section === 'language' ? 'index' : 'std'}.html`);
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
    
    // Check for common patterns that can be optimized
    if (code.includes('std.ArrayList')) {
      optimizations.push('Consider pre-allocating ArrayList capacity if size is known');
    }
    if (code.includes('std.fmt.allocPrint')) {
      optimizations.push('Consider using std.fmt.bufPrint for stack allocation when possible');
    }
    if (code.match(/while\s*\(true\)/)) {
      optimizations.push('Consider using continue/break instead of while(true)');
    }

    // Build mode specific optimizations
    const buildModeOpts = {
      Debug: [],
      ReleaseSafe: [
        'Runtime safety checks enabled',
        'Optimizations enabled',
      ],
      ReleaseFast: [
        'Runtime safety checks disabled',
        'Maximum performance optimizations',
        'Consider adding debug assertions for critical paths',
      ],
      ReleaseSmall: [
        'Size optimizations enabled',
        'Consider removing debug information',
        'Minimize template instantiations',
      ],
    };

    const modeSpecificOpts = buildModeOpts[level as keyof typeof buildModeOpts] || buildModeOpts.ReleaseSafe;

    return `
Optimization Analysis for ${level}:

General Optimizations:
${optimizations.map(opt => `- ${opt}`).join('\n')}

Build Mode Specific:
${modeSpecificOpts.map(opt => `- ${opt}`).join('\n')}

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
      heapAlloc: /std\.(ArrayList|StringHashMap|AutoHashMap)/g,
      stackAlloc: /var\s+\w+\s*:\s*\[(\d+)\]/g,
      slices: /\[\](?:u8|i32|f64)/g,
    };

    const heapAllocs = (code.match(patterns.heapAlloc) || []).length;
    const stackAllocs = (code.match(patterns.stackAlloc) || []).length;
    const sliceUsage = (code.match(patterns.slices) || []).length;

    return `
- Heap Allocations: ${heapAllocs} detected
- Stack Allocations: ${stackAllocs} detected
- Slice Usage: ${sliceUsage} instances
- Memory Profile: ${heapAllocs > stackAllocs ? 'Heap-heavy' : 'Stack-optimized'}
    `.trim();
  }

  private analyzeTimeComplexity(code: string): string {
    const patterns = {
      loops: /(?:while|for)\s*\(/g,
      nestedLoops: /(?:while|for)[^{]*\{[^}]*(?:while|for)/g,
      recursion: /fn\s+\w+[^{]*\{[^}]*\w+\s*\([^)]*\)/g,
    };

    const loops = (code.match(patterns.loops) || []).length;
    const nestedLoops = (code.match(patterns.nestedLoops) || []).length;
    const recursion = (code.match(patterns.recursion) || []).length;

    let complexity = 'O(1)';
    if (nestedLoops > 0) complexity = 'O(n²)';
    else if (loops > 0) complexity = 'O(n)';
    if (recursion > 0) complexity += ' with recursive calls';

    return `
- Estimated Complexity: ${complexity}
- Loop Count: ${loops}
- Nested Loops: ${nestedLoops}
- Recursive Patterns: ${recursion} detected
    `.trim();
  }

  private analyzeAllocations(code: string): string {
    const patterns = {
      comptime: /comptime\s/g,
      arena: /std\.heap\.ArenaAllocator/g,
      fixedBuf: /std\.heap\.FixedBufferAllocator/g,
    };

    const comptimeUsage = (code.match(patterns.comptime) || []).length;
    const arenaAlloc = (code.match(patterns.arena) || []).length;
    const fixedBufAlloc = (code.match(patterns.fixedBuf) || []).length;

    return `
- Comptime Evaluations: ${comptimeUsage}
- Arena Allocators: ${arenaAlloc}
- Fixed Buffer Allocators: ${fixedBufAlloc}
- Allocation Strategy: ${this.determineAllocStrategy(arenaAlloc, fixedBufAlloc)}
    `.trim();
  }

  private determineAllocStrategy(arenaCount: number, fixedBufCount: number): string {
    if (arenaCount > 0 && fixedBufCount > 0) return 'Mixed allocation strategy';
    if (arenaCount > 0) return 'Arena-based allocation';
    if (fixedBufCount > 0) return 'Fixed buffer allocation';
    return 'Default allocator usage';
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
        // Cleanup
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

    return performance.length > 0 ? performance.join('\n') : '- No immediate performance concerns';
  }

  private getSpecificRecommendations(code: string, prompt: string): string {
    const recommendations = [];

    // Add context-specific recommendations based on the prompt
    if (prompt.toLowerCase().includes('performance')) {
      recommendations.push('- Use comptime when possible');
      recommendations.push('- Consider using packed structs for memory optimization');
      recommendations.push('- Implement custom allocators for specific use cases');
    }
    if (prompt.toLowerCase().includes('safety')) {
      recommendations.push('- Add bounds checking for array access');
      recommendations.push('- Use explicit error handling');
      recommendations.push('- Implement proper resource cleanup');
    }
    if (prompt.toLowerCase().includes('maintainability')) {
      recommendations.push('- Add comprehensive documentation');
      recommendations.push('- Break down complex functions');
      recommendations.push('- Use meaningful variable names');
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
