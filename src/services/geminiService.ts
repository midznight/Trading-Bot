import { GoogleGenAI, Type } from "@google/genai";
import { fetchBinanceTicker, fetchBinanceKlines } from "./binanceService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Simple in-memory cache
const reportCache = new Map<string, { data: MarketReport, timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
  confidence: number;
  timestamp?: string;
  currentPrice?: string;
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
  fibonacci: {
    '0.236': number;
    '0.382': number;
    '0.5': number;
    '0.618': number;
    '0.786': number;
  };
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

export const fetchUnifiedMarketReport = async (asset: string, retryCount = 0): Promise<MarketReport> => {
  const cacheKey = asset.toLowerCase().trim();
  const cached = reportCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  // Current WIB Time (UTC+7)
  const now = new Date();
  const wibTime = new Date(now.getTime() + (7 * 3600000)).toISOString().replace('T', ' ').substring(0, 19);

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

  const prompt = `Tugas: Lakukan analisis pasar SCALPING MULTI-TIMEFRAME (1m, 5m, 15m) yang sangat akurat untuk aset "${asset}" di bursa Binance Futures.
Waktu Sekarang (WIB): ${wibTime}

${realTimeContext}

Instruksi Khusus untuk Strategi Scalping Cerdas (Profit Maksimal & Aman):
1. Fokus pada timeframe rendah (1m, 5m) untuk mencari entri presisi.
2. Gunakan data real-time di atas sebagai basis utama analisis Anda.
3. Analisis Teknikal Mendalam:
   - Identifikasi momentum jangka pendek menggunakan RSI (14) dan MACD.
   - Gunakan EMA 9 dan EMA 21 untuk deteksi tren mikro (Scalping Crossover).
   - Analisis Bollinger Bands untuk mencari titik jenuh (Overbought/Oversold).
   - Tentukan level Support & Resistance intraday yang sangat ketat.
4. Strategi Profit Konsisten (Net Profit Focus):
   - Berikan sinyal LONG/SHORT dengan target profit yang sudah memperhitungkan Trading Fee (estimasi 0.1% round-trip).
   - Target Profit 1 (Scalp): 0.5% - 1.0% (Quick Exit).
   - Target Profit 2 (Momentum): 1.5% - 3.0% (Hold jika momentum kuat).
   - Stop Loss harus sangat ketat (maksimal 1% dari entry) untuk menjaga modal.
5. Bot Intelligence (Advanced):
   - marketRegime: Deteksi volatilitas mikro (Trending vs Sideways).
   - combinedVerdict: Logika keputusan scalping dengan filter volume.
   - confidence: Skor 0-100 (Hanya berikan sinyal jika > 85).
   - riskRewardRatio: Hitung rasio profit vs resiko secara matematis.

PENTING: Hanya gunakan koin yang benar-benar ada di Binance Futures. Jangan berhalusinasi koin yang tidak ada.
Output harus dalam format JSON yang valid. Gunakan Bahasa Indonesia untuk teks penjelasan.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: prompt,
      config: {
        systemInstruction: "Anda adalah sistem trading scalping tingkat lanjut 'SCALPER TERMINAL v6.0' yang ahli dalam pasar Binance Futures. Tugas Anda adalah menghasilkan keuntungan NETT yang konsisten (setelah dipotong fee). Berikan sinyal dengan TP 1 (Scalp) dan TP 2 (Momentum). Fokus pada akurasi tinggi, manajemen risiko disiplin, dan hindari fatal loss dengan Stop Loss yang sangat ketat.",
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
                trend: { type: Type.STRING, enum: ["uptrend", "downtrend", "sideways"] },
                fibonacci: {
                  type: Type.OBJECT,
                  properties: {
                    "0.236": { type: Type.NUMBER },
                    "0.382": { type: Type.NUMBER },
                    "0.5": { type: Type.NUMBER },
                    "0.618": { type: Type.NUMBER },
                    "0.786": { type: Type.NUMBER }
                  },
                  required: ["0.236", "0.382", "0.5", "0.618", "0.786"]
                }
              },
              required: ["rsi", "macd", "volume24h", "ema20", "ema50", "bollingerBands", "support", "resistance", "trend", "fibonacci"]
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
      if (retryCount < MAX_RETRIES) {
        const backoffTime = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s
        console.warn(`Rate limit hit. Retrying in ${backoffTime}ms... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await sleep(backoffTime);
        return fetchUnifiedMarketReport(asset, retryCount + 1);
      }
      throw new Error("Kuota API Gemini telah habis (429). Silakan tunggu beberapa saat atau periksa paket penagihan Anda.");
    }
    throw e;
  }
};

export const fetchTopSignals = async (assets: string[]): Promise<MarketSignal[]> => {
  // Current WIB Time (UTC+7)
  const now = new Date();
  const wibTime = new Date(now.getTime() + (7 * 3600000)).toISOString().replace('T', ' ').substring(0, 19);

  // Fetch real-time data for context
  let realTimeContext = "DATA REAL-TIME BINANCE TERBARU:\n";
  try {
    const tickers = await Promise.all(assets.map(async (asset) => {
      try {
        const t = await fetchBinanceTicker(asset);
        return `${asset}: Price ${t.lastPrice}, Change ${t.priceChangePercent}%`;
      } catch (e) {
        return `${asset}: Data tidak tersedia`;
      }
    }));
    realTimeContext += tickers.join('\n');
  } catch (e) {
    console.warn("Could not fetch real-time data for signals context", e);
  }

  const prompt = `Tugas: Cari peluang SCALPING CERDAS (Profit Cepat & Konsisten) dari daftar koin Binance Futures berikut: ${assets.join(', ')}.
  Waktu Sekarang (WIB): ${wibTime}
  
  ${realTimeContext}
  
  Analisis setiap koin untuk strategi SCALPING (Timeframe 1m-5m).
  Berikan sinyal hanya jika ada konfirmasi momentum yang kuat dan potensi NETT PROFIT positif setelah fee.
  Untuk setiap sinyal, berikan:
  1. Tipe Sinyal (LONG/SHORT)
  2. Harga Entry yang sangat presisi
  3. Target Take Profit (TP) Scalping (0.5% - 1.5% dari entry)
  4. Stop Loss (SL) yang sangat ketat (maksimal 1% dari entry)
  5. Leverage yang disarankan (10x - 50x).
  6. Confidence (0-100) - Berikan nilai > 85 jika sinyal sangat meyakinkan.
  
  PENTING: Hanya gunakan koin yang benar-benar terdaftar di Binance Futures.
  Output harus dalam format JSON array of objects.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "Anda adalah 'Scalp Signal Master v6.0'. Fokus Anda adalah mencari keuntungan NETT yang konsisten di pasar Binance Futures. Gunakan timeframe rendah dan indikator momentum untuk memberikan sinyal dengan TP 0.5-1.5% dan SL ketat. Pastikan sinyal memiliki probabilitas tinggi untuk menutupi trading fee dan memberikan profit bersih.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              coin: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["LONG", "SHORT"] },
              entry: { type: Type.STRING },
              tp: { type: Type.STRING },
              sl: { type: Type.STRING },
              leverage: { type: Type.STRING },
              risk: { type: Type.STRING, enum: ["low", "medium", "high"] },
              confidence: { type: Type.NUMBER },
              timestamp: { type: Type.STRING },
            },
            required: ["coin", "type", "entry", "tp", "sl", "leverage", "risk", "confidence", "timestamp"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Error fetching top signals:", e);
    return [];
  }
};
