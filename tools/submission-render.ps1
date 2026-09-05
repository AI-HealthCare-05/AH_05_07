param([Parameter(Mandatory)][string]$Pptx, [Parameter(Mandatory)][string]$Output)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $Pptx).Path
if (Test-Path -LiteralPath $Output) { throw 'Use a new render output directory.' }
$target = (New-Item -ItemType Directory -Path $Output).FullName
$app = New-Object -ComObject PowerPoint.Application
$deck = $null
try {
    # Open read-only without a presentation window. Never use an existing user deck.
    $deck = $app.Presentations.Open($source, -1, 0, 0)
    if ($deck.Slides.Count -ne 7) { throw 'Expected seven slides.' }
    $deck.SaveAs((Join-Path $target 'sk7-mvp1-review.pdf'), 32)
    $deck.Export((Join-Path $target 'slides'), 'PNG', 1600, 900)
    $report = @()
    foreach ($slide in $deck.Slides) {
        foreach ($shape in $slide.Shapes) {
            if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
                $range = $shape.TextFrame.TextRange
                $report += [pscustomobject]@{ slide=$slide.SlideIndex; text=$range.Text; font=$range.Font.Name; size=$range.Font.Size; overflow=($range.BoundHeight -gt $shape.Height + 2) }
            }
        }
    }
    $report | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $target 'powerpoint-text-check.json') -Encoding utf8
    if ($report | Where-Object overflow) { throw 'Inspect text overflow before delivery.' }
    Write-Output 'PowerPoint PDF/PNG export and text bounds passed.'
} finally {
    if ($deck) { $deck.Close(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($deck) }
    $app.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)
}
