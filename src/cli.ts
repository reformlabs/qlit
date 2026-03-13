#!/usr/bin/env node
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import clipboardy from 'clipboardy';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { translate, getLanguages } from './index';
import { getConfig, setConfig } from './config';

const program = new Command();
const config = getConfig();

const translations: Record<string, any> = {
  en: {
    description: 'Translate text instantly from the terminal',
    argText: 'Text to translate',
    setLangDesc: 'Set default translation language and CLI language',
    listDesc: 'List all supported languages',
    toDesc: 'Translate to specific language(s) (comma separated for multiple)',
    toArgLang: 'Language code(s) (e.g., tr or en,de,fr)',
    toArgText: 'Text to translate',
    errorNoText: 'Error: You must enter text to translate.',
    errorPrefix: 'Error:',
    configUpdated: 'Default language updated to:',
    translating: 'Translating...',
    fetchingLangs: 'Fetching languages...',
    done: 'Done!',
    copied: 'Result copied to clipboard!',
    outputLabel: 'Output',
    langsTitle: 'Supported Languages:',
    interactiveTitle: 'Qlit Interactive Mode (Type "exit" to quit)',
    interactivePrompt: '> ',
    fileSaved: 'File saved:',
    engineLabel: 'Engine',
    i18nDesc: 'Translate JSON/YAML localization files',
    i18nArgFile: 'JSON file to translate',
  },
  tr: {
    description: 'Terminalden hemen çeviri yapın',
    argText: 'Çevrilecek metin',
    setLangDesc: 'Varsayılan çeviri dilini ve CLI dilini ayarlar',
    listDesc: 'Desteklenen tüm dilleri listeler',
    toDesc: 'Belirli dil(ler)e çeviri yapar (virgül ile ayırarak çoklu hedef seçilebilir)',
    toArgLang: 'Dil kod(lar)ı (örn: tr veya en,de,fr)',
    toArgText: 'Çevrilecek metin',
    errorNoText: 'Hata: Çevrilecek metin girmelisiniz.',
    errorPrefix: 'Hata:',
    configUpdated: 'Varsayılan dil güncellendi:',
    translating: 'Çevriliyor...',
    fetchingLangs: 'Diller çekiliyor...',
    done: 'Tamamlandı!',
    copied: 'Sonuç panoya kopyalandı!',
    outputLabel: 'Sonuç',
    langsTitle: 'Desteklenen Diller:',
    interactiveTitle: 'Qlit İnteraktif Mod (Çıkmak için "exit" yazın)',
    interactivePrompt: '> ',
    fileSaved: 'Dosya kaydedildi:',
    engineLabel: 'Motor',
    i18nDesc: 'JSON/YAML yerelleştirme dosyalarını çevirir',
    i18nArgFile: 'Çevrilecek JSON dosyası',
  }
};

const cliLang = config.cliLang || 'en';
const t = translations[cliLang] || translations.en;

program
  .name('qlit')
  .description(t.description)
  .version('2.0.0');

// Global Options
program
  .option('-c, --copy', 'Copy result(s) to clipboard')
  .option('-j, --json', 'Output full JSON response')
  .option('-f, --file <path>', 'Translate a file content')
  .option('-i, --interactive', 'Start interactive mode');

// qlit to <lang> [text]
program
  .command('to')
  .description(t.toDesc)
  .argument('<lang>', t.toArgLang)
  .argument('[text]', t.toArgText)
  .action(async (langsStr, text, _, cmd) => {
    const options = program.opts();
    const finalLangs = langsStr.split(',');
    
    if (options.file) {
      await translateFile(options.file, finalLangs);
      return;
    }

    const inputText = text || (await readFromStdin());
    if (!inputText) {
      console.error(chalk.red(t.errorNoText));
      process.exit(1);
    }

    await performMultiTranslation(inputText, 'auto', finalLangs, options.copy, options.json);
  });

// qlit i18n <file> --to <lang>
program
  .command('i18n')
  .description(t.i18nDesc)
  .argument('<file>', t.i18nArgFile)
  .requiredOption('--to <lang>', 'Target language')
  .action(async (file, options) => {
    await translateI18n(file, options.to);
  });

// qlit list
program
  .command('list')
  .description(t.listDesc)
  .action(async () => {
    const spinner = ora(t.fetchingLangs).start();
    try {
      const langs = await getLanguages();
      spinner.stop();
      console.log(chalk.bold.cyan(t.langsTitle));
      langs.forEach(l => console.log(`${chalk.yellow(l.code)}: ${l.name}`));
    } catch (err: any) {
      spinner.fail(`${t.errorPrefix} ${err.message}`);
    }
  });

// qlit config <lang>
program
  .command('config')
  .description(t.setLangDesc)
  .argument('<lang>', 'Language code')
  .action((lang) => {
    setConfig({ cliLang: lang, defaultTargetLang: lang });
    console.log(`${chalk.green('✔')} ${t.configUpdated} ${chalk.cyan(lang)}`);
  });

