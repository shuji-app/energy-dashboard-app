# Extract Sheet1 (daily records) and holiday list from source xlsx into JSON
$ErrorActionPreference = "Stop"
$srcPath = "C:\Users\cvns6\OneDrive\デスクトップ\エネルギーデータ管理\エネルギー.xlsx"
$outDir = "C:\Users\cvns6\OneDrive\デスクトップ\energy-dashboard-app\data"

function ToIsoDate($serial) {
    if ($null -eq $serial -or $serial -eq "") { return $null }
    try {
        $d = [DateTime]::FromOADate([double]$serial)
        return $d.ToString("yyyy-MM-dd")
    } catch { return $null }
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open($srcPath, 0, $true)

# Sheet1: daily records
$sheet1 = $wb.Sheets.Item("Sheet1")
$used = $sheet1.UsedRange
$maxRow = $used.Rows.Count
$vals = $sheet1.Range("A3", $sheet1.Cells.Item($maxRow, 14)).Value2

$records = @()
for ($i = 1; $i -le $vals.GetLength(0); $i++) {
    $dateSerial = $vals[$i,1]
    if ($null -eq $dateSerial -or $dateSerial -eq "") { continue }
    $iso = ToIsoDate $dateSerial
    if ($null -eq $iso) { continue }
    $rec = [ordered]@{
        date = $iso
        tempAvg = $vals[$i,2]
        humidityAvg = $vals[$i,3]
        coolLoadGJ = $vals[$i,4]
        heatLoadGJ = $vals[$i,5]
        elecKWh = $vals[$i,6]
        oilChiller1L = $vals[$i,7]
        oilChiller2L = $vals[$i,8]
        oilChillerTotalL = $vals[$i,9]
        oilBoiler1L = $vals[$i,10]
        oilBoiler2L = $vals[$i,11]
        oilBoilerTotalL = $vals[$i,12]
        oilTotalL = $vals[$i,13]
    }
    $records += [PSCustomObject]$rec
}

# Holiday list sheet
$sheetH = $wb.Sheets.Item("祝日リスト")
$usedH = $sheetH.UsedRange
$maxRowH = $usedH.Rows.Count
$valsH = $sheetH.Range("A11", $sheetH.Cells.Item($maxRowH, 8)).Value2

$holidayMap = @{}
for ($i = 1; $i -le $valsH.GetLength(0); $i++) {
    # table1: col A = date, col C = label
    $d1 = $valsH[$i,1]
    $l1 = $valsH[$i,3]
    if ($d1 -and $l1) {
        $iso1 = ToIsoDate $d1
        if ($iso1 -and $iso1.Substring(0,4) -ge "2023" -and $iso1.Substring(0,4) -le "2027") {
            $holidayMap[$iso1] = $l1
        }
    }
    # table2: col F = date, col H = label (year-end/new-year)
    $d2 = $valsH[$i,6]
    $l2 = $valsH[$i,8]
    if ($d2 -and $l2) {
        $iso2 = ToIsoDate $d2
        if ($iso2 -and $iso2.Substring(0,4) -ge "2023" -and $iso2.Substring(0,4) -le "2027") {
            $holidayMap[$iso2] = $l2
        }
    }
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

$records | ConvertTo-Json -Depth 3 | Out-File -FilePath "$outDir\energy-data.json" -Encoding utf8
$holidayMap | ConvertTo-Json -Depth 3 | Out-File -FilePath "$outDir\holidays.json" -Encoding utf8

Write-Output ("records: " + $records.Count)
Write-Output ("holidays: " + $holidayMap.Count)
