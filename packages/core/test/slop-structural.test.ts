// Phase 8.1 G4a (D-14): the slop kinds a regex cannot see. The new-dependency kind reads a manifest's text at the base and at HEAD.
import { expect, it } from 'vitest';
import { isManifest, newDependencies } from '../src/index.js';

const names = (found: { name: string; line: number }[]): string[] => found.map((d) => `${d.name}:${d.line}`);

it('risk:parsing a version bump is not a new dependency and every listed manifest is read (D-14)', () => {
  // package.json: a bump of `a` is not new; `left-pad` and a dev dependency are, each at its HEAD line
  const jsonBase = '{\n  "dependencies": {\n    "a": "^1.0.0"\n  },\n  "devDependencies": {}\n}\n';
  const jsonHead = '{\n  "dependencies": {\n    "a": "^2.0.0",\n    "left-pad": "^1.3.0"\n  },\n  "devDependencies": {\n    "vitest": "^5.0.0"\n  }\n}\n';
  expect(names(newDependencies('package.json', jsonBase, jsonHead))).toEqual(['left-pad:4', 'vitest:7']);
  expect(names(newDependencies('web/package.json', jsonBase, jsonBase.replace('^1.0.0', '^9.0.0')))).toEqual([]);
  // a name moved between two dependency tables is not new
  expect(names(newDependencies('package.json', '{\n  "dependencies": {\n    "a": "1"\n  }\n}\n', '{\n  "devDependencies": {\n    "a": "1"\n  }\n}\n'))).toEqual([]);
  // a `name` or `scripts` key is not a dependency, and composer.json is read like package.json
  expect(names(newDependencies('package.json', '{}', '{\n  "name": "x",\n  "scripts": {\n    "build": "tsc"\n  }\n}\n'))).toEqual([]);
  expect(names(newDependencies('composer.json', '{}', '{\n  "require": {\n    "monolog/monolog": "^3"\n  }\n}\n'))).toEqual(['monolog/monolog:3']);

  // csproj, Directory.Packages.props and packages.config
  const proj = (...refs: string[]) => ['<Project>', '  <ItemGroup>', ...refs, '  </ItemGroup>', '</Project>', ''].join('\n');
  expect(names(newDependencies('src/App.csproj', proj('    <PackageReference Include="A" Version="1" />'), proj('    <PackageReference Include="A" Version="2" />', '    <PackageReference Include="Newtonsoft.Json" Version="13.0.1" />')))).toEqual(['Newtonsoft.Json:4']);
  expect(names(newDependencies('Directory.Packages.props', proj(), proj('    <PackageVersion Include="Serilog" Version="3" />')))).toEqual(['Serilog:3']);
  expect(names(newDependencies('packages.config', '<packages>\n</packages>\n', '<packages>\n  <package id="NUnit" version="3" />\n</packages>\n'))).toEqual(['NUnit:2']);

  // requirements*.txt: comments, blank lines and option lines are not dependencies; a pin change is not new
  expect(names(newDependencies('requirements.txt', 'requests==2.0\n# comment\n', 'requests==2.31\nflask>=2\n# c\n-r other.txt\n\nRich[extra]; python_version>"3"\n'))).toEqual(['flask:2', 'rich:6']);
  expect(names(newDependencies('requirements-dev.txt', '', 'pytest\n'))).toEqual(['pytest:1']);

  // pyproject.toml: [project] dependencies, optional-dependencies and poetry tables; `python` is not a dependency
  const toml = ['[project]', 'name = "x"', 'dependencies = [', '  "requests>=2",', '  "rich",', ']', '', '[project.optional-dependencies]', 'dev = ["pytest>=8"]', '', '[tool.poetry.dependencies]', 'python = "^3.11"', 'django = "^5"', ''].join('\n');
  expect(names(newDependencies('pyproject.toml', '[project]\ndependencies = [\n  "requests>=2",\n]\n', toml))).toEqual(['rich:5', 'pytest:9', 'django:13']);

  // go.mod: require lines, inside a block or alone
  const gomod = (...lines: string[]) => ['module x', '', 'go 1.22', '', 'require (', ...lines, ')', 'require github.com/e/f v1.0.0', ''].join('\n');
  expect(names(newDependencies('go.mod', gomod('\tgithub.com/a/b v1.0.0'), gomod('\tgithub.com/a/b v1.1.0', '\tgithub.com/c/d v0.1.0')))).toEqual(['github.com/c/d:7']);

  // Cargo.toml: dependencies, dev-dependencies and a dotted table header
  const cargo = (...lines: string[]) => ['[package]', 'name = "x"', '', '[dependencies]', 'serde = "1"', ...lines, ''].join('\n');
  expect(names(newDependencies('Cargo.toml', cargo(), cargo('tokio = { version = "1" }', '', '[dev-dependencies]', 'insta = "1"', '', '[build-dependencies.cc]', 'version = "1"')))).toEqual(['tokio:6', 'insta:9', 'cc:11']);

  // Gemfile
  expect(names(newDependencies('Gemfile', "gem 'rails'\n", "gem 'rails', '~> 7'\ngem \"puma\"\n"))).toEqual(['puma:2']);

  // no base file: every name is new; a deleted manifest or a file that is no manifest has none
  expect(names(newDependencies('package.json', undefined, jsonHead))).toEqual(['a:3', 'left-pad:4', 'vitest:7']);
  expect(newDependencies('package.json', jsonBase, undefined)).toEqual([]);
  expect(newDependencies('src/a.ts', undefined, 'import x from "left-pad";\n')).toEqual([]);
  // a manifest that does not read gives none rather than a throw
  expect(newDependencies('package.json', '{}', '{ "dependencies": { "a": ')).toEqual([]);

  expect(isManifest('src/App.csproj')).toBe(true);
  expect(isManifest('requirements-dev.txt')).toBe(true);
  expect(isManifest('package-lock.json')).toBe(false);
  expect(isManifest('src/package.json.ts')).toBe(false);
});
