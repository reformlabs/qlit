import axios from 'axios';
import NodeCache from 'node-cache';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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

const INSTANCES = [
  'https://lingva.ml',
  'https://translate.igna.wtf',
  'https://translate.plausibility.cloud',
  'https://lingva.lunar.icu',
  'https://translate.projectsegfau.lt',
  'https://translate.dr460nf1r3.org',
  'https://lingva.garudalinux.org',
  'https://translate.jae.fi'
];

export class Qlit {
  private cache: NodeCache;
  private instances: string[];
  private deepLKey: string | undefined;

  constructor(customInstances?: string[]) {
    this.instances = customInstances || INSTANCES;
    this.cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
    this.deepLKey = process.env.DEEPL_API_KEY;
  }

  /**
   * Protects Markdown syntax by replacing it with placeholders.
   */
  private protectMarkdown(text: string): { protectedText: string; map: Record<string, string> } {
    const map: Record<string, string> = {};
    let counter = 0;
    
    // Protect code blocks, bold, italic, links, etc.
    const patterns = [
      /(`{1,3})(.+?)\1/g, // code
      /(\*\*|__)(.+?)\1/g, // bold
      /(\*|_)(.+?)\1/g, // italic
      /\[(.+?)\]\((.+?)\)/g // links
    ];

    let protectedText = text;
    patterns.forEach(pattern => {
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
   * Translates text using DeepL API.
   */
  private async translateDeepL(text: string, to: string): Promise<string> {
    if (!this.deepLKey) throw new Error('No DeepL API key');

    const isFree = this.deepLKey.endsWith(':fx');
    const baseUrl = isFree ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';

    const response = await axios.post(
      baseUrl,
      new URLSearchParams({
        text,
        target_lang: to.toUpperCase(),
        tag_handling: 'xml', // Help preserve some structure
      }).toString(),
      {
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.deepLKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data.translations[0].text;
  }

  /**
   * Translates text between languages with auto-mirror fallback and caching.
   * Prioritizes DeepL if DEEPL_API_KEY is available.
   */
  async translate(text: string, from: string, to: string): Promise<TranslationResponse> {
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
        // Fallback to Lingva if DeepL fails (unless it's an auth error)
        if (err.response?.status === 403) {
           console.error('DeepL Auth Error: Using Lingva fallbacks.');
        }
      }
    }

    // Lingva Fallback / Default
    for (const baseUrl of this.instances) {
      try {
        const url = `${baseUrl.replace(/\/$/, '')}/api/v1/${from}/${to}/${encodeURIComponent(protectedText)}`;
        const response = await axios.get<any>(url, { timeout: 5000 });
        
        let result: TranslationResponse = {
          translation: this.restoreMarkdown(response.data.translation, map),
          engine: 'lingva',
          info: response.data.info
        };
        
        this.cache.set(cacheKey, result);
        return result;
      } catch (error: any) {
        lastError = error;
        if (error.response?.status === 429 || error.response?.status >= 500 || error.code === 'ECONNABORTED') {
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
  async getAudio(lang: string, text: string): Promise<Uint8Array> {
    let lastError: any;
    for (const baseUrl of this.instances) {
      try {
        const url = `${baseUrl.replace(/\/$/, '')}/api/v1/audio/${lang}/${encodeURIComponent(text)}`;
        const response = await axios.get<AudioResponse>(url, { timeout: 5000 });
        return new Uint8Array(response.data.audio);
      } catch (error: any) {
        lastError = error;
        if (error.response?.status === 429 || error.response?.status >= 500 || error.code === 'ECONNABORTED') {
          continue;
        }
        throw error;
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
        const response = await axios.get<{ languages: Language[] }>(url, { timeout: 5000 });
        return response.data.languages;
      } catch (error: any) {
        lastError = error;
        if (error.response?.status === 429 || error.response?.status >= 500 || error.code === 'ECONNABORTED') {
          continue;
        }
        throw error;
      }
    }
    throw lastError || new Error('All mirrors failed');
  }
}

const defaultQlit = new Qlit();

export const translate = (text: string, from: string, to: string) => defaultQlit.translate(text, from, to);
export const getAudio = (lang: string, text: string) => defaultQlit.getAudio(lang, text);
export const getLanguages = (type?: 'source' | 'target') => defaultQlit.getLanguages(type);

export default defaultQlit;
