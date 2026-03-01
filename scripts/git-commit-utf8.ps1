# UTF-8 commit script - prevents Korean encoding corruption on Windows
# Usage: .\scripts\git-commit-utf8.ps1 "commit message"
# Or read from file: .\scripts\git-commit-utf8.ps1 -MessageFile path\to\msg.txt

param(
    [Parameter(Mandatory = $false, Position = 0)]
    [string]$Message,
    [Parameter(Mandatory = $false)]
    [string]$MessageFile
)

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$path = Join-Path $env:TEMP "stylelog_commit_msg.txt"

if ($MessageFile -and (Test-Path $MessageFile)) {
    $content = [System.IO.File]::ReadAllText($MessageFile, $utf8NoBom)
} elseif ($Message) {
    $content = $Message
} else {
    Write-Error "Provide -Message 'text' or -MessageFile path"
    exit 1
}

[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
try {
    git commit -F $path
} finally {
    if (Test-Path $path) { Remove-Item $path -Force }
}
