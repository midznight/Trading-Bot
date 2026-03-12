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
  Flame
} from 'lucide-react';
import { 
  fetchUnifiedMarketReport,
  MarketReport
} from './services/geminiService';
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
    const fetchPrices = async () => {
      try {
        // Using Binance public API for real-time crypto prices
        const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
        const results = await Promise.all(
          symbols.map(s => fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${s}`).then(r => r.json()))
        );
        const newPrices: { [key: string]: string } = {};
        results.forEach(r => {
          newPrices[r.symbol.replace('USDT', '')] = parseFloat(r.price).toLocaleString(undefined, { minimumFractionDigits: 2 });
        });
        setPrices(newPrices);
      } catch (e) {
        console.error("Ticker fetch error", e);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 5000);
    return () => clearInterval(interval);
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
  const [customAsset, setCustomAsset] = useState('');
  const [report, setReport] = useState<MarketReport | null>(null);
  const [realTimePrice, setRealTimePrice] = useState<string | null>(null);
  const [realTimeChange, setRealTimeChange] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ time: string; price: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [isExchangeConnected, setIsExchangeConnected] = useState(false);
  const [isBotEnabled, setIsBotEnabled] = useState(false);
  const [botLogs, setBotLogs] = useState<{time: string, msg: string, type: 'info' | 'success' | 'error'}[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(JSON.parse(localStorage.getItem('RECENT_SEARCHES') || '["BTC", "ETH", "SOL", "PEPE"]'));
  const [apiConfig, setApiConfig] = useState({
    apiKey: localStorage.getItem('BINANCE_API_KEY') || '',
    secret: localStorage.getItem('BINANCE_SECRET') || ''
  });

  const saveApiConfig = () => {
    localStorage.setItem('BINANCE_API_KEY', apiConfig.apiKey);
    localStorage.setItem('BINANCE_SECRET', apiConfig.secret);
    setShowSettings(false);
    addBotLog('Konfigurasi API disimpan', 'success');
  };

  const addToRecentSearches = (asset: string) => {
    const updated = [asset, ...recentSearches.filter(s => s !== asset)].slice(0, 6);
    setRecentSearches(updated);
    localStorage.setItem('RECENT_SEARCHES', JSON.stringify(updated));
  };

  const addBotLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setBotLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 5));
  };

  const executeTrade = async (signal: any, confidence: number) => {
    if (!isBotEnabled) return;
    
    // Accuracy Upgrade: Only trade if confidence is high (e.g., > 80%)
    if (confidence < 80) {
      addBotLog(`Sinyal diabaikan: Confidence (${confidence}%) di bawah ambang batas (80%)`, 'info');
      return;
    }
    
    addBotLog(`Menganalisis sinyal: ${signal.type} ${signal.coin} (Conf: ${confidence}%)`, 'info');
    
    try {
      const response = await fetch('/api/binance/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: `${signal.coin}USDT`,
          side: signal.type === 'LONG' ? 'buy' : 'sell',
          amount: 0.001, // Default small amount for safety
          type: 'market',
          apiKey: apiConfig.apiKey,
          secret: apiConfig.secret
        })
      });

      const result = await response.json();
      if (result.success) {
        addBotLog(`Berhasil mengambil posisi: ${signal.type} ${signal.coin}`, 'success');
      } else {
        addBotLog(`Gagal mengambil posisi: ${result.error}`, 'error');
      }
    } catch (e: any) {
      addBotLog(`Kesalahan Bot: ${e.message}`, 'error');
    }
  };

  const currentAsset = assetType === 'google' 
    ? 'Alphabet Inc. (GOOGL)' 
    : assetType === 'meme' 
      ? 'Meme Coins (DOGE, PEPE, SHIB)' 
      : customAsset || 'Bitcoin (BTC)';

  // Poll real-time price from Binance
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const symbol = currentAsset.toUpperCase().replace('/', '').replace(' (GOOGL)', '').replace('ALPHABET INC.', 'BTC'); // Fallback for demo
        // Map common names to Binance symbols
        let binanceSymbol = symbol;
        if (symbol.includes('BTC')) binanceSymbol = 'BTCUSDT';
        else if (symbol.includes('ETH')) binanceSymbol = 'ETHUSDT';
        else if (symbol.includes('SOL')) binanceSymbol = 'SOLUSDT';
        else if (symbol.includes('PEPE')) binanceSymbol = 'PEPEUSDT';
        else if (!symbol.endsWith('USDT')) binanceSymbol = `${symbol}USDT`;

        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`);
        if (response.ok) {
          const data = await response.json();
          const price = parseFloat(data.lastPrice);
          setRealTimePrice(price.toLocaleString(undefined, { minimumFractionDigits: 2 }));
          setRealTimeChange(parseFloat(data.priceChangePercent).toFixed(2));
          
          // Update last point of chart if it exists
          setChartData(prev => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], price };
            return updated;
          });
        }
      } catch (e) {
        console.error("Error polling real-time price", e);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [currentAsset]);

  const handleConnectExchange = async () => {
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
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const data = await fetchUnifiedMarketReport(currentAsset);
      setReport(data);
      setChartData(data.chartData);
      setCountdown(60);

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

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time polling simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadData(true);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loadData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (customAsset.trim()) {
      setAssetType('custom');
      addToRecentSearches(customAsset.trim().toUpperCase());
      loadData();
    }
  };

  const quickSearch = (asset: string) => {
    setCustomAsset(asset);
    setAssetType('custom');
    addToRecentSearches(asset);
    // The useEffect for currentAsset will trigger loadData
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
                value={customAsset}
                onChange={(e) => setCustomAsset(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-10 pr-10 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />
              {customAsset && (
                <button 
                  type="button"
                  onClick={() => setCustomAsset('')}
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
                "hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border",
                isExchangeConnected 
                  ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" 
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              )}
            >
              <ShieldAlert className="w-3 h-3" />
              {isExchangeConnected ? 'Bursa Terhubung' : 'Hubungkan Bursa'}
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

              <div className="space-y-4">
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
