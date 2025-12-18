/**
 * Zig Build System utilities and knowledge base
 */

import type {
  ZigBuildConfig,
  ZigProjectStructure,
  ZigBuildStep,
  ZigModuleDependency,
  OptimizationLevel,
  ZigTargetArchitecture,
} from './types.js';

// Ensure all imported types are used by creating a type guard
// This prevents linting errors while maintaining type safety
type _UnusedTypes = ZigProjectStructure | ZigBuildStep | OptimizationLevel | ZigTargetArchitecture;

export class ZigBuildSystemHelper {
  /**
   * Generates a basic build.zig file with modern Zig patterns
   */
  static generateBuildZig(config: Partial<ZigBuildConfig>): string {
    const {
      zigVersion = '0.14.0',
      buildMode: _buildMode = 'ReleaseSafe',
      targetTriple: _targetTriple,
      dependencies = {},
      buildSteps: _buildSteps = [],
    } = config;

    return `//! Build script for Zig project
//! Zig version: ${zigVersion}+
//! Modern build system with enhanced module support

const std = @import("std");

pub fn build(b: *std.Build) void {
    // Standard target options allow the person running \`zig build\` to choose
    // what target to build for. Here we do not override the defaults, which
    // means any target is allowed, and the default is native.
    const target = b.standardTargetOptions(.{});

    // Standard optimization options allow the person running \`zig build\` to select
    // between Debug, ReleaseSafe, ReleaseFast, and ReleaseSmall.
    const optimize = b.standardOptimizeOption(.{});

    // Create the main executable
    const exe = b.addExecutable(.{
        .name = "main",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    // Add dependencies using modern module system
${Object.entries(dependencies)
  .map(
    ([name, _path]) =>
      `    const ${name}_dep = b.dependency("${name}", .{
        .target = target,
        .optimize = optimize,
    });
    exe.root_module.addImport("${name}", ${name}_dep.module("${name}"));`
  )
  .join('\n')}

    // Install the executable
    b.installArtifact(exe);

    // Create a run step
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());

    // Forward arguments to the run step
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the application");
    run_step.dependOn(&run_cmd.step);

    // Create test step
    const unit_tests = b.addTest(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);

    // Add documentation generation step
    const docs_step = b.step("docs", "Generate documentation");
    const docs_install = b.addInstallDirectory(.{
        .source_dir = exe.getEmittedDocs(),
        .install_dir = .prefix,
        .install_subdir = "docs",
    });
    docs_step.dependOn(&docs_install.step);
}`;
  }

  /**
   * Generates a build.zig.zon file for dependency management
   */
  static generateBuildZon(dependencies: ZigModuleDependency[]): string {
    return `.{
    .name = "my-project",
    .version = "0.1.0",
    .minimum_zig_version = "0.14.0",
    
    .dependencies = .{
${dependencies
  .map(
    dep => `        .${dep.name} = .{
            .url = "${dep.url || `https://github.com/example/${dep.name}`}",
            .hash = "1220000000000000000000000000000000000000000000000000000000000000",
        },`
  )
  .join('\n')}
    },
    
    .paths = .{
        "build.zig",
        "build.zig.zon",
        "src",
        // "examples",
        // "test",
        // "README.md",
        // "LICENSE",
    },
}`;
  }

