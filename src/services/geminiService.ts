import { GoogleGenAI, Type } from "@google/genai";
import { fetchBinanceTicker, fetchBinanceKlines } from "./binanceService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Simple in-memory cache
const reportCache = new Map<string, { data: MarketReport, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface NewsItem {
  title: string;
  snippet: string;
  url: string;
  source: string;
  date: string;
}

export interface MarketSignal {
  coin: string;
  type: 'LONG' | 'SHORT';
  entry: string;
  tp: string;
  sl: string;
  leverage: string;
  risk: 'low' | 'medium' | 'high';
}

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  volume24h: string;
  ema20: number;
  ema50: number;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  support: string;
  resistance: string;
  trend: 'uptrend' | 'downtrend' | 'sideways';
}

export interface BotAnalysis {
  newsVerdict: string;
  chartVerdict: string;
  combinedVerdict: string;
  confidence: number;
  marketRegime: string;
  riskRewardRatio: string;
}

export interface MarketReport {
  asset: string;
  currentPrice: string;
  change24h: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  summary: string;
  signals: MarketSignal;
  news: NewsItem[];
  chartData: { time: string; price: number }[];
  technicals: TechnicalIndicators;
  botAnalysis: BotAnalysis;
}

export const fetchUnifiedMarketReport = async (asset: string): Promise<MarketReport> => {
  const cacheKey = asset.toLowerCase().trim();
  const cached = reportCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  // Fetch real-time data from Binance for context
  let realTimeContext = "";
  try {
    const ticker = await fetchBinanceTicker(asset);
    const klines = await fetchBinanceKlines(asset);
    realTimeContext = `
DATA REAL-TIME BINANCE (SANGAT PENTING):
- Harga Terakhir: ${ticker.lastPrice}
- Perubahan 24j: ${ticker.priceChangePercent}%
- Volume 24j: ${ticker.volume}
- High/Low 24j: ${ticker.highPrice} / ${ticker.lowPrice}
- Data Chart (24h Terakhir): ${klines.map(k => k.close).join(', ')}
`;
  } catch (e) {
    console.warn("Could not fetch real-time Binance data for context, falling back to search.", e);
  }

  const prompt = `Tugas: Lakukan analisis pasar MULTI-TIMEFRAME (15m, 1h, 4h) yang sangat akurat untuk aset "${asset}" di bursa Binance.

${realTimeContext}

Instruksi Khusus untuk Akurasi Tinggi:
1. Identifikasi simbol ticker Binance yang benar.
2. Gunakan data real-time di atas sebagai basis utama analisis Anda.
3. Analisis Teknikal Mendalam:
   - Hitung RSI (14), MACD (12, 26, 9).
   - Hitung EMA 20 dan EMA 50 untuk deteksi crossover.
   - Analisis Bollinger Bands (20, 2) untuk volatilitas.
   - Tentukan tren pasar (uptrend/downtrend/sideways).
   - Identifikasi level Support & Resistance psikologis dan teknis.
4. Referensi & Konfirmasi (Cross-Reference):
   - Gunakan data dari TradingView, CoinGlass (Liquidations/OI), CryptoQuant/Glassnode (On-chain), dan Santiment/LunarCrush (Social Sentiment) jika tersedia melalui pencarian.
   - Berikan bobot lebih tinggi pada sinyal yang dikonfirmasi oleh data volume dan likuidasi.
5. Sinyal Trading Futures (High Precision):
   - Berikan sinyal LONG/SHORT hanya jika ada konfluensi indikator.
   - Tentukan Entry, TP (3 target), SL, dan Leverage yang disarankan.
   - Hitung Risk/Reward Ratio.
5. Analisis Sentimen Berita: Cari 5 berita terbaru dan tentukan dampaknya terhadap volatilitas.
6. Bot Intelligence (Advanced):
   - marketRegime: Deteksi apakah pasar sedang Trending atau Ranging.
   - newsVerdict: Analisis kualitatif berita.
   - chartVerdict: Analisis pola candlestick dan indikator.
   - combinedVerdict: Logika keputusan akhir bot dengan filter konfluensi.
   - confidence: Skor 0-100 berdasarkan jumlah indikator yang searah.

Output harus dalam format JSON yang valid. Gunakan Bahasa Indonesia untuk teks penjelasan.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview", // Upgraded to Pro for better reasoning
      contents: prompt,
      config: {
        systemInstruction: "Anda adalah sistem trading algoritmik tingkat lanjut yang ahli dalam pasar Binance. Gunakan analisis teknikal multi-timeframe dan analisis sentimen berita untuk memberikan sinyal dengan probabilitas keberhasilan tinggi. Jangan memberikan sinyal jika pasar tidak jelas.",
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            asset: { type: Type.STRING },
            currentPrice: { type: Type.STRING },
            change24h: { type: Type.STRING },
            sentiment: { type: Type.STRING, enum: ["bullish", "bearish", "neutral"] },
            summary: { type: Type.STRING },
            signals: {
              type: Type.OBJECT,
              properties: {
                coin: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["LONG", "SHORT"] },
                entry: { type: Type.STRING },
                tp: { type: Type.STRING },
                sl: { type: Type.STRING },
                leverage: { type: Type.STRING },
                risk: { type: Type.STRING, enum: ["low", "medium", "high"] },
              },
              required: ["coin", "type", "entry", "tp", "sl", "leverage", "risk"]
            },
            news: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  snippet: { type: Type.STRING },
                  url: { type: Type.STRING },
                  source: { type: Type.STRING },
                  date: { type: Type.STRING },
                },
                required: ["title", "snippet", "url", "source", "date"]
              }
            },
            chartData: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  price: { type: Type.NUMBER }
                },
                required: ["time", "price"]
              }
            },
            technicals: {
              type: Type.OBJECT,
              properties: {
                rsi: { type: Type.NUMBER },
                macd: {
                  type: Type.OBJECT,
                  properties: {
                    value: { type: Type.NUMBER },
                    signal: { type: Type.NUMBER },
                    histogram: { type: Type.NUMBER }
                  },
                  required: ["value", "signal", "histogram"]
                },
                volume24h: { type: Type.STRING },
                ema20: { type: Type.NUMBER },
                ema50: { type: Type.NUMBER },
                bollingerBands: {
                  type: Type.OBJECT,
                  properties: {
                    upper: { type: Type.NUMBER },
                    middle: { type: Type.NUMBER },
                    lower: { type: Type.NUMBER }
                  },
                  required: ["upper", "middle", "lower"]
                },
                support: { type: Type.STRING },
                resistance: { type: Type.STRING },
                trend: { type: Type.STRING, enum: ["uptrend", "downtrend", "sideways"] }
              },
              required: ["rsi", "macd", "volume24h", "ema20", "ema50", "bollingerBands", "support", "resistance", "trend"]
            },
            botAnalysis: {
              type: Type.OBJECT,
              properties: {
                newsVerdict: { type: Type.STRING },
                chartVerdict: { type: Type.STRING },
                combinedVerdict: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                marketRegime: { type: Type.STRING },
                riskRewardRatio: { type: Type.STRING }
              },
              required: ["newsVerdict", "chartVerdict", "combinedVerdict", "confidence", "marketRegime", "riskRewardRatio"]
            }
          },
          required: ["asset", "currentPrice", "change24h", "sentiment", "summary", "signals", "news", "chartData", "technicals", "botAnalysis"]
        }
      },
    });

    const data = JSON.parse(response.text || "{}");
    
    // Cache the result
    reportCache.set(cacheKey, { data, timestamp: Date.now() });
    
    return data;
  } catch (e: any) {
    console.error("Error fetching unified report:", e);
    const errorString = typeof e === 'object' ? JSON.stringify(e) : String(e);
    if (errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED')) {
      throw new Error("Kuota API Gemini telah habis (429). Silakan periksa paket dan detail penagihan Anda.");
    }
    throw e;
  }
};
