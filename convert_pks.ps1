$sourceDir = 'C:\Users\PRIMA\prime-hris'
$dlDir     = 'C:\Users\PRIMA\Downloads'

$files = @(
    'PERJANJIAN_KERJASAMA_HRIS_PT_DMJ', 
    'PERJANJIAN_KERJASAMA_HRIS_PT_DMJ_BERSIH', 
    'PERJANJIAN_KERJASAMA_HRIS_PT_DMJ_REVISI',
    'INVOICE_PRIME_HRIS_PT_DMJ'
)

Write-Host "Converting DOCX files to PDF via Word COM..."
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    foreach ($f in $files) {
        [string]$docx = "$sourceDir\$f.docx"
        [string]$pdf  = "$sourceDir\$f.pdf"
        if (Test-Path $docx) {
            Write-Host "Converting: $f.docx -> $f.pdf"
            $doc = $word.Documents.Open($docx)
            $doc.SaveAs([ref]$pdf, [ref]17)
            $doc.Close([ref]$false)
            Write-Host "Success: $f.pdf"
        }
    }
} catch {
    Write-Host "Error: " $_.Exception.Message
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}

Write-Host "Copying files to Downloads..."
foreach ($f in $files) {
    if (Test-Path "$sourceDir\$f.docx") {
        try {
            Copy-Item -Path "$sourceDir\$f.docx" -Destination "$dlDir\$f.docx" -Force
            Write-Host "Copied $f.docx"
        } catch {
            Write-Host "Notice: $f.docx in Downloads is locked by Word"
        }
    }
    if (Test-Path "$sourceDir\$f.pdf") {
        try {
            Copy-Item -Path "$sourceDir\$f.pdf" -Destination "$dlDir\$f.pdf" -Force
            Write-Host "Copied $f.pdf"
        } catch {
            Write-Host "Notice: $f.pdf in Downloads is locked"
        }
    }
}

# Also copy a dedicated FINAL version that is never locked
try {
    Copy-Item -Path "$sourceDir\PERJANJIAN_KERJASAMA_HRIS_PT_DMJ_BERSIH.docx" -Destination "$dlDir\PERJANJIAN_KERJASAMA_HRIS_PT_DMJ_FINAL.docx" -Force
    Copy-Item -Path "$sourceDir\PERJANJIAN_KERJASAMA_HRIS_PT_DMJ_BERSIH.pdf" -Destination "$dlDir\PERJANJIAN_KERJASAMA_HRIS_PT_DMJ_FINAL.pdf" -Force
    Write-Host "Copied PERJANJIAN_KERJASAMA_HRIS_PT_DMJ_FINAL.docx & pdf"
} catch { }

Copy-Item -Path "$sourceDir\PERJANJIAN_KERJASAMA_HRIS_PT_DMJ.md" -Destination "$dlDir\PERJANJIAN_KERJASAMA_HRIS_PT_DMJ.md" -Force
Copy-Item -Path "$sourceDir\PERJANJIAN_KERJASAMA_HRIS_PT_DMJ.md" -Destination "$dlDir\PERJANJIAN_KERJASAMA_HRIS_PT_DMJ_BERSIH.md" -Force
if (Test-Path "$sourceDir\INVOICE_PRIME_HRIS_PT_DMJ.md") {
    Copy-Item -Path "$sourceDir\INVOICE_PRIME_HRIS_PT_DMJ.md" -Destination "$dlDir\INVOICE_PRIME_HRIS_PT_DMJ.md" -Force
    Write-Host "Copied INVOICE_PRIME_HRIS_PT_DMJ.md"
}
Write-Host "All files copied to Downloads successfully!"
