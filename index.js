const axios = require('axios');

const API_URL = 'https://translate.argosopentech.com';

/**
 * Translates text between specified languages using LibreTranslate API.
 * @param {string} text - Text to be translated
 * @param {string} from - Source language code (or 'auto')
 * @param {string} to - Target language code
 * @returns {Promise<string>} - Translated text
 */
async function translate(text, from = 'auto', to = 'en') {
  if (!text) throw new Error('Text to translate is required.');
  if (!to) throw new Error('Target language code is required.');
  const res = await axios.post(`${API_URL}/translate`, {
    q: text,
    source: from,
    target: to,
    format: 'text'
  }, {
    headers: { 'Content-Type': 'application/json' }
  });
  return res.data.translatedText;
}

/**
 * Returns the supported languages from LibreTranslate.
 * @returns {Promise<Array<{code: string, name: string}>>}
 */
async function getSupportedLanguages() {
  const res = await axios.get(`${API_URL}/languages`);
  return res.data;
}

module.exports = {
  translate,
  getSupportedLanguages
};