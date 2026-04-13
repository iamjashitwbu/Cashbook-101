import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export const renderInvoicePdfToBase64 = async (file: File): Promise<string> => {
  let pdfDocument: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']> | undefined;

  try {
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;

    const viewports: Array<{ width: number; height: number }> = [];

    for (let pageNumber = 1; pageNumber <= numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      viewports.push(page.getViewport({ scale: 2 }));
      page.cleanup();
    }

    const maxWidth = Math.max(...viewports.map((viewport) => Math.ceil(viewport.width)));
    const totalHeight = viewports.reduce((sum, viewport) => sum + Math.ceil(viewport.height), 0);

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Unable to prepare the uploaded PDF for parsing.');
    }

    canvas.width = maxWidth;
    canvas.height = totalHeight;

    let currentY = 0;

    for (let pageNumber = 1; pageNumber <= numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const pageCanvas = document.createElement('canvas');
      const pageContext = pageCanvas.getContext('2d');

      if (!pageContext) {
        throw new Error('Unable to prepare the uploaded PDF for parsing.');
      }

      pageCanvas.width = Math.ceil(viewport.width);
      pageCanvas.height = Math.ceil(viewport.height);

      await page.render({ canvas: null, canvasContext: pageContext, viewport }).promise;
      context.drawImage(pageCanvas, 0, currentY);
      page.cleanup();
      currentY += Math.ceil(viewport.height);
    }

    const base64Image = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];

    canvas.width = 0;
    canvas.height = 0;

    if (!base64Image) {
      throw new Error('Unable to convert the uploaded PDF into an image.');
    }

    return base64Image;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Unable to read the uploaded PDF.'
    );
  } finally {
    pdfDocument?.destroy();
  }
};