  /**
   * Provides Zig build system best practices
   */
  static getBuildSystemBestPractices(): string {
    return `# Zig Build System Best Practices (Zig 0.14+)

## Project Structure
\`\`\`
my-project/
├── build.zig          # Main build script
├── build.zig.zon     # Dependency management (Zig 0.11+)
├── src/
│   ├── main.zig      # Application entry point
│   ├── lib.zig       # Library root (if applicable)
│   └── ...           # Other source files
├── test/             # Integration tests
├── examples/         # Example code
└── docs/            # Documentation
\`\`\`

## Build.zig Modern Patterns (Zig 0.14+)

### 1. Use b.path() for File Paths (Zig 0.14+)
\`\`\`zig
const exe = b.addExecutable(.{
    .name = "my-app",
    .root_source_file = b.path("src/main.zig"),  // Modern: use b.path()
    .target = target,
    .optimize = optimize,
});
\`\`\`

### 2. Modern Module System with root_module
\`\`\`zig
const dep = b.dependency("my_dep", .{
    .target = target,
    .optimize = optimize,
});
// Use root_module.addImport for cleaner module management
exe.root_module.addImport("my_dep", dep.module("my_dep"));
\`\`\`

### 3. Cross-compilation Support
\`\`\`zig
const target = b.standardTargetOptions(.{});
\`\`\`

### 4. Build Options
\`\`\`zig
const config = b.addOptions();
config.addOption(bool, "enable_logging", true);
exe.addOptions("config", config);
\`\`\`

### 5. System Library Linking
\`\`\`zig
exe.linkSystemLibrary("c");
exe.linkSystemLibrary("pthread");
\`\`\`

## Common Build Steps

### Testing
\`\`\`zig
const test_step = b.step("test", "Run tests");
const unit_tests = b.addTest(.{
    .root_source_file = .{ .path = "src/main.zig" },
    .target = target,
    .optimize = optimize,
});
test_step.dependOn(&b.addRunArtifact(unit_tests).step);
\`\`\`

### Documentation Generation
\`\`\`zig
const docs = b.addInstallDirectory(.{
    .source_dir = exe.getEmittedDocs(),
    .install_dir = .prefix,
    .install_subdir = "docs",
});
const docs_step = b.step("docs", "Generate documentation");
docs_step.dependOn(&docs.step);
\`\`\`

### Custom Install Steps
\`\`\`zig
const install_step = b.addInstallFileWithDir(
    .{ .path = "config.toml" },
    .{ .custom = "config" },
    "config.toml"
);
b.getInstallStep().dependOn(&install_step.step);
\`\`\`

## Performance Tips

1. **Use ReleaseFast for production**: Maximizes runtime performance
2. **Use ReleaseSafe for production with safety**: Keeps runtime safety checks
3. **Use ReleaseSmall for size-constrained environments**: Optimizes for binary size
4. **Use Debug for development**: Fastest compilation, full debug info

## Cross-compilation Examples

\`\`\`bash
# Windows from Linux/macOS
zig build -Dtarget=x86_64-windows-gnu

# macOS from Linux/Windows  
zig build -Dtarget=x86_64-macos-none

# WebAssembly
zig build -Dtarget=wasm32-freestanding-musl

# ARM64 Linux
zig build -Dtarget=aarch64-linux-gnu
\`\`\`

## Common Gotchas & Migration Tips

### Zig 0.14 Changes:
1. **Use b.path()** instead of .{ .path = "file.zig" } for file paths
2. **Use root_module.addImport()** for adding module dependencies
3. **Always specify .target and .optimize** in build API
4. **Dependencies must be declared in build.zig.zon** for Zig 0.11+
5. **Use b.dependency() instead of @import()** for external dependencies
6. **Install artifacts with b.installArtifact()** instead of manual install steps

### Migration from 0.12 to 0.14:
\`\`\`zig
// Old (0.12):
.root_source_file = .{ .path = "src/main.zig" },
exe.addModule("dep", dep.module("dep"));

// New (0.14):
.root_source_file = b.path("src/main.zig"),
exe.root_module.addImport("dep", dep.module("dep"));
\`\`\``;
  }

