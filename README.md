# Zig MCP Server
[![smithery badge](https://smithery.ai/badge/zig-mcp-server)](https://smithery.ai/server/zig-mcp-server)

**Modern Zig AI 10x dev assistant with comprehensive build system support**

A powerful Model Context Protocol (MCP) server that provides comprehensive Zig language assistance, including modern build system support, code optimization, and best practices guidance.

<a href="https://glama.ai/mcp/servers/oxiw2bsb15"><img width="380" height="200" src="https://glama.ai/mcp/servers/oxiw2bsb15/badge" alt="Zig Server MCP server" /></a>

## 🚀 What's New in v0.2.0+

- **🏗️ Zig 0.15.2+ Support**: Fully updated with modern `b.path()` and `root_module` patterns
- **📦 Enhanced Module System**: Support for latest module system with `root_module.addImport()`
- **🔄 Migration Guidance**: Automated detection and upgrade suggestions for legacy patterns
- **🔧 Enhanced Code Analysis**: Improved optimization suggestions and modern pattern detection
- **🧪 Comprehensive Testing**: 85+ test cases with full coverage reporting
- **⚡ Better Code Quality**: Fixed all TypeScript compilation errors and linting issues
- **📚 Extended Documentation**: Complete Zig 0.15.2+ build system guide with migration tips

## 🛠️ Features

### 🏗️ Build System Tools (NEW!)

#### 1. Build System Generation (`generate_build_zig`)
Generate modern build.zig files with Zig 0.15.2+ patterns:
- Cross-compilation support with latest target options
- Modern dependency management with build.zig.zon
- Test and documentation integration
- Enhanced module system support

#### 2. Build System Analysis (`analyze_build_zig`) 
Analyze existing build files and get modernization recommendations:
- Detect deprecated patterns
- Suggest Zig 0.15.2+ alternatives
- Identify missing best practices
- Module system migration guidance

#### 3. Dependency Management (`generate_build_zon`)
Generate build.zig.zon files for modern package management:
- Popular Zig packages catalog
- Version management guidance
- Best practices documentation

## Features

### Tools

#### 1. Code Optimization (`optimize_code`)
Enhanced with modern Zig patterns and build mode analysis:
- Debug, ReleaseSafe, ReleaseFast, ReleaseSmall
- Modern optimization suggestions  
- Zig 0.12+ pattern recommendations

```typescript
// Example usage
{
  "code": "const std = @import(\"std\");\n...",
  "optimizationLevel": "ReleaseFast"
}
```

#### 2. Compute Units Estimation (`estimate_compute_units`)
Estimates computational complexity and resource usage of Zig code:
- Memory usage analysis
- Time complexity estimation
- Allocation patterns detection

```typescript
// Example usage
{
  "code": "const std = @import(\"std\");\n..."
}
```

#### 3. Code Generation (`generate_code`)
Generates Zig code from natural language descriptions with support for:
- Error handling
- Testing
- Performance optimizations
- Documentation

```typescript
// Example usage
{
  "prompt": "Create a function that sorts an array of integers",
  "context": "Should handle empty arrays and use comptime when possible"
}
```

#### 4. Code Recommendations (`get_recommendations`)
Provides code improvement recommendations and best practices:
- Style and conventions
- Design patterns
- Safety considerations
- Performance insights

```typescript
// Example usage
{
  "code": "const std = @import(\"std\");\n...",
  "prompt": "Improve performance and safety"
}
```

### Resources

1. **Language Reference** (`zig://docs/language-reference`)
   - Official Zig language documentation
   - Syntax and features guide
   - Best practices

2. **Standard Library Documentation** (`zig://docs/std-lib`)
   - Complete std library reference
   - Function signatures and usage
   - Examples and notes

3. **Popular Repositories** (`zig://repos/popular`)
   - Top Zig projects on GitHub
   - Community examples and patterns
   - Real-world implementations

## Installation

### Installing via Smithery

To install Zig MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/zig-mcp-server):

```bash
npx -y @smithery/cli install zig-mcp-server --client claude
```

### Manual Installation
1. Clone the repository:
```bash
git clone [repository-url]
cd zig-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the server:
```bash
npm run build
```

4. Configure environment variables:
```bash
# Create a GitHub token for better API rate limits
# https://github.com/settings/tokens
# Required scope: public_repo
GITHUB_TOKEN=your_token_here
```

5. Add to MCP settings:
```json
{
  "mcpServers": {
    "zig": {
      "command": "node",
      "args": ["/path/to/zig-mcp-server/build/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_token_here",
        "NODE_OPTIONS": "--experimental-vm-modules"
      },
      "restart": true
    }
  }
}
```

## Usage Examples

### 1. Optimize Code

```typescript
const result = await useMcpTool("zig", "optimize_code", {
  code: `
    pub fn fibonacci(n: u64) u64 {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
  `,
  optimizationLevel: "ReleaseFast"
});
```

### 2. Estimate Compute Units

```typescript
const result = await useMcpTool("zig", "estimate_compute_units", {
  code: `
    pub fn bubbleSort(arr: []i32) void {
        var i: usize = 0;
        while (i < arr.len) : (i += 1) {
            var j: usize = 0;
            while (j < arr.len - 1) : (j += 1) {
                if (arr[j] > arr[j + 1]) {
                    const temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                }
            }
        }
    }
  `
});
```

### 3. Generate Code

```typescript
const result = await useMcpTool("zig", "generate_code", {
  prompt: "Create a thread-safe counter struct",
  context: "Should use atomic operations and handle overflow"
});
```

### 4. Get Recommendations

```typescript
const result = await useMcpTool("zig", "get_recommendations", {
  code: `
    pub fn main() !void {
        var list = std.ArrayList(u8).init(allocator);
        var i: u32 = 0;
        while (true) {
            if (i >= 100) break;
            try list.append(@intCast(i));
            i += 1;
        }
    }
  `,
  prompt: "performance"
});
```

## Development

### Project Structure

```
zig-mcp-server/
├── src/
│   └── index.ts    # Main server implementation
├── build/          # Compiled JavaScript
├── package.json    # Dependencies and scripts
└── tsconfig.json   # TypeScript configuration
```

### Building

```bash
# Development build with watch mode
npm run watch

# Production build
npm run build
```

### Testing

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details.