# UTF-8 commit script - prevents Korean encoding corruption on Windows
# Usage: .\scripts\git-commit-utf8.ps1 "commit message"
# Or:    pwsh -File scripts/git-commit-utf8.ps1 "commit message"

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Message
)

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$path = Join-Path $env:TEMP "stylelog_commit_msg.txt"
[System.IO.File]::WriteAllText($path, $Message, $utf8NoBom)
try {
    git commit -F $path
} finally {
    if (Test-Path $path) { Remove-Item $path -Force }
}
