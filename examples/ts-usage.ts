import qlit, { translate, Language } from '../src/index';

async function main() {
  console.log('--- TypeScript Usage Example ---');
  try {
    // Using default export
    const result = await qlit.translate('How are you?', 'en', 'tr');
    console.log('Translation:', result.translation);

    // Using named export
    const langs: Language[] = await qlit.getLanguages();
    console.log('Supported languages:', langs.length);
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

main();
