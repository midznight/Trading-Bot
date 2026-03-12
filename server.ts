import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import * as ccxt from "ccxt";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock OAuth for "Exchange"
  app.get('/api/auth/url', (req, res) => {
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/callback`;
    
    // In a real app, this would be the actual provider URL
    // For this demo/integration, we'll use a mock auth page or redirect directly to callback
    // to demonstrate the flow as requested by the user.
    const params = new URLSearchParams({
      client_id: process.env.OAUTH_CLIENT_ID || 'demo_client_id',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read_balance,trade',
    });

    // We'll simulate the provider URL
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`; 
    res.json({ url: authUrl });
  });

  // Binance Trading Endpoint
  app.post('/api/binance/trade', async (req, res) => {
    const { symbol, side, amount, type = 'market', price, apiKey: bodyApiKey, secret: bodySecret } = req.body;
    
    const apiKey = (bodyApiKey || process.env.BINANCE_API_KEY || '').trim();
    const secret = (bodySecret || process.env.BINANCE_SECRET || '').trim();

    if (!apiKey || !secret) {
      return res.status(400).json({ error: 'Binance API Key or Secret not configured. Please set them in settings.' });
    }

    try {
      // Configure for Binance Futures (USDT-M)
      const exchange = new ccxt.binance({
        apiKey: apiKey,
        secret: secret,
        enableRateLimit: true,
        options: {
          'defaultType': 'future', // Use 'future' for USDT-M Futures
          'adjustForTimeDifference': true,
          'recvWindow': 10000,
        }
      });

      // Ensure symbol is in unified format (e.g., BTC/USDT)
      let unifiedSymbol = symbol;
      if (!symbol.includes('/')) {
        if (symbol.endsWith('USDT')) {
          const coin = symbol.replace('USDT', '');
          unifiedSymbol = `${coin}/USDT`;
        }
      }

      let order;
      const orderSide = side.toLowerCase() === 'buy' ? 'buy' : 'sell';
      
      // Binance Futures createOrder
      order = await exchange.createOrder(unifiedSymbol, type, orderSide, amount, price);

      res.json({ success: true, order });
    } catch (error: any) {
      console.error('Binance Trade Error:', error);
      // Provide more specific error message if it's an auth error
      if (error.message.includes('Signature') || error.message.includes('API-key')) {
        res.status(401).json({ 
          error: 'Binance Signature Error: Pastikan API Key & Secret benar dan memiliki izin "Futures Trade". Periksa juga apakah IP Anda diizinkan di Binance.' 
        });
      } else {
        res.status(500).json({ error: error.message || 'Failed to execute trade on Binance' });
      }
    }
  });

  app.get(['/auth/callback', '/auth/callback/'], (req, res) => {
    // Simulate token exchange
    res.send(`
      <html>
        <body style="background: #09090b; color: #10b981; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center; border: 1px solid #27272a; padding: 2rem; rounded: 1rem; background: #18181b;">
            <h2 style="margin-bottom: 1rem;">Koneksi Berhasil!</h2>
            <p style="color: #71717a; font-size: 0.875rem; margin-bottom: 2rem;">Akun bursa Anda telah terhubung ke PRO TERMINAL.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                setTimeout(() => window.close(), 2000);
              } else {
                window.location.href = '/';
              }
            </script>
            <p style="font-size: 0.75rem;">Jendela ini akan tertutup secara otomatis...</p>
          </div>
        </body>
      </html>
    `);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
