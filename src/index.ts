import fetch from 'node-fetch';
import NodeCache from 'node-cache';

// Load environment variables optionally
try {
  // Use a dynamic check to load dotenv only if present
  const dotenv = require('dotenv');
  // Some versions of dotenv or its wrappers are noisy, silence them
  const originalLog = console.log;
  console.log = () => {}; 
  dotenv.config();
  console.log = originalLog;
} catch (e) {
  // dotenv not found or failed, which is fine for production
}

/**
 * Supported Language Codes for Lingva
 */
export enum LanguageCode {
  AUTO = 'auto',
  ENGLISH = 'en',
  TURKISH = 'tr',
  GERMAN = 'de',
  FRENCH = 'fr',
  SPANISH = 'es',
  ITALIAN = 'it',
  PORTUGUESE = 'pt',
  RUSSIAN = 'ru',
  CHINESE_SIMPLIFIED = 'zh',
  CHINESE_TRADITIONAL = 'zh-TW',
  JAPANESE = 'ja',
  KOREAN = 'ko',
  ARABIC = 'ar',
  DUTCH = 'nl',
  POLISH = 'pl',
  UKRAINIAN = 'uk',
  GREEK = 'el',
  HINDI = 'hi',
  VIETNAMESE = 'vi',
  INDONESIAN = 'id',
  THAI = 'th',
  AZERBAIJANI = 'az',
  // ... can be expanded
}

export interface Language {
  code: string;
  name: string;
}

export interface TranslationInfo {
  pronunciation?: string;
  definitions?: any[];
  examples?: string[];
  similar?: string[];
  extraTranslations?: any[];
}

export interface TranslationResponse {
  translation: string;
  engine: 'lingva' | 'deepl';
  info?: TranslationInfo;
}

export interface AudioResponse {
  audio: number[];
}

export interface QlitOptions {
  instances?: string[];
  deepLKey?: string;
  cacheTTL?: number;
  protectedRegexes?: RegExp[];
}

const DEFAULT_INSTANCES = [
  'https://lingva.ml',
  'https://translate.igna.wtf',
  'https://translate.plausibility.cloud',
  'https://lingva.lunar.icu',
  'https://translate.projectsegfau.lt',
  'https://translate.dr460nf1r3.org',
  'https://lingva.garudalinux.org',
  'https://translate.jae.fi'
];

