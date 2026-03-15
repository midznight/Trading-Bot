
export interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  highPrice: string;
  lowPrice: string;
}

export interface BinanceKline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const fetchBinanceSymbols = async (): Promise<string[]> => {
  try {
    const response = await fetch('/api/binance/market/symbols');
    if (!response.ok) {
      const text = await response.text();
      console.error('Symbols API error:', text);
      throw new Error('Failed to fetch symbols');
    }
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Received non-JSON response from symbols API');
    }
    return response.json();
  } catch (e) {
    console.error("Error fetching symbols:", e);
    return [];
  }
};

export const validateBinanceSymbol = async (asset: string): Promise<string | null> => {
  const symbols = await fetchBinanceSymbols();
  if (symbols.length === 0) return null;

  const cleanAsset = asset.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Try exact match with USDT
  const directMatch = `${cleanAsset}USDT`;
  if (symbols.includes(directMatch)) return directMatch;

  // Try 1000 prefix (common for meme coins on Futures)
  const memeMatch = `1000${cleanAsset}USDT`;
  if (symbols.includes(memeMatch)) return memeMatch;

  // Try to find any symbol that contains the asset name and ends with USDT
  const fuzzyMatch = symbols.find(s => s.includes(cleanAsset) && s.endsWith('USDT'));
  if (fuzzyMatch) return fuzzyMatch;

  return null;
};

export const fetchBinanceTicker = async (symbol: string): Promise<BinanceTicker> => {
  let formattedSymbol = symbol.toUpperCase().replace('/', '');
  if (!formattedSymbol.endsWith('USDT')) formattedSymbol += 'USDT';
  
  const response = await fetch(`/api/binance/market/ticker?symbol=${formattedSymbol}`);
  if (!response.ok) {
    const text = await response.text();
    console.error('Ticker API error:', text);
    throw new Error('Failed to fetch ticker from Binance Futures');
  }
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from ticker API');
  }
  return response.json();
};

export const fetchBinanceKlines = async (symbol: string, interval: string = '1h', limit: number = 24): Promise<BinanceKline[]> => {
  let formattedSymbol = symbol.toUpperCase().replace('/', '');
  if (!formattedSymbol.endsWith('USDT')) formattedSymbol += 'USDT';

  const response = await fetch(`/api/binance/market/klines?symbol=${formattedSymbol}&interval=${interval}&limit=${limit}`);
  if (!response.ok) {
    const text = await response.text();
    console.error('Klines API error:', text);
    throw new Error('Failed to fetch klines from Binance Futures');
  }
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from klines API');
  }
  const data = await response.json();
  return data.map((d: any) => ({
    time: d[0],
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4]),
    volume: parseFloat(d[5]),
  }));
};

export const fetchTopVolatileSymbols = async (limit: number = 15): Promise<string[]> => {
  try {
    const [volatileRes, officialSymbols] = await Promise.all([
      fetch('/api/binance/market/volatile'),
      fetchBinanceSymbols()
    ]);
    
    if (!volatileRes.ok) {
      throw new Error('Failed to fetch volatile markets');
    }

    const volatileData = await volatileRes.json();
    
    // Filter for USDT pairs that are officially in the trading list
    const convincingPairs = volatileData
      .filter((item: any) => {
        const isUsdt = item.symbol.endsWith('USDT');
        const isOfficial = officialSymbols.includes(item.symbol);
        const volume = parseFloat(item.quoteVolume);
        return isUsdt && isOfficial && volume > 50000000;
      })
      .sort((a: any, b: any) => {
        const volA = Math.abs(parseFloat(a.priceChangePercent));
        const volB = Math.abs(parseFloat(b.priceChangePercent));
        return volB - volA;
      });
    
    const finalSelection = convincingPairs.length >= limit 
      ? convincingPairs 
      : volatileData
          .filter((item: any) => item.symbol.endsWith('USDT') && officialSymbols.includes(item.symbol))
          .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));

    return finalSelection.slice(0, limit).map((item: any) => item.symbol.replace('USDT', ''));
  } catch (e) {
    console.error("Error fetching volatile symbols:", e);
    return ['BTC', 'ETH', 'SOL', 'PEPE', 'DOGE', 'XRP', 'ADA'];
  }
};
