# GitHub Package Size Analyzer

A command-line tool built with Bun to analyze the size of your GitHub packages. This tool helps you track the size of your npm packages hosted on GitHub Package Registry, including their dependencies and historical versions.

## Features

- Lists all npm packages from your GitHub Package Registry
- Analyzes multiple versions of each package
- Shows package size, dependencies size, and total size
- Displays download count for each version
- Presents data in an easy-to-read table format

## Prerequisites

- [Bun](https://bun.sh) installed on your system
- GitHub Personal Access Token with `read:packages` scope
- Access to GitHub Package Registry

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd <repository-name>
```

2. Install dependencies:
```bash
bun install
```

## Configuration

Set your GitHub token as an environment variable:
```bash
export GITHUB_TOKEN='your-github-token'
```

> Note: Make sure your token has the `read:packages` scope enabled.

## Usage

Run the analyzer:
```bash
bun run start
```

The tool will:
1. Fetch all your npm packages from GitHub Package Registry
2. Download and analyze each version
3. Display a table with the following information:
   - Package name
   - Version number
   - Package size
   - Dependencies size
   - Total size
   - Download count
   - Creation date

## Example Output

```
========================================================================================================================
Package Name                    Version        Package Size   Deps Size      Total Size     Downloads  Created At
========================================================================================================================
@username/package-name         1.2.0          123 kB         456 kB         579 kB         42         1/1/2024
                              1.1.0          120 kB         450 kB         570 kB         35         12/1/2023
------------------------------------------------------------------------------------------------------------------------
@username/another-package      2.0.0          234 kB         567 kB         801 kB         56         1/2/2024
------------------------------------------------------------------------------------------------------------------------
```

## Error Handling

- If `GITHUB_TOKEN` is not set, the tool will exit with an error message
- If a package or version fails to analyze, the error will be logged, but the tool will continue with remaining packages
- Temporary files are automatically cleaned up, even if errors occur

## Contributing

Feel free to open issues or submit pull requests for improvements.

## License

MIT License - feel free to use and modify as needed.
