import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import * as ccxtModule from "ccxt";

// Handle CJS/ESM interop for ccxt
const ccxt = (ccxtModule as any).default || ccxtModule;

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode`);

  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`API Request: ${req.method} ${req.url}`);
    }
    next();
  });

  app.use(express.json());

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

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

  // Binance Balance Endpoint
  app.get(['/api/binance/balance', '/api/binance/balance/'], async (req, res) => {
    console.log('GET /api/binance/balance');
    const apiKey = (req.query.apiKey as string || process.env.BINANCE_API_KEY || '').trim();
    const secret = (req.query.secret as string || process.env.BINANCE_SECRET || '').trim();

    if (!apiKey || !secret) {
      return res.status(400).json({ error: 'API Key or Secret missing' });
    }

    try {
      const exchange = new ccxt.binance({
        apiKey,
        secret,
        enableRateLimit: true,
        options: { 'defaultType': 'future' }
      });

      const balance = await exchange.fetchBalance();
      // Get USDT balance in Futures account
      const usdtBalance = balance.total['USDT'] || 0;
      res.json({ balance: usdtBalance });
    } catch (error: any) {
      console.error('Binance Balance Error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch balance' });
    }
  });

  // Binance Market Data Proxy
  app.get('/api/binance/market/symbols', async (req, res) => {
    try {
      const exchange = new ccxt.binance({ options: { 'defaultType': 'future' } });
      const markets = await exchange.loadMarkets();
      const symbols = Object.values(markets)
        .filter((m: any) => m.active && m.quote === 'USDT' && m.type === 'swap')
        .map((m: any) => m.id);
      res.json(symbols);
    } catch (error: any) {
      console.error('Symbols Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/binance/market/volatile', async (req, res) => {
    try {
      const exchange = new ccxt.binance({ options: { 'defaultType': 'future' } });
      const tickers = await exchange.fetchTickers();
      const data = Object.values(tickers)
        .filter((t: any) => t.symbol.endsWith('/USDT:USDT') || t.symbol.endsWith('/USDT'))
        .map((t: any) => ({
          symbol: t.symbol.replace('/', '').replace(':USDT', ''),
          priceChangePercent: t.percentage?.toString() || '0',
          quoteVolume: t.quoteVolume?.toString() || '0'
        }));
      res.json(data);
    } catch (error: any) {
      console.error('Volatile Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Binance Positions Endpoint
  app.get(['/api/binance/positions', '/api/binance/positions/'], async (req, res) => {
    console.log('GET /api/binance/positions');
    const apiKey = (req.query.apiKey as string || process.env.BINANCE_API_KEY || '').trim();
    const secret = (req.query.secret as string || process.env.BINANCE_SECRET || '').trim();

    if (!apiKey || !secret) {
      return res.status(400).json({ error: 'API Key or Secret missing' });
    }

    try {
      const exchange = new ccxt.binance({
        apiKey,
        secret,
        enableRateLimit: true,
        options: { 'defaultType': 'future' }
      });

      const positions = await exchange.fetchPositions();
      // Filter only active positions (size != 0) and map to consistent format
      const mappedPositions = positions
        .filter(p => parseFloat(p.contracts + '') !== 0)
        .map(p => ({
          symbol: p.symbol,
          side: p.side,
          amount: Math.abs(parseFloat(p.contracts + '')),
          entryPrice: p.entryPrice,
          markPrice: p.markPrice,
          unrealizedPnl: p.unrealizedPnl,
          liquidationPrice: p.liquidationPrice,
          leverage: p.leverage,
          percentage: p.percentage || (p.unrealizedPnl && p.entryPrice && p.contracts && p.leverage ? 
            (p.unrealizedPnl / (Math.abs(p.contracts) * p.entryPrice / p.leverage) * 100) : 0)
        }));
      res.json({ positions: mappedPositions });
    } catch (error: any) {
      console.error('Binance Positions Error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch positions' });
    }
  });

  app.get('/api/binance/market/ticker', async (req, res) => {
    const { symbol } = req.query;
    try {
      const exchange = new ccxt.binance({ options: { 'defaultType': 'future' } });
      const ticker = await exchange.fetchTicker(symbol as string);
      res.json({
        symbol: ticker.symbol,
        lastPrice: ticker.last?.toString(),
        priceChangePercent: ticker.percentage?.toString(),
        volume: ticker.baseVolume?.toString(),
        highPrice: ticker.high?.toString(),
        lowPrice: ticker.low?.toString()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/binance/market/klines', async (req, res) => {
    const { symbol, interval, limit } = req.query;
    try {
      const exchange = new ccxt.binance({ options: { 'defaultType': 'future' } });
      const klines = await exchange.fetchOHLCV(symbol as string, interval as string, undefined, parseInt(limit as string || '24'));
      res.json(klines);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Binance Trading Endpoint
  app.post('/api/binance/trade', async (req, res) => {
    const { 
      symbol, 
      side, 
      amount, 
      type = 'market', 
      price, 
      leverage = 20, 
      tp, 
      sl, 
      apiKey: bodyApiKey, 
      secret: bodySecret 
    } = req.body;
    
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
          'defaultType': 'future',
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

      // 1. Set Leverage
      try {
        await exchange.setLeverage(leverage, unifiedSymbol);
      } catch (e) {
        console.warn(`Could not set leverage for ${unifiedSymbol}:`, e);
      }

      const orderSide = side.toLowerCase() === 'buy' ? 'buy' : 'sell';
      
      // 2. Create Main Order
      const mainOrder = await exchange.createOrder(unifiedSymbol, type, orderSide, amount, price);

      // 3. Create TP and SL Orders (Bracket)
      const results: any = { mainOrder };

      if (tp) {
        try {
          const tpSide = orderSide === 'buy' ? 'sell' : 'buy';
          // Use TAKE_PROFIT_MARKET with closePosition for better reliability
          results.tpOrder = await exchange.createOrder(unifiedSymbol, 'take_profit_market', tpSide, amount, undefined, {
            'stopPrice': tp,
            'reduceOnly': true,
            'closePosition': true
          });
        } catch (e) {
          console.error('TP Order Error:', e);
        }
      }

      if (sl) {
        try {
          const slSide = orderSide === 'buy' ? 'sell' : 'buy';
          // Use STOP_MARKET with closePosition
          results.slOrder = await exchange.createOrder(unifiedSymbol, 'stop_market', slSide, amount, undefined, {
            'stopPrice': sl,
            'reduceOnly': true,
            'closePosition': true
          });
        } catch (e) {
          console.error('SL Order Error:', e);
        }
      }

      res.json({ 
        success: true, 
        message: `Order ${orderSide} ${unifiedSymbol} berhasil.${tp ? ' TP set.' : ''}${sl ? ' SL set.' : ''}`,
        ...results 
      });
    } catch (error: any) {
      console.error('Binance Trade Error:', error);
      if (error.message.includes('Signature') || error.message.includes('API-key')) {
        res.status(401).json({ 
          error: 'Binance Signature Error: Pastikan API Key & Secret benar dan memiliki izin "Futures Trade".' 
        });
      } else {
        res.status(500).json({ error: error.message || 'Failed to execute trade on Binance' });
      }
    }
  });

  // Binance Close Position Endpoint
  app.post('/api/binance/close-position', async (req, res) => {
    const { symbol, apiKey: bodyApiKey, secret: bodySecret } = req.body;
    
    const apiKey = (bodyApiKey || process.env.BINANCE_API_KEY || '').trim();
    const secret = (bodySecret || process.env.BINANCE_SECRET || '').trim();

    if (!apiKey || !secret) {
      return res.status(400).json({ error: 'API Key or Secret missing' });
    }

    try {
      const exchange = new ccxt.binance({
        apiKey,
        secret,
        enableRateLimit: true,
        options: { 'defaultType': 'future' }
      });

      // Fetch positions to find the one to close
      const positions = await exchange.fetchPositions();
      const position = positions.find(p => p.symbol === symbol || p.symbol === `${symbol.replace('/', '')}`);
      
      if (!position || parseFloat(position.contracts + '') === 0) {
        return res.status(404).json({ error: 'No active position found for this symbol' });
      }

      const side = parseFloat(position.contracts + '') > 0 ? 'sell' : 'buy';
      const amount = Math.abs(parseFloat(position.contracts + ''));

      // Close the position with a market order
      const order = await exchange.createOrder(position.symbol, 'market', side, amount, undefined, {
        'reduceOnly': true
      });

      // Cancel all open orders for this symbol (TP/SL)
      try {
        await exchange.cancelAllOrders(position.symbol);
      } catch (e) {
        console.warn(`Could not cancel orders for ${position.symbol}:`, e);
      }

      res.json({ success: true, order });
    } catch (error: any) {
      console.error('Binance Close Position Error:', error);
      res.status(500).json({ error: error.message || 'Failed to close position' });
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

  // API 404 Handler - MUST be after all API routes but before Vite/Static
  app.all('/api/*', (req, res) => {
    res.status(404).json({ 
      error: `API route not found: ${req.method} ${req.url}`,
      suggestion: 'Check if the route is correctly defined in server.ts'
    });
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
