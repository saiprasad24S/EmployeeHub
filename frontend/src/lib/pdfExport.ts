import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export interface PDFExportOptions {
  filename?: string
  scale?: number
  quality?: number
}

/**
 * Exports one or more HTML page elements to a multi-page A4 PDF document.
 * Handles temporary unscaling of zoomed elements so the output is crisp and exactly A4 dimensions.
 */
export async function exportPagesToPDF(
  pageElements: HTMLElement[],
  filename: string = 'Document.pdf',
  options: PDFExportOptions = {}
): Promise<boolean> {
  if (!pageElements || pageElements.length === 0) {
    throw new Error('No page elements found for PDF export.')
  }

  const scale = options.scale ?? 2 // High DPI 2x for sharp print quality
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  // Standard A4 dimensions in mm
  const a4WidthMm = 210
  const a4HeightMm = 297

  // Temporarily reset zoom/transforms to capture true 100% dimensions
  const originalTransforms: { element: HTMLElement; transform: string; transformOrigin: string }[] = []
  pageElements.forEach((el) => {
    originalTransforms.push({
      element: el,
      transform: el.style.transform,
      transformOrigin: el.style.transformOrigin,
    })
    el.style.transform = 'none'
    el.style.transformOrigin = 'top center'
  })

  try {
    for (let i = 0; i < pageElements.length; i++) {
      const pageEl = pageElements[i]
      if (i > 0) {
        pdf.addPage('a4', 'portrait')
      }

      // Ensure all images inside pageEl are completely loaded
      const imgs = Array.from(pageEl.querySelectorAll('img'))
      await Promise.all(
        imgs.map((img) => {
          if (img.complete) return Promise.resolve()
          return new Promise<void>((resolve) => {
            img.onload = () => resolve()
            img.onerror = () => resolve()
          })
        })
      )

      const canvas = await html2canvas(pageEl, {
        scale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
      })

      const imgData = canvas.toDataURL('image/jpeg', options.quality ?? 0.95)
      const imgHeightMm = (canvas.height * a4WidthMm) / canvas.width
      const renderHeight = Math.min(imgHeightMm, a4HeightMm)

      pdf.addImage(imgData, 'JPEG', 0, 0, a4WidthMm, renderHeight, undefined, 'FAST')
    }

    pdf.save(filename)
    return true
  } finally {
    // Restore original zoom and transforms
    originalTransforms.forEach(({ element, transform, transformOrigin }) => {
      element.style.transform = transform
      element.style.transformOrigin = transformOrigin
    })
  }
}

/**
 * Fallback browser print trigger for an element using an isolated hidden iframe
 */
export function printElementDirectly(container: HTMLElement, title: string = 'Document') {
  const printIframe = document.createElement('iframe')
  printIframe.style.position = 'fixed'
  printIframe.style.right = '0'
  printIframe.style.bottom = '0'
  printIframe.style.width = '0'
  printIframe.style.height = '0'
  printIframe.style.border = 'none'
  document.body.appendChild(printIframe)

  const doc = printIframe.contentDocument || printIframe.contentWindow?.document
  if (!doc) {
    window.print()
    return
  }

  doc.open()
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; padding: 0; background: #fff; font-family: "Times New Roman", Times, serif; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        </style>
      </head>
      <body>
        ${container.outerHTML}
      </body>
    </html>
  `)
  doc.close()

  setTimeout(() => {
    printIframe.contentWindow?.focus()
    printIframe.contentWindow?.print()
    setTimeout(() => {
      if (document.body.contains(printIframe)) {
        document.body.removeChild(printIframe)
      }
    }, 2000)
  }, 500)
}
