import * as pdfjsLib from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = worker;

export const extractTextFromPDF = async (file: File): Promise<string> => {
  let pdfDocument: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']> | undefined;

  try {
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    pdfDocument = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageLines: string[] = [];
      let currentLine = '';

      textContent.items.forEach((item) => {
        if (!('str' in item)) {
          return;
        }

        const text = item.str.trim();

        if (text) {
          currentLine = currentLine ? `${currentLine} ${text}` : text;
        }

        if ('hasEOL' in item && item.hasEOL && currentLine) {
          pageLines.push(currentLine.replace(/\s+/g, ' ').trim());
          currentLine = '';
        }
      });

      if (currentLine) {
        pageLines.push(currentLine.replace(/\s+/g, ' ').trim());
      }

      const pageText = pageLines.join('\n').trim();

      if (pageText) {
        pageTexts.push(pageText);
      }
    }

    return pageTexts.join('\n');
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Unable to read the uploaded PDF.'
    );
  } finally {
    pdfDocument?.destroy();
  }
};

export const convertPDFTextToCSV = (text: string): string => {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      const hasDate = /\b\d{1,4}[/-]\d{1,2}[/-]\d{2,4}\b/.test(line);
      const hasNumber = /\d/.test(line);
      return hasDate && hasNumber;
    })
    .map((line) =>
      line
        .split(/\s{2,}/)
        .map((column) => column.trim())
        .filter(Boolean)
        .join(',')
    )
    .filter(Boolean)
    .join('\n');
};
export const convertPDFToImages = async (file: File): Promise<string[]> => {
  let pdfDocument: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']> | undefined;
  try {
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    pdfDocument = await loadingTask.promise;
    const pageImages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d')!;
      await page.render({ canvasContext: context, viewport }).promise;
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      pageImages.push(base64);
    }

    return pageImages;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Unable to convert PDF to images.'
    );
  } finally {
    pdfDocument?.destroy();
  }
};
