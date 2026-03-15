import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Newspaper, 
  BarChart3, 
  RefreshCw, 
  ExternalLink, 
  Search,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Coins,
  Zap,
  Target,
  ShieldAlert,
  Clock,
  Activity,
  Globe,
  Database,
  LineChart,
  MessageSquare,
  Flame,
  Layers,
  Crosshair,
  ShieldCheck
} from 'lucide-react';
import { 
  fetchUnifiedMarketReport,
  fetchTopSignals,
  MarketReport,
  MarketSignal
} from './services/geminiService';
import { fetchTopVolatileSymbols, validateBinanceSymbol } from './services/binanceService';
import { StockChart } from './components/StockChart';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AssetType = 'google' | 'meme' | 'custom';

const WIBClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // WIB is UTC+7
  const wibTime = new Date(time.getTime() + (time.getTimezoneOffset() * 60000) + (7 * 3600000));
  
  return (
    <div className="flex flex-col items-end px-4 border-l border-zinc-800">
      <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Waktu WIB</span>
      <span className="text-xs font-mono font-bold text-zinc-300">
        {wibTime.toLocaleTimeString('id-ID', { hour12: false })}
      </span>
    </div>
  );
};

const LiveTicker = () => {
  const [prices, setPrices] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const symbols = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'dogeusdt'];
    const wsUrl = `wss://fstream.binance.com/ws/${symbols.map(s => `${s}@ticker`).join('/')}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.s) {
        const symbol = data.s.replace('USDT', '');
        setPrices(prev => ({
          ...prev,
          [symbol]: parseFloat(data.c).toLocaleString(undefined, { minimumFractionDigits: 2 })
        }));
      }
    };

    ws.onerror = (err) => console.error("Ticker WebSocket error", err);
    
    return () => ws.close();
  }, []);

  return (
    <div className="bg-zinc-900/50 border-b border-zinc-800 py-1.5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live Feed</span>
        </div>
        <div className="flex gap-8 overflow-x-auto no-scrollbar py-0.5">
          {Object.entries(prices).map(([symbol, price]) => (
            <div key={symbol} className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono font-bold text-zinc-400">{symbol}</span>
              <span className="text-[10px] font-mono text-emerald-400">${price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [assetType, setAssetType] = useState<AssetType>('google');
  const [searchTerm, setSearchTerm] = useState('');
  const [customAsset, setCustomAsset] = useState('');
  const [report, setReport] = useState<MarketReport | null>(null);
  const [realTimePrice, setRealTimePrice] = useState<string | null>(null);
  const [realTimeChange, setRealTimeChange] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ time: string; price: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [topSignals, setTopSignals] = useState<MarketSignal[]>([]);
  const [signalPrices, setSignalPrices] = useState<{ [key: string]: { price: string, change: string } }>({});
  const [isScanning, setIsScanning] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [isExchangeConnected, setIsExchangeConnected] = useState(false);
  const [isBotEnabled, setIsBotEnabled] = useState(false);
  const [isHuntingMode, setIsHuntingMode] = useState(false);
  const [isGuardianActive, setIsGuardianActive] = useState(() => {
    return localStorage.getItem('BOT_GUARDIAN_ACTIVE') !== 'false';
  });
  const [futuresBalance, setFuturesBalance] = useState<number | null>(null);
  const [activePositions, setActivePositions] = useState<any[]>([]);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [botLogs, setBotLogs] = useState<{time: string, msg: string, type: 'info' | 'success' | 'error'}[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(JSON.parse(localStorage.getItem('RECENT_SEARCHES') || '["BTC", "ETH", "SOL", "PEPE"]'));
  const [apiConfig, setApiConfig] = useState({
    apiKey: localStorage.getItem('BINANCE_API_KEY') || '',
    secret: localStorage.getItem('BINANCE_SECRET') || ''
  });
  const [botConfig, setBotConfig] = useState({
    leverage: parseInt(localStorage.getItem('BOT_LEVERAGE') || '20'),
    amount: parseFloat(localStorage.getItem('BOT_AMOUNT') || '0.01'),
    minConfidence: parseInt(localStorage.getItem('BOT_MIN_CONF') || '85'),
    autoExit: localStorage.getItem('BOT_AUTO_EXIT') !== 'false' // Default to true
  });

  const saveApiConfig = () => {
    localStorage.setItem('BINANCE_API_KEY', apiConfig.apiKey);
    localStorage.setItem('BINANCE_SECRET', apiConfig.secret);
    localStorage.setItem('BOT_LEVERAGE', botConfig.leverage.toString());
    localStorage.setItem('BOT_AMOUNT', botConfig.amount.toString());
    localStorage.setItem('BOT_MIN_CONF', botConfig.minConfidence.toString());
    localStorage.setItem('BOT_AUTO_EXIT', botConfig.autoExit.toString());
    localStorage.setItem('BOT_GUARDIAN_ACTIVE', isGuardianActive.toString());
    setShowSettings(false);
    addBotLog('Konfigurasi Bot & API disimpan', 'success');
    fetchBalance();
  };

  const fetchBalance = async (retryCount = 0): Promise<number | null> => {
    if (!apiConfig.apiKey || !apiConfig.secret) return null;
    setIsBalanceLoading(true);
    try {
      const response = await fetch(`/api/binance/balance?apiKey=${encodeURIComponent(apiConfig.apiKey)}&secret=${encodeURIComponent(apiConfig.secret)}`);
      const data = await response.json();
      if (data.balance !== undefined) {
        setFuturesBalance(data.balance);
        setIsExchangeConnected(true);
        return data.balance as number;
      }
      
      if (retryCount < 2) {
        await new Promise(r => setTimeout(r, 2000));
        return fetchBalance(retryCount + 1);
      }
      return null;
    } catch (e) {
      console.error("Failed to fetch balance", e);
      if (retryCount < 2) {
        await new Promise(r => setTimeout(r, 2000));
        return fetchBalance(retryCount + 1);
      }
      return null;
    } finally {
      setIsBalanceLoading(false);
    }
  };

  const fetchPositions = async () => {
    if (!apiConfig.apiKey || !apiConfig.secret) return;
    try {
      const response = await fetch(`/api/binance/positions?apiKey=${encodeURIComponent(apiConfig.apiKey)}&secret=${encodeURIComponent(apiConfig.secret)}`);
      const data = await response.json();
      if (data.positions) {
        setActivePositions(data.positions);
        // Run guardian check immediately after fetching positions
        if (isBotEnabled && isGuardianActive) {
          runPositionGuardian(data.positions);
        }
      }
    } catch (e) {
      console.error("Failed to fetch positions", e);
    }
  };

  const closePosition = async (symbol: string) => {
    if (!apiConfig.apiKey || !apiConfig.secret) return;
    try {
      addBotLog(`Menutup posisi ${symbol} secara paksa...`, 'info');
      const response = await fetch('/api/binance/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          apiKey: apiConfig.apiKey,
          secret: apiConfig.secret
        })
      });
      const result = await response.json();
      if (result.success) {
        addBotLog(`Posisi ${symbol} berhasil ditutup.`, 'success');
        fetchPositions();
        fetchBalance();
      } else {
        addBotLog(`Gagal menutup posisi: ${result.error}`, 'error');
      }
    } catch (e: any) {
      addBotLog(`Kesalahan saat menutup posisi: ${e.message}`, 'error');
    }
  };

  const runPositionGuardian = async (positions: any[]) => {
    if (!isBotEnabled || !isGuardianActive) return;

    for (const pos of positions) {
      const pnlPercent = parseFloat(pos.percentage);
      const unrealizedPnl = parseFloat(pos.unrealizedPnl);
      const symbol = pos.symbol;
      
      // 1. FATAL LOSS PROTECTION (Anomaly Drawdown)
      const entryPrice = parseFloat(pos.entryPrice);
      const liqPrice = parseFloat(pos.liquidationPrice);
      const markPrice = parseFloat(pos.markPrice);
      const distToLiq = Math.abs((markPrice - liqPrice) / markPrice) * 100;
      
      if (pnlPercent <= -10) { // Reduced from -15 to -10 for tighter safety
        addBotLog(`SAFETY TRIGGER: Drawdown ${pnlPercent.toFixed(2)}% pada ${symbol}. Menutup posisi untuk mencegah fatal loss...`, 'error');
        closePosition(symbol);
        continue;
      } 
      
      if (distToLiq < 4 && liqPrice !== 0) { // Reduced from 5 to 4
        addBotLog(`MARGIN GUARD: Jarak likuidasi kritis (${distToLiq.toFixed(2)}%) pada ${symbol}. Menutup posisi segera...`, 'error');
        closePosition(symbol);
        continue;
      }

      // 2. SMART PROFIT TAKING (Scalping & Trailing)
      // Fee estimation: ~0.1% round-trip. We want NET profit.
      const netPnl = pnlPercent - 0.1; 

      if (netPnl >= 1.5) {
        // High Profit: Start Trailing or Close if momentum slows
        // For now, we'll close at 1.5% to ensure "Consistent Profit" as requested
        addBotLog(`TARGET SCALP TERCAPAI: Net Profit ${netPnl.toFixed(2)}% pada ${symbol}. Mengamankan profit...`, 'success');
        closePosition(symbol);
      } else if (netPnl >= 0.6) {
        // Break-even protection: If we are in decent profit, we don't want to lose.
        // In a real bot, we'd move the SL on Binance. Here we log the "Mental SL" update.
        // addBotLog(`BREAK-EVEN ACTIVE: Profit ${netPnl.toFixed(2)}% pada ${symbol}. SL dipindahkan ke Entry.`, 'info');
      }
    }
  };

  useEffect(() => {
    if (apiConfig.apiKey && apiConfig.secret) {
      fetchBalance();
      fetchPositions();
      const interval = setInterval(() => {
        fetchBalance();
        fetchPositions();
      }, 5000); // Update every 5s
      return () => clearInterval(interval);
    }
  }, [apiConfig]);

  const addToRecentSearches = (asset: string) => {
    const updated = [asset, ...recentSearches.filter(s => s !== asset)].slice(0, 6);
    setRecentSearches(updated);
    localStorage.setItem('RECENT_SEARCHES', JSON.stringify(updated));
  };

  const addBotLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setBotLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 5));
  };

  const scanMarketForSignals = async () => {
    setIsScanning(true);
    addBotLog('Mencari koin dengan volatilitas tinggi (Hunting Mode)...', 'info');
    try {
      const volatileCoins = await fetchTopVolatileSymbols(12);
      addBotLog(`Menganalisis: ${volatileCoins.join(', ')}`, 'info');
      const signals = await fetchTopSignals(volatileCoins);
      setTopSignals(signals);
      addBotLog('Pemindaian pasar selesai - Sinyal profit tinggi ditemukan', 'success');
      
      // Autonomous Execution: If bot is enabled, execute the highest confidence signal
      if (isBotEnabled && signals.length > 0) {
        const bestSignal = [...signals].sort((a, b) => b.confidence - a.confidence)[0];
        if (bestSignal.confidence >= botConfig.minConfidence) {
          addBotLog(`Otomatis mengeksekusi sinyal terbaik: ${bestSignal.coin}`, 'success');
          executeTrade(bestSignal, bestSignal.confidence);
        }
      }
    } catch (e) {
      console.error("Scanning error", e);
      addBotLog('Gagal memindai pasar', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    // Initial scan
    scanMarketForSignals();
    
    // Periodic scan every 5 minutes to find new opportunities
    const interval = setInterval(() => {
      if (isBotEnabled) {
        scanMarketForSignals();
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [isBotEnabled]);

  useEffect(() => {
    if (topSignals.length === 0) return;

    const symbols = topSignals.map(s => `${getBinanceSymbol(s.coin).toLowerCase()}@ticker`);
    const wsUrl = `wss://fstream.binance.com/ws/${symbols.join('/')}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.s) {
        const rawSymbol = data.s; // e.g., BTCUSDT
        const coin = rawSymbol.replace('USDT', '');
        setSignalPrices(prev => ({
          ...prev,
          [coin]: {
            price: parseFloat(data.c).toLocaleString(undefined, { 
              minimumFractionDigits: parseFloat(data.c) < 1 ? 6 : 2,
              maximumFractionDigits: parseFloat(data.c) < 1 ? 8 : 2
            }),
            change: parseFloat(data.P).toFixed(2)
          },
          // Also store with full symbol just in case
          [rawSymbol]: {
            price: parseFloat(data.c).toLocaleString(undefined, { 
              minimumFractionDigits: parseFloat(data.c) < 1 ? 6 : 2,
              maximumFractionDigits: parseFloat(data.c) < 1 ? 8 : 2
            }),
            change: parseFloat(data.P).toFixed(2)
          }
        }));
      }
    };

    ws.onerror = (err) => console.error("Signal WebSocket error", err);
    
    return () => ws.close();
  }, [topSignals]);

  const getBinanceSymbol = (asset: string) => {
    const clean = asset.toUpperCase()
      .replace(' (BTC)', '')
      .replace(' (ETH)', '')
      .replace(' (SOL)', '')
      .replace('BITCOIN', 'BTC')
      .replace('ETHEREUM', 'ETH')
      .replace('SOLANA', 'SOL')
      .replace('ALPHABET INC. (GOOGL)', 'BTC') // Fallback for demo
      .replace('MEME COINS (DOGE, PEPE, SHIB)', 'DOGE') // Fallback for demo
      .replace(/[^A-Z0-9]/g, '');
    
    const memeCoins = ['PEPE', 'SHIB', 'FLOKI', 'BONK', 'SATS', 'RATS', 'LUNC', 'XEC', 'BTTC', 'CATI', 'NEIRO'];
    if (memeCoins.includes(clean)) return `1000${clean}USDT`;
    
    if (clean.endsWith('USDT')) return clean;
    return `${clean}USDT`;
  };

  const executeTrade = async (signal: any, confidence: number) => {
    if (!isBotEnabled) return;
    
    // Accuracy Upgrade: Use configurable confidence threshold
    if (confidence < botConfig.minConfidence) {
      addBotLog(`Sinyal diabaikan: Confidence (${confidence}%) < ${botConfig.minConfidence}%`, 'info');
      return;
    }
    
    const binanceSymbol = await validateBinanceSymbol(signal.coin);
    if (!binanceSymbol) {
      addBotLog(`Gagal mengeksekusi: Koin ${signal.coin} tidak ditemukan di Binance Futures.`, 'error');
      return;
    }
    
    // Dynamic Leverage: Use leverage from signal if available, otherwise fallback
    const suggestedLeverage = parseInt(signal.leverage.replace(/[^0-9]/g, '')) || botConfig.leverage;
    
    // Dynamic Amount: Calculate based on balance if available
    let tradeAmount = botConfig.amount;
    let currentPrice = 0;
    let balance = futuresBalance;
    
    if (balance === null && apiConfig.apiKey && apiConfig.secret) {
      addBotLog('Sinkronisasi saldo cepat...', 'info');
      balance = await fetchBalance();
    }
    
    if (balance !== null) {
      if (balance <= 0) {
        addBotLog('Gagal: Saldo Futures kosong atau tidak mencukupi.', 'error');
        return;
      }

      try {
        // Risk Management: Use 5% of balance as margin (Smarter/Safer)
        const marginToUse = balance * 0.05;
        currentPrice = parseFloat(signal.entry.replace(/[^0-9.]/g, '')) || parseFloat(realTimePrice || '0');
        
        if (currentPrice > 0) {
          // Quantity = (Margin * Leverage) / Price
          const calculatedQty = (marginToUse * suggestedLeverage) / currentPrice;
          
          // Format quantity based on asset
          if (binanceSymbol.startsWith('1000')) {
            tradeAmount = Math.floor(calculatedQty);
          } else {
            tradeAmount = parseFloat(calculatedQty.toFixed(3));
          }
          
          // Safety Check: Minimum Notional Value (Binance usually requires > $5-10)
          const notionalValue = tradeAmount * currentPrice;
          if (notionalValue < 5.1) { // Using $5.1 as a safe minimum
            addBotLog(`Sinyal diabaikan: Nilai posisi ($${notionalValue.toFixed(2)}) terlalu kecil (Min $5).`, 'info');
            return;
          }

          addBotLog(`Saldo: $${balance.toFixed(2)} | Margin: $${marginToUse.toFixed(2)} | Qty: ${tradeAmount}`, 'info');
        }
      } catch (e) {
        console.error("Error calculating dynamic amount", e);
      }
    } else {
      addBotLog('Gagal: Tidak dapat menyinkronkan saldo bursa. Periksa API Key.', 'error');
      return;
    }

    if (tradeAmount <= 0) {
      addBotLog('Gagal: Jumlah perdagangan tidak valid (0).', 'error');
      return;
    }

      addBotLog(`Mengeksekusi: ${signal.type} ${binanceSymbol} (${suggestedLeverage}x)`, 'info');
    
    try {
      // Parse prices from strings (e.g., "$65,000" -> 65000)
      const parsePrice = (p: string) => parseFloat(p.replace(/[^0-9.]/g, ''));
      
      // Dynamic TP: If confidence is very high (>95), aim for a slightly larger profit
      let targetTp = parsePrice(signal.tp);
      if (confidence >= 95) {
        const entry = parsePrice(signal.entry);
        const diff = Math.abs(targetTp - entry);
        // Add 20% more to the profit target for high confidence signals
        targetTp = signal.type === 'LONG' ? targetTp + (diff * 0.2) : targetTp - (diff * 0.2);
        addBotLog(`HIGH CONFIDENCE: Target TP diperluas untuk profit maksimal.`, 'success');
      }

      const response = await fetch('/api/binance/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: binanceSymbol,
          side: signal.type === 'LONG' ? 'buy' : 'sell',
          amount: tradeAmount,
          leverage: suggestedLeverage,
          // Force TP/SL if bot is enabled OR if autoExit is on
          tp: (botConfig.autoExit || isBotEnabled) ? targetTp : undefined,
          sl: (botConfig.autoExit || isBotEnabled) ? parsePrice(signal.sl) : undefined,
          apiKey: apiConfig.apiKey,
          secret: apiConfig.secret
        })
      });

      const result = await response.json();
      if (result.success) {
        addBotLog(result.message || `Scalp Berhasil: ${signal.type} ${signal.coin} | TP: ${signal.tp} | SL: ${signal.sl}`, 'success');
        // Refresh balance immediately after trade
        setTimeout(fetchBalance, 1000); 
      } else {
        addBotLog(`Gagal Eksekusi: ${result.error}`, 'error');
      }
    } catch (e: any) {
      addBotLog(`Kesalahan Bot: ${e.message}`, 'error');
    }
  };

  const [validatedSymbol, setValidatedSymbol] = useState<string | null>(null);

  const currentAsset = assetType === 'google' 
    ? 'Alphabet Inc. (GOOGL)' 
    : assetType === 'meme' 
      ? 'Meme Coins (DOGE, PEPE, SHIB)' 
      : customAsset || 'Bitcoin (BTC)';

  useEffect(() => {
    const validate = async () => {
      const symbol = await validateBinanceSymbol(currentAsset);
      setValidatedSymbol(symbol);
    };
    validate();
  }, [currentAsset]);

  // WebSocket for real-time price of currentAsset
  useEffect(() => {
    const binanceSymbol = validatedSymbol || getBinanceSymbol(currentAsset);
    const wsUrl = `wss://fstream.binance.com/ws/${binanceSymbol.toLowerCase()}@ticker`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.c) {
        const price = parseFloat(data.c);
        setRealTimePrice(price.toLocaleString(undefined, { 
          minimumFractionDigits: price < 1 ? 6 : 2,
          maximumFractionDigits: price < 1 ? 8 : 2
        }));
        setRealTimeChange(parseFloat(data.P).toFixed(2));
        
        // Update last point of chart
        setChartData(prev => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], price };
          return updated;
        });
      }
    };

    ws.onerror = (err) => console.error("Main Price WebSocket error", err);

    return () => ws.close();
  }, [currentAsset]);

  const handleConnectExchange = async () => {
    if (isExchangeConnected) {
      addBotLog('Menyinkronkan saldo bursa...', 'info');
      await fetchBalance();
      return;
    }
    try {
      const response = await fetch('/api/auth/url');
      const { url } = await response.json();
      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) alert('Harap izinkan popup untuk menghubungkan bursa.');
    } catch (e) {
      console.error('Exchange connection error:', e);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsExchangeConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadData = useCallback(async (isSilent = false) => {
    if (loading && isSilent) return; // Prevent multiple simultaneous silent loads
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const binanceSymbol = await validateBinanceSymbol(currentAsset);
      if (!binanceSymbol) {
        setError(`Aset "${currentAsset}" tidak tersedia di Binance Futures. Harap gunakan koin yang terdaftar (misal: BTC, ETH, SOL, PEPE).`);
        setLoading(false);
        return;
      }
      
      const data = await fetchUnifiedMarketReport(currentAsset);
      setReport(data);
      setChartData(data.chartData);
      setCountdown(120);

      // Trigger bot if enabled
      if (isBotEnabled && data.signals) {
        executeTrade(data.signals, data.botAnalysis.confidence);
      }
    } catch (err: any) {
      const errorString = typeof err === 'object' ? JSON.stringify(err) : String(err);
      const errorMessage = err?.message || errorString;
      
      if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
        setError('Kuota API Gemini telah habis. Silakan periksa paket dan detail penagihan Anda, atau coba lagi nanti.');
      } else {
        setError('Koneksi terputus. Mencoba kembali...');
      }
      console.error(err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [currentAsset, isBotEnabled]);

  const runHuntingMode = async () => {
    if (!isBotEnabled || !isHuntingMode) return;
    
    addBotLog('Scalping Mode: Memindai koin dengan likuiditas & volatilitas tinggi...', 'info');
    try {
      const volatileSymbols = await fetchTopVolatileSymbols(8);
      addBotLog(`Scalping Mode: Menganalisis ${volatileSymbols.join(', ')}`, 'info');
      
      for (const symbol of volatileSymbols) {
        // Skip if already in position
        const cleanSymbol = symbol.replace('/', '');
        if (activePositions.some(p => p.symbol.includes(cleanSymbol))) {
          addBotLog(`Scalping Mode: Melewati ${symbol}, posisi sudah terbuka.`, 'info');
          continue;
        }
        
        try {
          addBotLog(`Scalping Mode: Menganalisis teknikal ${symbol} (Timeframe 1m-5m)...`, 'info');
          const report = await fetchUnifiedMarketReport(symbol, 0);
          
          if (report.botAnalysis && report.botAnalysis.confidence >= (botConfig.minConfidence || 75)) {
            const signal = report.signals;
            const action = signal.type;
            addBotLog(`Scalping Mode: Peluang ${action} terdeteksi di ${symbol} (${report.botAnalysis.confidence}%)`, 'success');
            
            // Execute trade using the signal found in report
            await executeTrade(signal, report.botAnalysis.confidence);
          } else {
            const conf = report.botAnalysis?.confidence || 0;
            addBotLog(`Scalping Mode: Sinyal ${symbol} kurang meyakinkan (${conf}%).`, 'info');
          }
        } catch (e) {
          console.error(`Scalping Mode error for ${symbol}:`, e);
        }
        // Small delay between assets to avoid rate limits
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (e) {
      console.error("Scalping Mode main error:", e);
      addBotLog("Scalping Mode: Gagal memindai pasar.", "error");
    }
  };

  useEffect(() => {
    if (isBotEnabled && isHuntingMode) {
      const interval = setInterval(runHuntingMode, 180000); // Run every 3 minutes
      runHuntingMode(); // Run immediately
      return () => clearInterval(interval);
    }
  }, [isBotEnabled, isHuntingMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time polling simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadData(true);
          return 120;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    if (!searchTerm.trim()) return;
    const delayDebounceFn = setTimeout(() => {
      setCustomAsset(searchTerm.trim().toUpperCase());
      setAssetType('custom');
      addToRecentSearches(searchTerm.trim().toUpperCase());
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setCustomAsset(searchTerm.trim().toUpperCase());
      setAssetType('custom');
      addToRecentSearches(searchTerm.trim().toUpperCase());
      loadData();
    }
  };

  const quickSearch = (asset: string) => {
    setSearchTerm(asset);
    setCustomAsset(asset);
    setAssetType('custom');
    addToRecentSearches(asset);
  };

  const parsePrice = (priceStr: string) => {
    return parseFloat(priceStr.replace(/[^0-9.]/g, ''));
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-emerald-500/30">
      <LiveTicker />
      
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <Activity className="text-black w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-lg tracking-tight leading-none mb-1">PRO TERMINAL</h1>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Tautan Neural Aktif</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 max-w-md relative">
            <form onSubmit={handleSearch} className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Cari Aset di Binance (misal: BTC, ETH, SOL)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-10 pr-10 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />
              {searchTerm && (
                <button 
                  type="button"
                  onClick={() => { setSearchTerm(''); setCustomAsset(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <RefreshCw className="w-3 h-3 rotate-45" />
                </button>
              )}
            </form>
            
            {/* Quick Access Suggestions */}
            <div className="absolute top-full left-0 right-0 mt-2 flex gap-2 overflow-x-auto no-scrollbar py-1">
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => quickSearch(s)}
                  className="px-3 py-1 bg-zinc-900/50 border border-zinc-800 rounded-lg text-[10px] font-mono text-zinc-400 hover:border-emerald-500/30 hover:text-emerald-400 transition-all whitespace-nowrap"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 hover:bg-zinc-800 rounded-xl transition-all border border-zinc-800 text-zinc-400 hover:text-emerald-500"
              title="Pengaturan API"
            >
              <Zap className={cn("w-4 h-4", apiConfig.apiKey ? "text-emerald-500" : "text-zinc-500")} />
            </button>

            <button
              onClick={handleConnectExchange}
              className={cn(
                "hidden lg:flex flex-col items-start gap-0.5 px-4 py-1.5 rounded-xl transition-all border",
                isExchangeConnected 
                  ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" 
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              )}
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                <ShieldAlert className="w-3 h-3" />
                {isExchangeConnected ? 'Bursa Terhubung' : 'Hubungkan Bursa'}
              </div>
              {isExchangeConnected && futuresBalance !== null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-bold text-emerald-400">
                    ${futuresBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {isBalanceLoading && <RefreshCw className="w-2.5 h-2.5 text-emerald-500/50 animate-spin" />}
                </div>
              )}
            </button>

            <div className="hidden md:flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 shadow-inner">
              <button 
                onClick={() => setAssetType('google')}
                className={cn(
                  "px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider",
                  assetType === 'google' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                SAHAM
              </button>
              <button 
                onClick={() => setAssetType('meme')}
                className={cn(
                  "px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider",
                  assetType === 'meme' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                KRIPTO
              </button>
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-zinc-800">
              <WIBClock />
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-zinc-500 font-mono uppercase">Refresh</span>
                <span className="text-xs font-mono font-bold text-emerald-500">{countdown}s</span>
              </div>
              <button 
                onClick={() => loadData()}
                disabled={loading}
                className="p-2.5 hover:bg-zinc-800 rounded-xl transition-all border border-transparent hover:border-zinc-700 disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4 text-zinc-400", loading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading && !report ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-12 h-12 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-sm font-mono text-zinc-500 animate-pulse uppercase tracking-widest">Menganalisis Pola Pasar...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Chart & Signal */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Asset Performance Header */}
              <div className="flex items-end justify-between bg-zinc-900/30 p-6 rounded-3xl border border-zinc-800/50">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono uppercase tracking-widest border border-zinc-700">
                      {report?.asset}
                    </span>
                    {validatedSymbol && validatedSymbol !== report?.asset && (
                      <span className="text-[10px] bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded font-mono uppercase tracking-widest border border-indigo-500/20">
                        {validatedSymbol}
                      </span>
                    )}
                    {assetType === 'custom' && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-mono uppercase tracking-widest border border-emerald-500/20">
                        Pencarian Kustom
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-4">
                    <h2 className="text-5xl font-black tracking-tighter">${realTimePrice || report?.currentPrice}</h2>
                    <div className={cn(
                      "flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-lg",
                      (realTimeChange || report?.change24h || '').includes('-') ? "text-rose-500 bg-rose-500/10" : "text-emerald-500 bg-emerald-500/10"
                    )}>
                      {(realTimeChange || report?.change24h || '').includes('-') ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      {realTimeChange ? `${realTimeChange}%` : report?.change24h}
                    </div>
                  </div>
                </div>

                <div className="hidden md:block text-right">
                  <p className="text-[10px] text-zinc-500 font-mono uppercase mb-1">Tren Pasar</p>
                  <div className={cn(
                    "text-xl font-black uppercase tracking-tighter",
                    report?.technicals.trend === 'uptrend' ? "text-emerald-500" : report?.technicals.trend === 'downtrend' ? "text-rose-500" : "text-zinc-400"
                  )}>
                    {report?.technicals.trend}
                  </div>
                </div>
              </div>

              {/* Chart with Integrated Signal */}
              <div className="relative group">
                <StockChart 
                  data={chartData} 
                  signal={report?.signals ? {
                    type: report.signals.type,
                    entry: parsePrice(report.signals.entry),
                    tp: parsePrice(report.signals.tp),
                    sl: parsePrice(report.signals.sl)
                  } : undefined}
                  fibonacci={report?.technicals.fibonacci}
                />
                
                {/* Floating Signal Card */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="absolute top-6 left-6 bg-zinc-950/90 backdrop-blur-md border border-zinc-800 p-5 rounded-2xl shadow-2xl max-w-[240px]"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-bold uppercase tracking-wider">Sinyal Futures</span>
                    </div>
                    <div className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-black",
                      report?.signals.type === 'LONG' ? "bg-emerald-500 text-black" : "bg-rose-500 text-white"
                    )}>
                      {report?.signals.type}
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 font-mono uppercase">Entry</span>
                      <span className="text-xs font-mono font-bold text-blue-400">{report?.signals.entry}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 font-mono uppercase">Take Profit</span>
                      <span className="text-xs font-mono font-bold text-emerald-500">{report?.signals.tp}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 font-mono uppercase">Stop Loss</span>
                      <span className="text-xs font-mono font-bold text-rose-500">{report?.signals.sl}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-zinc-800 pt-2">
                      <span className="text-[10px] text-zinc-500 font-mono uppercase">R/R Ratio</span>
                      <span className="text-xs font-mono font-bold text-zinc-300">{report?.botAnalysis.riskRewardRatio}</span>
                    </div>
                  </div>

                  <a 
                    href={`https://www.binance.com/en/futures/${report?.signals.coin}USDT`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-zinc-100 hover:bg-white text-black py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                  >
                    Buka di Binance
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </motion.div>
              </div>

              {/* Technical Analysis Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl">
                  <p className="text-[10px] text-zinc-500 font-mono uppercase mb-2">RSI (14)</p>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-2xl font-black",
                      (report?.technicals.rsi || 0) > 70 ? "text-rose-500" : (report?.technicals.rsi || 0) < 30 ? "text-emerald-500" : "text-white"
                    )}>
                      {report?.technicals.rsi}
                    </span>
                  </div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl">
                  <p className="text-[10px] text-zinc-500 font-mono uppercase mb-2">EMA 20/50</p>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-blue-400">E20: {report?.technicals.ema20}</span>
                    <span className="text-xs font-bold text-purple-400">E50: {report?.technicals.ema50}</span>
                  </div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl">
                  <p className="text-[10px] text-zinc-500 font-mono uppercase mb-2">Vol 24h</p>
                  <span className="text-sm font-bold text-zinc-300">{report?.technicals.volume24h}</span>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl">
                  <p className="text-[10px] text-zinc-500 font-mono uppercase mb-2">Regime</p>
                  <span className="text-xs font-bold text-emerald-400 uppercase">{report?.botAnalysis.marketRegime}</span>
                </div>
              </div>

              {/* Fibonacci Levels Section */}
              <div className="bg-zinc-900/30 border border-zinc-800/50 p-6 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Layers className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider">Fibonacci Retracement</h3>
                    <p className="text-[10px] text-zinc-500 font-mono">Analisis Level Support & Resistance Berbasis Fibonacci</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {report?.technicals.fibonacci && Object.entries(report.technicals.fibonacci).map(([level, value]) => (
                    <div key={level} className="bg-zinc-950/50 border border-zinc-800/50 p-4 rounded-2xl flex flex-col gap-1">
                      <span className="text-[10px] text-purple-400 font-mono font-bold">{level}</span>
                      <span className="text-sm font-mono font-bold text-zinc-100">{Number(value).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Market Summary */}
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Intelijen Pasar AI</h3>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {report?.summary}
                </p>
              </div>

              {/* Bot Intelligence Insights */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Logika Keputusan Bot</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 font-mono uppercase">Confidence</span>
                    <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${report?.botAnalysis.confidence}%` }}
                        className={cn(
                          "h-full transition-all duration-1000",
                          (report?.botAnalysis.confidence || 0) >= 80 ? "bg-emerald-500" : "bg-amber-500"
                        )}
                      />
                    </div>
                    <span className={cn(
                      "text-[10px] font-mono font-bold",
                      (report?.botAnalysis.confidence || 0) >= 80 ? "text-emerald-500" : "text-amber-500"
                    )}>{report?.botAnalysis.confidence}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-black/30 p-4 rounded-2xl border border-zinc-800/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Newspaper className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Analisis Berita</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {report?.botAnalysis.newsVerdict}
                    </p>
                  </div>
                  <div className="bg-black/30 p-4 rounded-2xl border border-zinc-800/50">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Analisis Grafik</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {report?.botAnalysis.chartVerdict}
                    </p>
                  </div>
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl flex items-start gap-3">
                  <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                    <Target className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block mb-1">Strategi Gabungan</span>
                    <p className="text-sm font-bold text-zinc-200">
                      {report?.botAnalysis.combinedVerdict}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right Column: News Feed & Bot */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Auto-Trading Bot Control */}
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4">
                  <div className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    isBotEnabled ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" : "bg-zinc-700"
                  )} />
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <Zap className={cn("w-4 h-4", isBotEnabled ? "text-emerald-500" : "text-zinc-500")} />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Bot Auto-Trading Binance</h3>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-[10px] text-zinc-500 font-mono uppercase mb-1">Status Sistem</p>
                    <p className={cn("text-sm font-bold", isBotEnabled ? "text-emerald-400" : "text-zinc-400")}>
                      {isBotEnabled ? 'BOT AKTIF & SIAGA' : 'BOT NONAKTIF'}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setIsBotEnabled(!isBotEnabled);
                      addBotLog(isBotEnabled ? 'Bot dimatikan secara manual' : 'Bot diaktifkan - Mencari peluang...', 'info');
                    }}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                      isBotEnabled 
                        ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20" 
                        : "bg-emerald-500 text-black hover:bg-emerald-400"
                    )}
                  >
                    {isBotEnabled ? 'Matikan Bot' : 'Aktifkan Bot'}
                  </button>
                </div>

                <div className="flex items-center justify-between mb-6 p-3 bg-black/20 rounded-2xl border border-zinc-800/50">
                  <div className="flex items-center gap-2">
                    <Crosshair className={cn("w-3 h-3", isHuntingMode ? "text-emerald-500" : "text-zinc-600")} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Hunting Mode</span>
                  </div>
                  <button 
                    onClick={() => setIsHuntingMode(!isHuntingMode)}
                    className={cn(
                      "w-10 h-5 rounded-full relative transition-all",
                      isHuntingMode ? "bg-emerald-500" : "bg-zinc-800"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                      isHuntingMode ? "left-6" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="flex items-center justify-between mb-6 p-3 bg-black/20 rounded-2xl border border-zinc-800/50">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={cn("w-3 h-3", isGuardianActive ? "text-blue-500" : "text-zinc-600")} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Anomaly Guardian</span>
                  </div>
                  <button 
                    onClick={() => setIsGuardianActive(!isGuardianActive)}
                    className={cn(
                      "w-10 h-5 rounded-full relative transition-all",
                      isGuardianActive ? "bg-blue-500" : "bg-zinc-800"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                      isGuardianActive ? "left-6" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest mb-2">Log Aktivitas Bot</p>
                  {botLogs.length === 0 ? (
                    <p className="text-[10px] text-zinc-700 italic">Belum ada aktivitas...</p>
                  ) : (
                    botLogs.map((log, i) => (
                      <div key={i} className="flex items-start gap-2 text-[10px] font-mono leading-tight">
                        <span className="text-zinc-600 shrink-0">[{log.time}]</span>
                        <span className={cn(
                          log.type === 'success' ? "text-emerald-500" : 
                          log.type === 'error' ? "text-rose-500" : "text-zinc-400"
                        )}>
                          {log.msg}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {!isExchangeConnected && isBotEnabled && (
                  <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[9px] text-amber-400 leading-tight">
                      Peringatan: Hubungkan bursa atau atur API Key di .env untuk eksekusi nyata.
                    </p>
                  </div>
                )}
              </div>

              {/* ACTIVE POSITIONS */}
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Posisi Aktif (Futures)</h3>
                </div>

                <div className="space-y-3">
                  {activePositions.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-zinc-800 rounded-2xl">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Tidak ada posisi terbuka</p>
                    </div>
                  ) : (
                    activePositions.map((pos, i) => {
                      const liqPrice = parseFloat(pos.liquidationPrice);
                      const markPrice = parseFloat(pos.markPrice);
                      const distToLiq = liqPrice === 0 ? 100 : Math.abs((markPrice - liqPrice) / markPrice) * 100;
                      const riskLevel = distToLiq < 10 ? 'HIGH' : distToLiq < 25 ? 'MEDIUM' : 'LOW';

                      return (
                        <div key={i} className="bg-black/30 border border-zinc-800 p-4 rounded-2xl relative overflow-hidden group">
                          {/* Risk Indicator Bar */}
                          <div className={cn(
                            "absolute top-0 left-0 w-1 h-full",
                            riskLevel === 'HIGH' ? "bg-rose-500" : riskLevel === 'MEDIUM' ? "bg-amber-500" : "bg-emerald-500"
                          )} />
                          
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-100">{pos.symbol}</span>
                                <span className={cn(
                                  "text-[8px] font-bold px-1 rounded uppercase",
                                  riskLevel === 'HIGH' ? "bg-rose-500/20 text-rose-500" : riskLevel === 'MEDIUM' ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-500"
                                )}>
                                  RISK: {riskLevel}
                                </span>
                              </div>
                              <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block",
                                pos.side === 'long' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                              )}>
                                {pos.side.toUpperCase()} {pos.leverage}x
                              </span>
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                "text-xs font-mono font-bold",
                                parseFloat(pos.unrealizedPnl) >= 0 ? "text-emerald-500" : "text-rose-500"
                              )}>
                                {parseFloat(pos.unrealizedPnl) >= 0 ? '+' : ''}{parseFloat(pos.unrealizedPnl).toFixed(2)} USDT
                              </p>
                              <p className="text-[9px] text-zinc-500 font-mono">
                                ({parseFloat(pos.percentage).toFixed(2)}%)
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-zinc-800/50">
                            <div>
                              <p className="text-[9px] text-zinc-500 uppercase">Entry / Mark</p>
                              <p className="text-[10px] font-mono text-zinc-300">
                                ${parseFloat(pos.entryPrice).toLocaleString()} / <span className="text-zinc-500">${parseFloat(pos.markPrice).toLocaleString()}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] text-zinc-500 uppercase">Margin Call Dist.</p>
                              <p className={cn(
                                "text-[10px] font-mono font-bold",
                                riskLevel === 'HIGH' ? "text-rose-500" : "text-amber-500"
                              )}>
                                {distToLiq.toFixed(2)}%
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex gap-2">
                            <button 
                              onClick={() => closePosition(pos.symbol)}
                              className="flex-1 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-[9px] font-bold text-rose-500 uppercase transition-all"
                            >
                              Tutup Paksa
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SIGNAL CALL HUB */}
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Signal Call Hub</h3>
                  </div>
                  <button 
                    onClick={scanMarketForSignals}
                    disabled={isScanning}
                    className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] font-bold text-emerald-500 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={cn("w-3 h-3", isScanning && "animate-spin")} />
                    {isScanning ? 'MEMINDAI...' : 'SCAN PASAR'}
                  </button>
                </div>
                
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Sinyal dengan probabilitas tinggi (High Probability) yang dideteksi oleh mesin neural di berbagai koin.
                </p>

                <div className="space-y-3">
                  {isScanning ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="bg-zinc-900/30 border border-zinc-800/50 p-4 rounded-2xl animate-pulse">
                          <div className="flex justify-between mb-4">
                            <div className="w-24 h-4 bg-zinc-800 rounded" />
                            <div className="w-16 h-4 bg-zinc-800 rounded" />
                          </div>
                          <div className="w-full h-12 bg-zinc-800/50 rounded-xl mb-4" />
                          <div className="grid grid-cols-3 gap-2">
                            <div className="h-8 bg-zinc-800 rounded" />
                            <div className="h-8 bg-zinc-800 rounded" />
                            <div className="h-8 bg-zinc-800 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : topSignals.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-zinc-800 rounded-2xl">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Klik scan untuk mencari sinyal</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {topSignals.map((signal, idx) => {
                        const coinKey = signal.coin.toUpperCase().replace('USDT', '');
                        const priceData = signalPrices[coinKey] || signalPrices[`${coinKey}USDT`];
                        
                        return (
                          <motion.div 
                            key={idx}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-black/40 border border-zinc-800/50 p-4 rounded-2xl hover:border-emerald-500/30 transition-all group"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-zinc-800 rounded-lg flex items-center justify-center text-[10px] font-bold text-zinc-300">
                                  {signal.coin.substring(0, 1)}
                                </div>
                                <span className="text-xs font-black tracking-tight">{signal.coin}</span>
                              </div>
                              <div className={cn(
                                "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                                signal.type === 'LONG' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                              )}>
                                {signal.type} {signal.leverage}
                              </div>
                            </div>

                            <div className="flex items-center justify-between mb-4 bg-zinc-900/50 p-2 rounded-xl border border-zinc-800/50">
                              <div className="flex flex-col">
                                <span className="text-[8px] text-zinc-500 uppercase font-mono">Harga Live</span>
                                <span className={cn(
                                  "text-sm font-mono font-bold",
                                  priceData?.change.startsWith('-') ? "text-rose-400" : "text-emerald-400"
                                )}>
                                  ${priceData?.price || '---'}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[8px] text-zinc-500 uppercase font-mono">24h Change</span>
                                <p className={cn(
                                  "text-[10px] font-mono font-bold",
                                  priceData?.change.startsWith('-') ? "text-rose-500" : "text-emerald-500"
                                )}>
                                  {priceData?.change || '0.00'}%
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-3">
                              <div>
                                <p className="text-[8px] text-zinc-600 uppercase font-mono mb-0.5">Entry</p>
                                <p className="text-[10px] font-mono font-bold text-blue-400">{signal.entry}</p>
                              </div>
                              <div>
                                <p className="text-[8px] text-zinc-600 uppercase font-mono mb-0.5">Target TP</p>
                                <p className="text-[10px] font-mono font-bold text-emerald-500">{signal.tp}</p>
                              </div>
                              <div>
                                <p className="text-[8px] text-zinc-600 uppercase font-mono mb-0.5">Stop Loss</p>
                                <p className="text-[10px] font-mono font-bold text-rose-500">{signal.sl}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <ShieldAlert className={cn("w-3 h-3", 
                                    signal.risk === 'low' ? "text-emerald-500" : 
                                    signal.risk === 'medium' ? "text-amber-500" : "text-rose-500"
                                  )} />
                                  <span className="text-[9px] text-zinc-500 uppercase font-mono">Risiko: {signal.risk}</span>
                                </div>
                                {signal.timestamp && (
                                  <div className="flex items-center gap-1 text-[8px] text-zinc-600 font-mono">
                                    <Clock className="w-2 h-2" />
                                    {signal.timestamp} WIB
                                  </div>
                                )}
                              </div>
                              <button 
                                onClick={() => quickSearch(signal.coin)}
                                className="text-[9px] font-bold text-zinc-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                              >
                                DETAIL <ArrowUpRight className="w-2 h-2" />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Market Intelligence Hub (References) */}
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Market Intelligence Hub</h3>
                </div>
                <p className="text-[10px] text-zinc-500 leading-relaxed mb-4">
                  Referensi data analisis pergerakan crypto dari berbagai sumber terpercaya untuk konfirmasi sinyal.
                </p>
                
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'TradingView', icon: <LineChart className="w-3 h-3" />, url: 'https://www.tradingview.com/chart/', color: 'text-blue-400' },
                    { name: 'CoinGlass', icon: <BarChart3 className="w-3 h-3" />, url: 'https://www.coinglass.com/', color: 'text-amber-400' },
                    { name: 'CryptoQuant', icon: <Database className="w-3 h-3" />, url: 'https://cryptoquant.com/', color: 'text-emerald-400' },
                    { name: 'Glassnode', icon: <Activity className="w-3 h-3" />, url: 'https://glassnode.com/', color: 'text-zinc-300' },
                    { name: 'Santiment', icon: <TrendingUp className="w-3 h-3" />, url: 'https://santiment.net/', color: 'text-rose-400' },
                    { name: 'LunarCrush', icon: <MessageSquare className="w-3 h-3" />, url: 'https://lunarcrush.com/', color: 'text-orange-400' },
                    { name: 'DefiLlama', icon: <Flame className="w-3 h-3" />, url: 'https://defillama.com/', color: 'text-red-400' },
                    { name: 'Messari', icon: <Target className="w-3 h-3" />, url: 'https://messari.io/', color: 'text-indigo-400' },
                  ].map((source) => (
                    <a 
                      key={source.name}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-black/30 border border-zinc-800/50 rounded-xl hover:border-zinc-600 hover:bg-black/50 transition-all group"
                    >
                      <span className={source.color}>{source.icon}</span>
                      <span className="text-[10px] font-bold text-zinc-400 group-hover:text-zinc-200">{source.name}</span>
                      <ArrowUpRight className="w-2 h-2 text-zinc-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
                
                <div className="pt-2">
                  <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                    <p className="text-[9px] text-blue-400 font-mono leading-tight">
                      <span className="font-bold">TIP:</span> Gunakan CoinGlass untuk memantau likuidasi dan TradingView untuk konfirmasi pola candlestick sebelum eksekusi bot.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <Newspaper className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Penggerak Pasar</h3>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-mono text-emerald-500">
                  <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE NEWS
                </div>
              </div>

              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {report?.news.map((item, i) => (
                    <motion.a
                      key={i}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="block group bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800/50 hover:border-zinc-700 p-5 rounded-2xl transition-all duration-300"
                    >
                      <h4 className="font-bold text-sm group-hover:text-emerald-400 transition-colors line-clamp-2 mb-2 leading-tight">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-zinc-500 line-clamp-2 mb-4 leading-relaxed">
                        {item.snippet}
                      </p>
                      <div className="flex items-center justify-between text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                        <span className="flex items-center gap-1.5">
                          <div className="w-1 h-1 rounded-full bg-zinc-700" />
                          {item.source}
                        </span>
                        <span>{item.date}</span>
                      </div>
                    </motion.a>
                  ))}
                </AnimatePresence>
              </div>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">{error}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-12 mt-12 bg-zinc-950/50">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3 opacity-30 grayscale hover:grayscale-0 transition-all cursor-default">
            <Activity className="w-5 h-5" />
            <span className="text-[10px] font-mono uppercase tracking-[0.3em]">Neural Terminal v4.0</span>
          </div>
          <div className="flex gap-10 text-[9px] font-mono uppercase tracking-widest text-zinc-600">
            <a href="#" className="hover:text-emerald-500 transition-colors">Pengungkapan Risiko</a>
            <a href="#" className="hover:text-emerald-500 transition-colors">Status API</a>
            <a href="#" className="hover:text-emerald-500 transition-colors">Mesin Neural</a>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <Zap className="text-emerald-500 w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Konfigurasi API Binance</h3>
                  <p className="text-xs text-zinc-500">Kunci disimpan secara lokal di browser Anda.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">API Credentials</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1.5 ml-1">API Key</label>
                      <input 
                        type="password"
                        value={apiConfig.apiKey}
                        onChange={(e) => setApiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                        placeholder="Masukkan Binance API Key"
                        className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1.5 ml-1">Secret Key</label>
                      <input 
                        type="password"
                        value={apiConfig.secret}
                        onChange={(e) => setApiConfig(prev => ({ ...prev, secret: e.target.value }))}
                        placeholder="Masukkan Binance Secret Key"
                        className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Bot Auto Trading (Aggressive)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1.5 ml-1">Leverage</label>
                      <input 
                        type="number"
                        value={botConfig.leverage}
                        onChange={(e) => setBotConfig(prev => ({ ...prev, leverage: parseInt(e.target.value) }))}
                        className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1.5 ml-1">Amount (Qty)</label>
                      <input 
                        type="number"
                        step="0.001"
                        value={botConfig.amount}
                        onChange={(e) => setBotConfig(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                        className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1.5 ml-1">Min. Confidence: {botConfig.minConfidence}%</label>
                    <input 
                      type="range"
                      min="50"
                      max="95"
                      value={botConfig.minConfidence}
                      onChange={(e) => setBotConfig(prev => ({ ...prev, minConfidence: parseInt(e.target.value) }))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Target className="w-3 h-3 text-emerald-500" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Auto TP & SL</span>
                    </div>
                    <button 
                      onClick={() => setBotConfig(prev => ({ ...prev, autoExit: !prev.autoExit }))}
                      className={cn(
                        "w-10 h-5 rounded-full relative transition-all",
                        botConfig.autoExit ? "bg-emerald-500" : "bg-zinc-800"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                        botConfig.autoExit ? "left-6" : "left-1"
                      )} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-zinc-400 hover:bg-zinc-800 transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={saveApiConfig}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-3 rounded-xl text-sm font-bold transition-all"
                >
                  Simpan Kunci
                </button>
              </div>

              <div className="mt-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Kunci Anda hanya digunakan untuk eksekusi perdagangan. Pastikan API Key memiliki izin "Spot Trade" atau "Futures Trade" di Binance.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