  /**
   * Analyzes a build.zig file and provides recommendations
   */
  static analyzeBuildZig(buildZigContent: string): string[] {
    const recommendations: string[] = [];

    // Check for deprecated patterns
    if (buildZigContent.includes('Builder')) {
      recommendations.push('Update to new Build API: replace Builder with std.Build');
    }

    if (buildZigContent.includes('setTarget')) {
      recommendations.push('Use standardTargetOptions() instead of setTarget()');
    }

    if (buildZigContent.includes('setBuildMode')) {
      recommendations.push('Use standardOptimizeOption() instead of setBuildMode()');
    }

    if (buildZigContent.includes('@import') && buildZigContent.includes('build.zig')) {
      recommendations.push(
        'Consider using b.dependency() for external dependencies instead of @import()'
      );
    }

    // Check for Zig 0.14+ patterns
    if (buildZigContent.includes('.{ .path = ') && !buildZigContent.includes('b.path(')) {
      recommendations.push(
        'Modernize to Zig 0.14+: use b.path("file.zig") instead of .{ .path = "file.zig" }'
      );
    }

    if (
      buildZigContent.includes('.addModule(') &&
      !buildZigContent.includes('root_module.addImport(')
    ) {
      recommendations.push(
        'Modernize to Zig 0.14+: use exe.root_module.addImport() instead of exe.addModule()'
      );
    }

    if (
      buildZigContent.includes('linkLibrary') &&
      !buildZigContent.includes('root_module.addImport')
    ) {
      recommendations.push('Consider using root_module.addImport() for modern module dependencies');
    }

    // Check for missing best practices
    if (!buildZigContent.includes('standardTargetOptions')) {
      recommendations.push('Add standardTargetOptions() for cross-compilation support');
    }

    if (!buildZigContent.includes('standardOptimizeOption')) {
      recommendations.push('Add standardOptimizeOption() for build mode selection');
    }

    if (!buildZigContent.includes('addTest')) {
      recommendations.push('Consider adding test step with addTest()');
    }

    if (!buildZigContent.includes('installArtifact')) {
      recommendations.push('Use installArtifact() to install built executables/libraries');
    }

    if (!buildZigContent.includes('getEmittedDocs')) {
      recommendations.push(
        'Add documentation generation with getEmittedDocs() and addInstallDirectory()'
      );
    }

    return recommendations.length > 0
      ? recommendations
      : ['Build file follows modern Zig patterns'];
  }

  /**
   * Generates example dependency configurations
   */
  static getExampleDependencies(): Record<string, ZigModuleDependency> {
    return {
      'zig-args': {
        name: 'args',
        url: 'https://github.com/MasterQ32/zig-args',
        path: 'args.zig',
        version: 'main',
      },
      'zig-json': {
        name: 'json',
        url: 'https://github.com/getty-zig/json',
        path: 'json.zig',
        version: 'main',
      },
      'zig-network': {
        name: 'network',
        url: 'https://github.com/MasterQ32/zig-network',
        path: 'network.zig',
        version: 'main',
      },
      zigimg: {
        name: 'zigimg',
        url: 'https://github.com/zigimg/zigimg',
        path: 'zigimg.zig',
        version: 'main',
      },
    };
  }

  /**
   * Provides troubleshooting guide for common build issues
   */
  static getBuildTroubleshooting(): string {
    return `# Zig Build System Troubleshooting

## Common Issues and Solutions

### 1. "error: unable to find zig installation directory"
**Solution**: 
- Ensure Zig is properly installed and in your PATH
- Use absolute path to zig binary if needed
- Verify installation: \`zig version\`

### 2. "error: dependency not found"
**Solution**:
- Check build.zig.zon file exists and dependencies are listed
- Run \`zig build --fetch\` to download dependencies
- Verify dependency URLs and hashes are correct

### 3. "error: unable to create output directory"
**Solution**:
- Check file permissions in project directory
- Ensure adequate disk space
- Try cleaning build cache: \`rm -rf zig-cache zig-out\`

### 4. Cross-compilation linking errors
**Solution**:
- Install target system libraries if needed
- Use \`-fno-sanitize=undefined\` for some targets
- Check target triple is correct

### 5. "error: unable to parse build.zig"
**Solution**:
- Check Zig syntax in build.zig
- Ensure all imports are valid
- Use \`zig fmt build.zig\` to format and catch errors

### 6. Slow build times
**Solutions**:
- Use incremental compilation (default in newer Zig versions)
- Reduce debug info in release builds
- Use \`--cache-dir\` to specify cache location
- Consider parallel builds with \`-j<n>\`

### 7. "hash mismatch" for dependencies
**Solution**:
- Update hash in build.zig.zon
- Use \`zig build --fetch\` to get correct hash
- Verify dependency URL is correct

## Build Cache Management

\`\`\`bash
# Clear build cache
rm -rf zig-cache zig-out

# Use custom cache directory
zig build --cache-dir /tmp/zig-cache

# Force rebuild
zig build --verbose
\`\`\`

## Debugging Build Issues

\`\`\`bash
# Verbose output
zig build --verbose

# Show all available steps
zig build --help

# Debug mode for development
zig build -Doptimize=Debug

# Show dependency tree
zig build --verbose | grep dependency
\`\`\``;
  }
}
