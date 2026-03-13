const qlit = require('../dist/index');

async function main() {
  console.log('--- JavaScript Usage Example ---');
  try {
    // Using default export
    const result = await qlit.translate('Hello', 'en', 'tr');
    console.log('Translation:', result.translation);

    // Using named export
    const { translate } = qlit;
    const result2 = await translate('World', 'en', 'tr');
    console.log('Translation 2:', result2.translation);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
