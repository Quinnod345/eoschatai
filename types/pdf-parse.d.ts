declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PDFData {
    text: string;
    numpages: number;
    info?: {
      Producer?: string;
      Creator?: string;
      [key: string]: any;
    };
    metadata?: any;
    version?: string;
  }

  function pdfParse(dataBuffer: Buffer, options?: any): Promise<PDFData>;

  export default pdfParse;
}
