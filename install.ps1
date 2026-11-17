# Чекан: установка и обновление одной командой на Windows.
#   irm https://raw.githubusercontent.com/CodoCeh/chekan/main/install.ps1 | iex
& {
    [Console]::OutputEncoding = [Text.Encoding]::UTF8

    $Repo = if ($env:CHEKAN_REPO) { $env:CHEKAN_REPO } else { "https://github.com/CodoCeh/chekan" }
    $Branch = if ($env:CHEKAN_BRANCH) { $env:CHEKAN_BRANCH } else { "main" }
    $Dest = if ($env:CHEKAN_HOME) { $env:CHEKAN_HOME } else { Join-Path $env:LOCALAPPDATA "chekan" }
    $ChekanArgs = if ($env:CHEKAN_ARGS) { $env:CHEKAN_ARGS -split " " } else { @() }

    function Fail($msg) { throw "✗ $msg" }

    function Find-Python {
        foreach ($c in @(@("py", "-3"), @("python"), @("python3"))) {
            $exe = Get-Command $c[0] -ErrorAction SilentlyContinue
            if (-not $exe -or $exe.Source -like "*\WindowsApps\*") { continue }
            $rest = @($c | Select-Object -Skip 1)
            & $exe.Source @rest -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" 2>$null
            if ($LASTEXITCODE -eq 0) {
                return (& $exe.Source @rest -c "import sys; print(sys.executable)").Trim()
            }
        }
        return $null
    }

    $py = Find-Python
    if (-not $py) {
        Fail "нужен Python 3.9 или новее. Поставьте: winget install Python.Python.3.12 (или с python.org), откройте новое окно PowerShell и повторите команду."
    }

    New-Item -ItemType Directory -Force (Split-Path $Dest) | Out-Null
    $git = Get-Command git -ErrorAction SilentlyContinue
    if ((Test-Path (Join-Path $Dest ".git")) -and $git) {
        Write-Host "→ обновляю Чекан в $Dest"
        & git -C $Dest pull --ff-only --quiet
        if ($LASTEXITCODE -ne 0) { Fail "не удалось обновить ${Dest}: git pull --ff-only" }
    } elseif ($git -and -not (Test-Path $Dest)) {
        Write-Host "→ скачиваю Чекан в $Dest"
        & git clone --quiet --depth 1 --branch $Branch $Repo $Dest
        if ($LASTEXITCODE -ne 0) { Fail "не удалось скачать $Repo" }
    } else {
        Write-Host "→ скачиваю Чекан архивом в $Dest"
        $tmp = Join-Path ([IO.Path]::GetTempPath()) ("chekan-" + [guid]::NewGuid())
        New-Item -ItemType Directory $tmp | Out-Null
        try {
            if ($Repo -like "http*") {
                $zip = Join-Path $tmp "chekan.zip"
                Invoke-WebRequest -UseBasicParsing "$Repo/archive/refs/heads/$Branch.zip" -OutFile $zip -ErrorAction Stop
                Expand-Archive $zip -DestinationPath (Join-Path $tmp "x") -ErrorAction Stop
                $src = Get-ChildItem (Join-Path $tmp "x") -Directory | Select-Object -First 1
            } else {
                $src = Get-Item $Repo
            }
            if (-not (Test-Path (Join-Path $src.FullName "install.py"))) { Fail "в архиве нет install.py" }
            $old = "$Dest.old"
            if (Test-Path $old) { Remove-Item -Recurse -Force $old }
            if (Test-Path $Dest) { Rename-Item $Dest $old }
            if ($Repo -like "http*") { Move-Item $src.FullName $Dest } else { Copy-Item -Recurse $src.FullName $Dest }
            if (Test-Path $old) { Remove-Item -Recurse -Force $old }
        } finally {
            Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
        }
    }

    $env:PYTHONIOENCODING = "utf-8"
    & $py -X utf8 (Join-Path $Dest "install.py") @ChekanArgs
}
