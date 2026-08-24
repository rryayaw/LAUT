param(
  [Parameter(Mandatory = $true)][string]$WorkbookPath,
  [Parameter(Mandatory = $true)][string]$OutputPath
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::OpenRead($WorkbookPath)

function Read-ZipText([string]$entryName) {
  $entry = $zip.Entries | Where-Object FullName -eq $entryName | Select-Object -First 1
  if (-not $entry) { throw "Workbook entry '$entryName' was not found." }
  $reader = [System.IO.StreamReader]::new($entry.Open())
  try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}

$namespace = [System.Xml.XmlNamespaceManager]::new([System.Xml.NameTable]::new())
$namespace.AddNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')

$sharedStrings = [System.Xml.XmlDocument]::new()
$sharedStrings.LoadXml((Read-ZipText 'xl/sharedStrings.xml'))
$shared = @($sharedStrings.SelectNodes('//x:si', $namespace) | ForEach-Object { $_.InnerText })

function Get-ColumnIndex([string]$reference) {
  $letters = $reference -replace '[0-9]', ''
  $value = 0
  foreach ($character in $letters.ToCharArray()) {
    $value = $value * 26 + ([int][char]$character - [int][char]'A' + 1)
  }
  return $value - 1
}

function Get-CellValue($cell) {
  $value = $cell.SelectSingleNode('x:v', $namespace)
  if ($cell.GetAttribute('t') -eq 's') { return $shared[[int]$value.InnerText] }
  if ($cell.GetAttribute('t') -eq 'inlineStr') { return $cell.InnerText }
  if ($value) { return $value.InnerText }
  return $null
}

$sheet = [System.Xml.XmlDocument]::new()
$sheet.LoadXml((Read-ZipText 'xl/worksheets/sheet3.xml'))
$rows = @($sheet.SelectNodes('//x:sheetData/x:row', $namespace))
$headerByIndex = @{}
foreach ($cell in $rows[0].SelectNodes('x:c', $namespace)) {
  $headerByIndex[(Get-ColumnIndex $cell.GetAttribute('r'))] = [string](Get-CellValue $cell)
}

$batches = @()
foreach ($row in $rows | Select-Object -Skip 1) {
  $source = @{}
  foreach ($cell in $row.SelectNodes('x:c', $namespace)) {
    $index = Get-ColumnIndex $cell.GetAttribute('r')
    $source[$headerByIndex[$index]] = Get-CellValue $cell
  }
  $batches += [ordered]@{
    sourceBatchId = [string]$source.batch_id
    productionDate = [string]$source.production_date
    sourceLineId = [string]$source.line_id
    lineName = [string]$source.line_name
    processTags = @(([string]$source.process_tags).Split('|') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    shift = [string]$source.shift
    species = [string]$source.species
    productSpecification = [string]$source.product_spec
    supplier = [string]$source.supplier
    rawInputKg = [double]$source.input_kg
    sellableOutputKg = [double]$source.sellable_output_kg
    byproductKg = [double]$source.normal_byproduct_kg
    trimmingKg = [double]$source.trimming_kg
    qualityRejectKg = [double]$source.quality_reject_kg
    spoilageKg = [double]$source.spoilage_damage_kg
    otherLossKg = [double]$source.unexplained_difference_kg
    deliveryDelayMinutes = [int]$source.delivery_delay_min
    receivingTemperatureC = [double]$source.receiving_temp_c
    receivingCondition = [string]$source.raw_material_condition
    productionDurationMinutes = [int]$source.processing_duration_min
  }
}

$dataset = [ordered]@{
  sourceWorkbook = 'LAUT_synthetic_red_snapper_dataset.xlsx'
  siteName = 'Synthetic Red Snapper Test Site'
  batches = $batches
}
$json = $dataset | ConvertTo-Json -Depth 6 -Compress
$typescript = '// Generated from the supplied synthetic workbook. Do not edit by hand.' + [Environment]::NewLine + 'export const syntheticRedSnapperDataset = ' + $json + ' as const;' + [Environment]::NewLine
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
Set-Content -LiteralPath $OutputPath -Value $typescript -Encoding utf8
$zip.Dispose()
