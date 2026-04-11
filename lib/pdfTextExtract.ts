import pdf from 'pdf-parse';

export const extractPdfText = async (buffer: Buffer): Promise<string> => {
  try {
    const data = await pdf(buffer);
    return data.text || '';
  } catch (err) {
    console.error('PDF extract failed:', err);
    return '';
  }
};