// qlit [text] (Default Action)
program
  .argument('[text]', t.argText)
  .action(async (text) => {
    const options = program.opts();

    if (options.interactive) {
      startInteractiveMode();
      return;
    }

    if (options.file) {
      await translateFile(options.file, [config.defaultTargetLang]);
      return;
    }

    const inputText = text || (await readFromStdin());
    
    // If no text, no pipe, and no other flag, show help
    if (!inputText && process.stdin.isTTY) {
      program.help();
      return;
    }

    if (!inputText) {
       console.error(chalk.red(t.errorNoText));
       process.exit(1);
    }

    await performMultiTranslation(inputText, 'auto', [config.defaultTargetLang], options.copy, options.json);
  });

async function readFromStdin(): Promise<string | null> {
  if (process.stdin.isTTY) return null;
  
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });
    process.stdin.on('end', () => {
      resolve(data.trim());
    });
  });
}

async function performMultiTranslation(text: string, from: string, toLangs: string[], copy?: boolean, jsonMode?: boolean) {
  const translations_results: any[] = [];
  
  for (const to of toLangs) {
    const spinner = !jsonMode ? ora(`${t.translating} [${to}]`).start() : null;
    try {
      const result = await translate(text, from, to);
      const engineColor = result.engine === 'deepl' ? chalk.magenta : chalk.blue;
      const engineTag = ` [${engineColor(result.engine.toUpperCase())}]`;

      if (spinner) spinner.succeed(`${t.done} [${to}]${engineTag}`);
      
      if (jsonMode) {
        translations_results.push({ lang: to, ...result });
      } else {
        console.log(`${chalk.green('✔')} ${chalk.bold(`${t.outputLabel} [${to}]:`)} ${chalk.green(result.translation)}`);
      }

      if (copy && toLangs.length === 1) {
        clipboardy.writeSync(result.translation);
        if (!jsonMode) console.log(`${chalk.blue('ℹ')} ${t.copied}`);
      }
    } catch (error: any) {
      if (spinner) spinner.fail(`${t.errorPrefix} [${to}] ${error.message}`);
      if (jsonMode) translations_results.push({ lang: to, error: error.message });
    }
  }

  if (jsonMode) {
    console.log(JSON.stringify(toLangs.length === 1 ? translations_results[0] : translations_results, null, 2));
  }
}

async function translateFile(filePath: string, toLangs: string[]) {
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`${t.errorPrefix} File not found: ${filePath}`));
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  for (const to of toLangs) {
    const spinner = ora(`${t.translating} file to [${to}]...`).start();
    try {
      const translatedLines = [];
      for (const line of lines) {
        if (line.trim() === '') {
          translatedLines.push('');
          continue;
        }
        const result = await translate(line, 'auto', to);
        translatedLines.push(result.translation);
      }
      
      const ext = path.extname(filePath);
      const base = path.basename(filePath, ext);
      const newPath = path.join(path.dirname(filePath), `${base}_${to}${ext}`);
      
      fs.writeFileSync(newPath, translatedLines.join('\n'));
      spinner.succeed(`${t.done} [${to}]`);
      console.log(`${chalk.green('✔')} ${t.fileSaved} ${chalk.cyan(newPath)}`);
    } catch (error: any) {
      spinner.fail(`${t.errorPrefix} [${to}] ${error.message}`);
    }
  }
}

async function translateI18n(filePath: string, to: string) {
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`${t.errorPrefix} File not found: ${filePath}`));
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let data: any;
  try {
    data = JSON.parse(content);
  } catch (e) {
    console.error(chalk.red(`${t.errorPrefix} Invalid JSON file.`));
    return;
  }

  const spinner = ora(`${t.translating} i18n file to [${to}]...`).start();
  try {
    const translateDeep = async (obj: any): Promise<any> => {
      if (typeof obj === 'string') {
        const res = await translate(obj, 'auto', to);
        return res.translation;
      } else if (Array.isArray(obj)) {
        return Promise.all(obj.map(item => translateDeep(item)));
      } else if (typeof obj === 'object' && obj !== null) {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = await translateDeep(value);
        }
        return result;
      }
      return obj;
    };

    const translatedData = await translateDeep(data);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const newPath = path.join(path.dirname(filePath), `${base}.${to}${ext}`);

    fs.writeFileSync(newPath, JSON.stringify(translatedData, null, 2));
    spinner.succeed(`${t.done} [${to}]`);
    console.log(`${chalk.green('✔')} ${t.fileSaved} ${chalk.cyan(newPath)}`);
  } catch (error: any) {
    spinner.fail(`${t.errorPrefix} [${to}] ${error.message}`);
  }
}

function startInteractiveMode() {
  console.log(chalk.bold.magenta(t.interactiveTitle));
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: t.interactivePrompt
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      rl.close();
      return;
    }

    if (input) {
      await performMultiTranslation(input, 'auto', [config.defaultTargetLang]);
    }
    rl.prompt();
  }).on('close', () => {
    process.exit(0);
  });
}

program.parse();
