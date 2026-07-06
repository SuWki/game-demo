$files = Get-ChildItem -Path 'd:\codex\codex\auto-shooter-demo\src' -Recurse -Filter '*.ts'
$results = @()
foreach ($f in $files) {
    $lc = (Get-Content $f.FullName).Count
    $results += [PSCustomObject]@{Lines=$lc; File=$f.FullName}
}
$results | Sort-Object Lines -Descending | Format-Table -AutoSize
