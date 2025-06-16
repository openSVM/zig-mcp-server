# Zig MCP Server
[![smithery badge](https://smithery.ai/badge/zig-mcp-server)](https://smithery.ai/server/zig-mcp-server)

A Model Context Protocol (MCP) server that provides Zig language tooling, code analysis, and documentation access. This server enhances AI capabilities with Zig-specific functionality including code optimization, compute unit estimation, code generation, and best practices recommendations.

<a href="https://glama.ai/mcp/servers/oxiw2bsb15"><img width="380" height="200" src="https://glama.ai/mcp/servers/oxiw2bsb15/badge" alt="Zig Server MCP server" /></a>

## Features

### Tools

#### 1. Code Optimization (`optimize_code`)
Analyzes and optimizes Zig code with support for different optimization levels:
- Debug
- ReleaseSafe
- ReleaseFast
- ReleaseSmall

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
            try list.append(@intCast(u8, i));
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