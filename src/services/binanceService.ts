
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

export const fetchBinanceTicker = async (symbol: string): Promise<BinanceTicker> => {
  const formattedSymbol = symbol.toUpperCase().replace('/', '');
  const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${formattedSymbol}`);
  if (!response.ok) throw new Error('Failed to fetch ticker from Binance');
  return response.json();
};

export const fetchBinanceKlines = async (symbol: string, interval: string = '1h', limit: number = 24): Promise<BinanceKline[]> => {
  const formattedSymbol = symbol.toUpperCase().replace('/', '');
  const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${formattedSymbol}&interval=${interval}&limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch klines from Binance');
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
