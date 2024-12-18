import { $ } from "bun";
import { Octokit } from "@octokit/rest";
import prettyBytes from "pretty-bytes";
import fs from "fs";
import path from "path";
import os from "os";

// Get GitHub token from environment variable
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error("Error: GITHUB_TOKEN environment variable is not set");
  process.exit(1);
}

const octokit = new Octokit({
  auth: GITHUB_TOKEN
});

interface PackageVersion {
  name: string;
  packageSize: number;
  depsSize: number;
  totalSize: number;
  downloadCount: number;
  created_at: string;
}

interface PackageInfo {
  name: string;
  owner: string;
  versions: PackageVersion[];
}

async function getPackages() {
  try {
    const { data: packages } = await octokit.packages.listPackagesForAuthenticatedUser({
      package_type: 'npm',
      per_page: 100
    });
    return packages;
  } catch (error) {
    console.error("Error fetching packages:", error);
    return [];
  }
}

async function getPackageVersions(packageName: string, owner: string) {
  try {
    const { data: versions } = await octokit.packages.getAllPackageVersionsForPackageOwnedByUser({
      package_type: 'npm',
      package_name: packageName,
      username: owner
    });
    return versions;
  } catch (error) {
    console.error(`Error fetching versions for ${packageName}:`, error);
    return [];
  }
}

async function downloadAndCheckSize(pkg: any): Promise<PackageInfo> {
  const tempDir = path.join(os.tmpdir(), `.temp_${pkg.name}_${Date.now()}`);
  const packageInfo: PackageInfo = {
    name: pkg.name,
    owner: pkg.owner.login,
    versions: []
  };
  
  try {
    // Create temp directory
    await fs.promises.mkdir(tempDir, { recursive: true });
    process.chdir(tempDir);

    // Create temporary package.json
    await fs.promises.writeFile('package.json', JSON.stringify({
      name: 'temp-project',
      private: true
    }));

    // Get package versions
    const versions = await getPackageVersions(pkg.name, pkg.owner.login);
    if (versions.length === 0) {
      console.log(`No versions found for ${pkg.name}`);
      return packageInfo;
    }

    // Configure npm to use GitHub Packages
    await fs.promises.writeFile('.npmrc', `//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
@${pkg.owner.login}:registry=https://npm.pkg.github.com`);

    // Process each version
    for (const version of versions) {
      try {
        console.log(`\nAnalyzing ${pkg.name}@${version.name || 'latest'}...`);
        
        // Clean node_modules before installing new version
        await fs.promises.rm(path.join(tempDir, 'node_modules'), { recursive: true, force: true });
        
        // Install specific version
        await $`bun add @${pkg.owner.login}/${pkg.name}@${version.name}`;

        // Calculate package size
        const nodeModulesPath = path.join(tempDir, 'node_modules');
        const packagePath = path.join(nodeModulesPath, '@' + pkg.owner.login, pkg.name);
        
        const packageSize = await calculateDirectorySize(packagePath);
        const depsSize = await calculateDirectorySize(nodeModulesPath) - packageSize;

        packageInfo.versions.push({
          name: version.name,
          packageSize,
          depsSize,
          totalSize: packageSize + depsSize,
          downloadCount: (version.metadata as any)?.docker?.tags?.[0]?.download_count || 0,
          created_at: version.created_at
        });
      } catch (error) {
        console.error(`Error processing version ${version.name} of ${pkg.name}:`, error);
      }
    }

    // Clean up
    process.chdir(os.tmpdir());
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`Error processing ${pkg.name}:`, error);
    // Ensure we clean up even on error
    try {
      process.chdir(os.tmpdir());
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  return packageInfo;
}

async function calculateDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  try {
    const files = await fs.promises.readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.promises.stat(filePath);
      if (stats.isDirectory()) {
        totalSize += await calculateDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    return 0;
  }
  return totalSize;
}

function printPackageTable(packages: PackageInfo[]) {
  // Print header
  console.log('\n' + '='.repeat(120));
  console.log(
    'Package Name'.padEnd(30) +
    'Version'.padEnd(15) +
    'Package Size'.padEnd(15) +
    'Deps Size'.padEnd(15) +
    'Total Size'.padEnd(15) +
    'Downloads'.padEnd(10) +
    'Created At'
  );
  console.log('='.repeat(120));

  // Print package information
  for (const pkg of packages) {
    const versions = pkg.versions.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    for (let i = 0; i < versions.length; i++) {
      const version = versions[i];
      const packageName = i === 0 ? `@${pkg.owner}/${pkg.name}` : '';
      
      console.log(
        packageName.padEnd(30) +
        version.name.padEnd(15) +
        prettyBytes(version.packageSize).padEnd(15) +
        prettyBytes(version.depsSize).padEnd(15) +
        prettyBytes(version.totalSize).padEnd(15) +
        version.downloadCount.toString().padEnd(10) +
        new Date(version.created_at).toLocaleDateString()
      );
    }
    console.log('-'.repeat(120));
  }
}

async function main() {
  console.log("Fetching packages from GitHub Package Registry...");
  const packages = await getPackages();
  
  if (packages.length === 0) {
    console.log("No packages found.");
    return;
  }
  
  console.log(`Found ${packages.length} packages`);
  
  const packageInfos: PackageInfo[] = [];
  for (const pkg of packages) {
    const info = await downloadAndCheckSize(pkg);
    packageInfos.push(info);
  }

  printPackageTable(packageInfos);
}

main().catch(console.error);