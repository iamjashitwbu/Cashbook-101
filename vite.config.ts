import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import parseInvoiceHandler from './api/parse-invoice';

type ApiResponse = ServerResponse<IncomingMessage> & {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
};

const withApiResponseHelpers = (res: ServerResponse<IncomingMessage>): ApiResponse => {
  const apiResponse = res as ApiResponse;

  apiResponse.status = (statusCode: number) => {
    apiResponse.statusCode = statusCode;
    return apiResponse;
  };

  apiResponse.json = (body: unknown) => {
    if (!apiResponse.headersSent) {
      apiResponse.setHeader('content-type', 'application/json');
    }

    apiResponse.end(JSON.stringify(body));
  };

  return apiResponse;
};

const invoiceApiPlugin = (): Plugin => ({
  name: 'cashbook-invoice-api',
  configureServer(server) {
    server.middlewares.use('/api/parse-invoice', async (req, res, next) => {
      try {
        await parseInvoiceHandler(req, withApiResponseHelpers(res));
      } catch (error) {
        next(error);
      }
    });
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), invoiceApiPlugin()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
