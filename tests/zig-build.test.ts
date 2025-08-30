import { ZigBuildSystemHelper } from '../src/zig-build.js';

describe('ZigBuildSystemHelper', () => {
  describe('generateBuildZig', () => {
    it('should generate basic build.zig', () => {
      const config = {
        zigVersion: '0.12.0',
        buildMode: 'ReleaseSafe' as const,
      };
      const result = ZigBuildSystemHelper.generateBuildZig(config);
      
      expect(result).toContain('//! Build script for Zig project');
      expect(result).toContain('//! Zig version: 0.12.0');
      expect(result).toContain('const std = @import("std");');
      expect(result).toContain('pub fn build(b: *std.Build) void');
      expect(result).toContain('b.standardTargetOptions');
      expect(result).toContain('b.standardOptimizeOption');
      expect(result).toContain('b.addExecutable');
      expect(result).toContain('b.installArtifact');
    });

    it('should include dependencies', () => {
      const config = {
        dependencies: {
          'args': 'dependency("args")',
          'json': 'dependency("json")',
        },
      };
      const result = ZigBuildSystemHelper.generateBuildZig(config);
      
      expect(result).toContain('const args_dep = b.dependency("args"');
      expect(result).toContain('const json_dep = b.dependency("json"');
      expect(result).toContain('exe.linkLibrary(args_dep.artifact("args"));');
      expect(result).toContain('exe.linkLibrary(json_dep.artifact("json"));');
    });

    it('should include test step', () => {
      const result = ZigBuildSystemHelper.generateBuildZig({});
      
      expect(result).toContain('const unit_tests = b.addTest');
      expect(result).toContain('const test_step = b.step("test", "Run unit tests");');
    });

    it('should include run step', () => {
      const result = ZigBuildSystemHelper.generateBuildZig({});
      
      expect(result).toContain('const run_cmd = b.addRunArtifact(exe);');
      expect(result).toContain('const run_step = b.step("run", "Run the application");');
    });
  });

  describe('generateBuildZon', () => {
    it('should generate basic build.zig.zon', () => {
      const dependencies: any[] = [];
      const result = ZigBuildSystemHelper.generateBuildZon(dependencies);
      
      expect(result).toContain('.name = "my-project"');
      expect(result).toContain('.version = "0.1.0"');
      expect(result).toContain('.minimum_zig_version = "0.12.0"');
      expect(result).toContain('.dependencies = .{');
      expect(result).toContain('.paths = .{');
    });

    it('should include dependencies', () => {
      const dependencies = [
        { name: 'args', url: 'https://github.com/MasterQ32/zig-args' },
        { name: 'json', url: 'https://github.com/getty-zig/json' },
      ];
      const result = ZigBuildSystemHelper.generateBuildZon(dependencies);
      
      expect(result).toContain('.args = .{');
      expect(result).toContain('"https://github.com/MasterQ32/zig-args"');
      expect(result).toContain('.json = .{');
      expect(result).toContain('"https://github.com/getty-zig/json"');
    });

    it('should include standard paths', () => {
      const result = ZigBuildSystemHelper.generateBuildZon([]);
      
      expect(result).toContain('"build.zig"');
      expect(result).toContain('"build.zig.zon"');
      expect(result).toContain('"src"');
    });
  });

  describe('getBuildSystemBestPractices', () => {
    it('should return comprehensive best practices guide', () => {
      const result = ZigBuildSystemHelper.getBuildSystemBestPractices();
      
      expect(result).toContain('# Zig Build System Best Practices');
      expect(result).toContain('## Project Structure');
      expect(result).toContain('build.zig');
      expect(result).toContain('build.zig.zon');
      expect(result).toContain('## Build.zig Modern Patterns');
      expect(result).toContain('b.addExecutable');
      expect(result).toContain('standardTargetOptions');
      expect(result).toContain('## Cross-compilation Examples');
    });

    it('should include examples of old vs new patterns', () => {
      const result = ZigBuildSystemHelper.getBuildSystemBestPractices();
      
      expect(result).toContain('// Old pattern');
      expect(result).toContain('// New pattern');
      expect(result).toContain('setTarget'); // deprecated
      expect(result).toContain('setBuildMode'); // deprecated
    });

    it('should include cross-compilation examples', () => {
      const result = ZigBuildSystemHelper.getBuildSystemBestPractices();
      
      expect(result).toContain('x86_64-windows-gnu');
      expect(result).toContain('aarch64-linux-gnu');
      expect(result).toContain('wasm32-freestanding-musl');
    });
  });

  describe('analyzeBuildZig', () => {
    it('should detect deprecated Builder usage', () => {
      const oldCode = `
        const Builder = @import("std").build.Builder;
        pub fn build(b: *Builder) void {}
      `;
      const result = ZigBuildSystemHelper.analyzeBuildZig(oldCode);
      
      expect(result).toContain('Update to new Build API: replace Builder with std.Build');
    });

    it('should detect deprecated setTarget', () => {
      const oldCode = 'exe.setTarget(target);';
      const result = ZigBuildSystemHelper.analyzeBuildZig(oldCode);
      
      expect(result).toContain('Use standardTargetOptions() instead of setTarget()');
    });

    it('should detect deprecated setBuildMode', () => {
      const oldCode = 'exe.setBuildMode(mode);';
      const result = ZigBuildSystemHelper.analyzeBuildZig(oldCode);
      
      expect(result).toContain('Use standardOptimizeOption() instead of setBuildMode()');
    });

    it('should suggest adding standardTargetOptions', () => {
      const code = 'pub fn build(b: *std.Build) void {}';
      const result = ZigBuildSystemHelper.analyzeBuildZig(code);
      
      expect(result).toContain('Add standardTargetOptions() for cross-compilation support');
    });

    it('should suggest adding test step', () => {
      const code = 'const exe = b.addExecutable(.{});';
      const result = ZigBuildSystemHelper.analyzeBuildZig(code);
      
      expect(result).toContain('Consider adding test step with addTest()');
    });

    it('should suggest using installArtifact', () => {
      const code = 'const exe = b.addExecutable(.{});';
      const result = ZigBuildSystemHelper.analyzeBuildZig(code);
      
      expect(result).toContain('Use installArtifact() to install built executables/libraries');
    });

    it('should approve modern build files', () => {
      const modernCode = `
        const std = @import("std");
        pub fn build(b: *std.Build) void {
          const target = b.standardTargetOptions(.{});
          const optimize = b.standardOptimizeOption(.{});
          const exe = b.addExecutable(.{});
          const test_step = b.addTest(.{});
          b.installArtifact(exe);
        }
      `;
      const result = ZigBuildSystemHelper.analyzeBuildZig(modernCode);
      
      expect(result).toContain('Build file follows modern Zig patterns');
    });
  });

  describe('getExampleDependencies', () => {
    it('should return popular Zig dependencies', () => {
      const result = ZigBuildSystemHelper.getExampleDependencies();
      
      expect(result).toHaveProperty('zig-args');
      expect(result).toHaveProperty('zig-json');
      expect(result).toHaveProperty('zig-network');
      expect(result).toHaveProperty('zigimg');
      
      expect(result['zig-args'].name).toBe('args');
      expect(result['zig-args'].url).toContain('github.com');
    });

    it('should include proper dependency structure', () => {
      const result = ZigBuildSystemHelper.getExampleDependencies();
      
      for (const [key, dep] of Object.entries(result)) {
        expect(dep).toHaveProperty('name');
        expect(dep).toHaveProperty('url');
        expect(dep).toHaveProperty('path');
        expect(dep).toHaveProperty('version');
      }
    });
  });

  describe('getBuildTroubleshooting', () => {
    it('should return comprehensive troubleshooting guide', () => {
      const result = ZigBuildSystemHelper.getBuildTroubleshooting();
      
      expect(result).toContain('# Zig Build System Troubleshooting');
      expect(result).toContain('## Common Issues and Solutions');
      expect(result).toContain('unable to find zig installation');
      expect(result).toContain('dependency not found');
      expect(result).toContain('hash mismatch');
    });

    it('should include build cache management', () => {
      const result = ZigBuildSystemHelper.getBuildTroubleshooting();
      
      expect(result).toContain('## Build Cache Management');
      expect(result).toContain('rm -rf zig-cache zig-out');
      expect(result).toContain('--cache-dir');
    });

    it('should include debugging commands', () => {
      const result = ZigBuildSystemHelper.getBuildTroubleshooting();
      
      expect(result).toContain('## Debugging Build Issues');
      expect(result).toContain('zig build --verbose');
      expect(result).toContain('zig build --help');
    });
  });
});