const DEFAULT_PROTECTED_Patterns = [
  /(`{1,3})(.+?)\1/g, // code
  /(\*\*|__)(.+?)\1/g, // bold
  /(\*|_)(.+?)\1/g, // italic
  /\[(.+?)\]\((.+?)\)/g // links
];

export class Qlit {
  private cache: NodeCache;
  private instances: string[];
  private deepLKey: string | undefined;
  private protectedRegexes: RegExp[];

  constructor(options: QlitOptions = {}) {
    this.instances = options.instances || DEFAULT_INSTANCES;
    this.cache = new NodeCache({ 
      stdTTL: options.cacheTTL || 300, 
      checkperiod: 60 
    });
    this.deepLKey = options.deepLKey || process.env.DEEPL_API_KEY;
    this.protectedRegexes = options.protectedRegexes || DEFAULT_PROTECTED_Patterns;
  }

  /**
   * Updates Markdown protection regexes.
   */
  public setProtectedRegexes(regexes: RegExp[]) {
    this.protectedRegexes = regexes;
  }

  /**
   * Protects Markdown syntax by replacing it with placeholders.
   */
  private protectMarkdown(text: string): { protectedText: string; map: Record<string, string> } {
    const map: Record<string, string> = {};
    let counter = 0;
    
    let protectedText = text;
    this.protectedRegexes.forEach(pattern => {
      protectedText = protectedText.replace(pattern, (match) => {
        const placeholder = `[[PROTECTED_${counter}]]`;
        map[placeholder] = match;
        counter++;
        return placeholder;
      });
    });

    return { protectedText, map };
  }

  /**
   * Restores Markdown syntax from placeholders.
   */
  private restoreMarkdown(text: string, map: Record<string, string>): string {
    let restoredText = text;
    Object.entries(map).forEach(([placeholder, original]) => {
      restoredText = restoredText.replace(placeholder, original);
    });
    return restoredText;
  }

  /**
   * Translates multiple strings using DeepL API in a single request (batching).
   */
  private async translateDeepLBatch(texts: string[], to: string): Promise<string[]> {
    if (!this.deepLKey) throw new Error('No DeepL API key');

    const isFree = this.deepLKey.endsWith(':fx');
    const baseUrl = isFree ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';

    const params = new URLSearchParams();
    texts.forEach(text => params.append('text', text));
    params.append('target_lang', to.toUpperCase());
    params.append('tag_handling', 'xml');

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${this.deepLKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error(`DeepL API Error: ${response.statusText}`);
    }

    const data: any = await response.json();
    return data.translations.map((t: any) => t.text);
  }

  /**
   * Translates text between languages with auto-mirror fallback and caching.
   * Prioritizes DeepL if DEEPL_API_KEY is available.
   */
  async translate(text: string, from: string | LanguageCode, to: string | LanguageCode): Promise<TranslationResponse> {
    const batchResults = await this.translateBatch([text], from, to);
    return batchResults[0];
  }

  /**
   * Translates multiple texts in high-performance mode.
   * Uses DeepL batching and Lingva parallel fetching.
   */
  async translateBatch(texts: string[], from: string | LanguageCode, to: string | LanguageCode, concurrency = 10): Promise<TranslationResponse[]> {
    if (texts.length === 0) return [];

    const results: TranslationResponse[] = new Array(texts.length);
    const indicesToTranslate: number[] = [];
    const protectedData: { protectedText: string, map: Record<string, string> }[] = [];

    // 1. Check Cache, Deduplicate & Protect Markdown
    const uniqueStringsToTranslate = new Map<string, { protectedText: string, map: Record<string, string>, indices: number[] }>();

    texts.forEach((text, i) => {
      const cacheKey = `${from}:${to}:${text}`;
      const cached = this.cache.get<TranslationResponse>(cacheKey);
      
      if (cached) {
        results[i] = cached;
      } else {
        if (uniqueStringsToTranslate.has(text)) {
          uniqueStringsToTranslate.get(text)!.indices.push(i);
        } else {
          uniqueStringsToTranslate.set(text, {
            ...this.protectMarkdown(text),
            indices: [i]
          });
        }
      }
    });

    if (uniqueStringsToTranslate.size === 0) return results;

    const uniqueTextsData = Array.from(uniqueStringsToTranslate.entries());
    const textsToTranslate = uniqueTextsData.map(([_, d]) => d.protectedText);

    // 2. Try DeepL Batch if key exists
    if (this.deepLKey) {
      try {
        const batchSize = 50;
        for (let i = 0; i < textsToTranslate.length; i += batchSize) {
          const chunk = textsToTranslate.slice(i, i + batchSize);
          const chunkData = uniqueTextsData.slice(i, i + batchSize);
          const translations = await this.translateDeepLBatch(chunk, to);
          
          translations.forEach((trans, chunkIdx) => {
            const originalData = chunkData[chunkIdx][1];
            const originalText = chunkData[chunkIdx][0];
            const finalTranslation = this.restoreMarkdown(trans, originalData.map);
            
            const res: TranslationResponse = { translation: finalTranslation, engine: 'deepl' };
            
            // Apply to all indices that had this text
            originalData.indices.forEach(idx => {
              results[idx] = res;
            });
            this.cache.set(`${from}:${to}:${originalText}`, res);
          });
        }
        return results;
      } catch (err: any) {
        if (err.message?.includes('403')) {
          console.error('DeepL Auth Error: Using Lingva fallbacks.');
        } else {
          console.warn('DeepL Batch failed, falling back to Lingva:', err.message);
        }
      }
    }

    // 3. Lingva Fallback with Parallel Concurrency & Mirror Rotation
    const processInstance = async (idxInUnique: number): Promise<TranslationResponse> => {
      const entry = uniqueTextsData[idxInUnique];
      const originalText = entry[0];
      const protectedText = entry[1].protectedText;
      const pMap = entry[1].map;

      let lastError: any;
      const startMirrorIdx = Math.floor(Math.random() * this.instances.length);
      
      for (let i = 0; i < this.instances.length; i++) {
        const baseUrl = this.instances[(startMirrorIdx + i) % this.instances.length];
        try {
          const url = `${baseUrl.replace(/\/$/, '')}/api/v1/${from}/${to}/${encodeURIComponent(protectedText)}`;
          const response = await fetch(url, { timeout: 4000 }); // Faster 4s timeout for better failover in batches
          
          if (!response.ok) {
            if (response.status === 429 || response.status >= 500) continue;
            throw new Error(`Lingva Error: ${response.statusText}`);
          }

          const data: any = await response.json();
          const res: TranslationResponse = {
            translation: this.restoreMarkdown(data.translation, pMap),
            engine: 'lingva',
            info: data.info
          };
          this.cache.set(`${from}:${to}:${originalText}`, res);
          return res;
        } catch (error: any) {
          lastError = error;
          continue;
        }
      }
      throw lastError || new Error('All mirrors failed');
    };

    // Worker Pool Parallelization (Sliding Window)
    const queue = Array.from({ length: uniqueTextsData.length }, (_, k) => k);
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const itemIdx = queue.shift();
        if (itemIdx === undefined) break;
        try {
          const result = await processInstance(itemIdx);
          const originalData = uniqueTextsData[itemIdx][1];
          originalData.indices.forEach(idx => {
            results[idx] = result;
          });
        } catch (e: any) {
          const originalData = uniqueTextsData[itemIdx][1];
          const originalText = uniqueTextsData[itemIdx][0];
          originalData.indices.forEach(idx => {
            results[idx] = { translation: originalText, engine: 'lingva' };
          });
        }
      }
    });

    await Promise.all(workers);
    return results;
  }

  /**
   * Gets the audio for a given text in a specific language.
   */
  async getAudio(lang: string | LanguageCode, text: string): Promise<Uint8Array> {
    let lastError: any;
    for (const baseUrl of this.instances) {
      try {
        const url = `${baseUrl.replace(/\/$/, '')}/api/v1/audio/${lang}/${encodeURIComponent(text)}`;
        const response = await fetch(url, { timeout: 5000 });
        
        if (!response.ok) {
          if (response.status === 429 || response.status >= 500) continue;
          throw new Error(`Audio Error: ${response.statusText}`);
        }

        const data: any = await response.json();
        return new Uint8Array(data.audio);
      } catch (error: any) {
        lastError = error;
        continue;
      }
    }
    throw lastError || new Error('All mirrors failed');
  }

  /**
   * Lists supported languages.
   */
  async getLanguages(type?: 'source' | 'target'): Promise<Language[]> {
    let lastError: any;
    for (const baseUrl of this.instances) {
      try {
        let url = `${baseUrl.replace(/\/$/, '')}/api/v1/languages`;
        if (type) url += `?type=${type}`;
        
        const response = await fetch(url, { timeout: 5000 });
        if (!response.ok) continue;

        const data: any = await response.json();
        return data.languages;
      } catch (error: any) {
        lastError = error;
        continue;
      }
    }
    throw lastError || new Error('All mirrors failed');
  }
}

const defaultQlit = new Qlit();

export const translate = (text: string, from: string | LanguageCode, to: string | LanguageCode) => defaultQlit.translate(text, from, to);
export const getAudio = (lang: string | LanguageCode, text: string) => defaultQlit.getAudio(lang, text);
export const getLanguages = (type?: 'source' | 'target') => defaultQlit.getLanguages(type);

export default defaultQlit;
