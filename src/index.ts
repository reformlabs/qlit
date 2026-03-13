import fetch from 'node-fetch';
import NodeCache from 'node-cache';

// Load environment variables optionally
try {
  // Use a dynamic check to load dotenv only if present
  const dotenv = require('dotenv');
  dotenv.config();
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
   * Translates text using DeepL API with node-fetch.
   */
  private async translateDeepL(text: string, to: string): Promise<string> {
    if (!this.deepLKey) throw new Error('No DeepL API key');

    const isFree = this.deepLKey.endsWith(':fx');
    const baseUrl = isFree ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';

    const params = new URLSearchParams();
    params.append('text', text);
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
    return data.translations[0].text;
  }

  /**
   * Translates text between languages with auto-mirror fallback and caching.
   * Prioritizes DeepL if DEEPL_API_KEY is available.
   */
  async translate(text: string, from: string | LanguageCode, to: string | LanguageCode): Promise<TranslationResponse> {
    const cacheKey = `${from}:${to}:${text}`;
    const cached = this.cache.get<TranslationResponse>(cacheKey);
    if (cached) return cached;

    const { protectedText, map } = this.protectMarkdown(text);
    let lastError: any;

    // Try DeepL if key exists
    if (this.deepLKey) {
      try {
        const translation = await this.translateDeepL(protectedText, to);
        const result: TranslationResponse = {
          translation: this.restoreMarkdown(translation, map),
          engine: 'deepl'
        };
        this.cache.set(cacheKey, result);
        return result;
      } catch (err: any) {
        lastError = err;
        if (err.message?.includes('403')) {
           console.error('DeepL Auth Error: Using Lingva fallbacks.');
        }
      }
    }

    // Lingva Fallback / Default
    for (const baseUrl of this.instances) {
      try {
        const url = `${baseUrl.replace(/\/$/, '')}/api/v1/${from}/${to}/${encodeURIComponent(protectedText)}`;
        const response = await fetch(url, { timeout: 5000 });
        
        if (!response.ok) {
          if (response.status === 429 || response.status >= 500) continue;
          throw new Error(`Lingva Error: ${response.statusText}`);
        }

        const data: any = await response.json();
        let result: TranslationResponse = {
          translation: this.restoreMarkdown(data.translation, map),
          engine: 'lingva',
          info: data.info
        };
        
        this.cache.set(cacheKey, result);
        return result;
      } catch (error: any) {
        lastError = error;
        if (error.name === 'FetchError' || error.code === 'ECONNABORTED') {
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('All mirrors failed');
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
