# Report Conversion Guide

## Status
✅ **Report Files Created:**
- `DARLINGTON_HND_SWE_REPORT.md` - Full Markdown report with all content
- `DARLINGTON_HND_SWE_REPORT.html` - Styled HTML version ready to view and print
- `images/*.mmd` - Mermaid diagram source files (architecture, class, sequences)

## How to Convert to DOCX/PDF

### Option 1: Use Online Converter (No Installation)
**Fastest Method - Works Now!**

1. Open the HTML file in your browser:
   ```
   DARLINGTON_HND_SWE_REPORT.html
   ```

2. Convert to PDF using browser:
   - **Chrome/Edge:** File → Print → Save as PDF
   - **Firefox:** File → Print → Save as PDF

3. Convert PDF to DOCX (optional):
   - Use online service: https://convertio.co/pdf-docx/
   - Or use local tool: `libreoffice --headless --convert-to docx DARLINGTON_HND_SWE_REPORT.pdf`

### Option 2: Install Pandoc + Render Diagrams (Recommended for Full Report)

#### Step 1: Install Pandoc
**Via Installer (Easiest):**
1. Download: https://github.com/jgm/pandoc/releases/latest
2. Choose `pandoc-X.X.X-windows-x86_64.msi`
3. Run installer (Add to PATH when prompted)
4. Restart PowerShell/Terminal

**OR Via Chocolatey (if installed):**
```powershell
choco install pandoc -y
```

**OR Via Manual Download:**
```powershell
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri 'https://github.com/jgm/pandoc/releases/download/3.1.11/pandoc-3.1.11-windows-x86_64.msi' -OutFile 'pandoc.msi'
& '.\pandoc.msi'  # Run installer
```

#### Step 2: Render Mermaid Diagrams to PNG
```powershell
# Install mermaid-cli
npm install -g @mermaid-js/mermaid-cli

# Create images directory
mkdir images -Force

# Render all diagrams
mmdc -i images/architecture.mmd -o images/architecture.png --width 1200 --height 800
mmdc -i images/class-diagram.mmd -o images/class-diagram.png --width 1200 --height 800
mmdc -i images/filter-sequence.mmd -o images/filter-sequence.png --width 1000 --height 600
mmdc -i images/login-sequence.mmd -o images/login-sequence.png --width 1000 --height 600
mmdc -i images/read-page-sequence.mmd -o images/read-page-sequence.png --width 1000 --height 600
```

#### Step 3: Convert Markdown to DOCX
```powershell
# Basic conversion
pandoc DARLINGTON_HND_SWE_REPORT.md -o DARLINGTON_HND_SWE_REPORT.docx --toc --number-sections

# Or with enhanced formatting
pandoc DARLINGTON_HND_SWE_REPORT.md -o DARLINGTON_HND_SWE_REPORT.docx `
  --from=markdown `
  --to=docx `
  --toc `
  --number-sections `
  --resource-path=. `
  --standalone

# Verify
if (Test-Path "DARLINGTON_HND_SWE_REPORT.docx") {
    Write-Host "✅ DOCX created successfully!"
} else {
    Write-Host "❌ Conversion failed"
}
```

#### Step 4: Convert to PDF (Optional)
```powershell
# From DOCX (requires LibreOffice)
libreoffice --headless --convert-to pdf DARLINGTON_HND_SWE_REPORT.docx

# Or direct from Markdown
pandoc DARLINGTON_HND_SWE_REPORT.md -o DARLINGTON_HND_SWE_REPORT.pdf --toc --number-sections
```

### Option 3: Use LibreOffice (HTML to DOCX)
```powershell
# Convert HTML to DOCX directly
libreoffice --headless --convert-to docx DARLINGTON_HND_SWE_REPORT.html
```

### Option 4: Python Script (If Python Installed)
```powershell
# Install python-docx
pip install python-docx

# Run conversion script
python convert_to_docx.py

# Check result
if (Test-Path "DARLINGTON_HND_SWE_REPORT.docx") {
    Write-Host "✅ DOCX created with Python!"
}
```

## File Structure

```
accessibility-translator-2.0/
├── DARLINGTON_HND_SWE_REPORT.md          ← Full report (Markdown)
├── DARLINGTON_HND_SWE_REPORT.html        ← Styled HTML (Ready to view/print)
├── DARLINGTON_HND_SWE_REPORT.docx        ← Output (after conversion)
├── DARLINGTON_HND_SWE_REPORT.pdf         ← Output (optional)
├── convert_to_docx.py                     ← Python conversion script
├── images/
│   ├── architecture.mmd                   ← Source (Mermaid)
│   ├── architecture.png                   ← Output (after rendering)
│   ├── class-diagram.mmd
│   ├── class-diagram.png
│   ├── filter-sequence.mmd
│   ├── filter-sequence.png
│   ├── login-sequence.mmd
│   ├── login-sequence.png
│   ├── read-page-sequence.mmd
│   └── read-page-sequence.png
└── [other project files]
```

## Quick Test: View HTML Report Now

```powershell
# Open HTML in default browser
Start-Process 'DARLINGTON_HND_SWE_REPORT.html'

# Or use specific browser
Start-Process chrome 'DARLINGTON_HND_SWE_REPORT.html'
```

## Troubleshooting

### Pandoc not found after install
```powershell
# Reload environment
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Or restart PowerShell/Terminal
```

### MMC (Mermaid CLI) fails
- Check npm: `npm --version`
- Install Node.js from: https://nodejs.org/
- Then: `npm install -g @mermaid-js/mermaid-cli`

### Images not embedding in DOCX
- Verify images exist: `Get-ChildItem images/*.png`
- Ensure paths in Markdown use forward slashes: `images/architecture.png`
- Use absolute paths if relative paths don't work

### LibreOffice not found
- Install from: https://www.libreoffice.org/download/
- Add to PATH or use full path: `C:\Program Files\LibreOffice\program\soffice.exe`

## Summary of Commands (Copy-Paste)

### One-Shot: Browser Print to PDF
```powershell
# 1. Open HTML in browser
Start-Process 'DARLINGTON_HND_SWE_REPORT.html'
# 2. Press Ctrl+P → Save as PDF
```

### One-Shot: Pandoc + Diagrams
```powershell
# Install tools
npm install -g @mermaid-js/mermaid-cli
# (Install pandoc separately via installer or choco)

# Create diagrams
mkdir images -Force
mmdc -i images/architecture.mmd -o images/architecture.png
mmdc -i images/class-diagram.mmd -o images/class-diagram.png
mmdc -i images/filter-sequence.mmd -o images/filter-sequence.png
mmdc -i images/login-sequence.mmd -o images/login-sequence.png
mmdc -i images/read-page-sequence.mmd -o images/read-page-sequence.png

# Convert to DOCX
pandoc DARLINGTON_HND_SWE_REPORT.md -o DARLINGTON_HND_SWE_REPORT.docx --toc --number-sections
```

---

**Status: ✅ Ready for Conversion**
- All report content created and formatted
- HTML file ready for immediate viewing and printing
- Markdown source optimized for pandoc conversion
- Diagram sources (Mermaid) prepared and ready to render
- Conversion scripts and guides provided

Next steps:
1. **Quick option:** Open `.html` file → Print to PDF ✅
2. **Full option:** Install pandoc → Render diagrams → Convert to DOCX 📦
