#!/usr/bin/env node
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import clipboardy from 'clipboardy';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import fg from 'fast-glob';
import qlit, { getLanguages } from './index';
import { getConfig, setConfig } from './config';

const program = new Command();
const config = getConfig();

// Load package.json metadata
let pkg: any = { version: '2.5.0', description: '' };
try {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  if (fs.existsSync(pkgPath)) {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  }
} catch (e) { }

// Localization Loader
function loadTranslations(lang: string) {
  const possiblePaths = [
    path.join(__dirname, 'locales', `${lang}.json`),
    path.join(__dirname, '..', 'src', 'locales', `${lang}.json`),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        return JSON.parse(content).translation;
      } catch (e) { }
    }
  }
  // Fallback to default if not found
  return null;
}

const cliLang = config.cliLang || 'en';
const t = loadTranslations(cliLang) || loadTranslations('en') || {};

program
  .name(pkg.name || 'qlit')
  .description(t.description || pkg.description)
  .version(pkg.version);

// Global Options
program
  .option('-c, --copy', 'Copy result(s) to clipboard')
  .option('-j, --json', 'Output full JSON response')
  .option('-f, --file <path>', 'Translate a file content')
  .option('--folder <path>', t.folderDesc)
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

    if (options.folder) {
      await translateFolder(options.folder, finalLangs);
      return;
    }

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

    if (options.folder) {
      await translateFolder(options.folder, [config.defaultTargetLang]);
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
      const result = await qlit.translate(text, from, to);
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
        const result = await qlit.translate(line, 'auto', to);
        translatedLines.push(result.translation);
      }

      const ext = path.extname(filePath);
      const base = path.basename(filePath, ext);
      const newPath = path.join(path.dirname(filePath), `${base}_${to}${ext}`);

      fs.writeFileSync(newPath, translatedLines.join('\n'));
      spinner.succeed(`${t.done} [${to}]`);
      console.log(`${chalk.green('✔')} ${t.fileSaved} ${chalk.cyan(newPath)}`);
    } catch (error: any) {
      if (spinner) spinner.fail(`${t.errorPrefix} [${to}] ${error.message}`);
    }
  }
}

async function translateFolder(folderPath: string, toLangs: string[]) {
  if (!fs.existsSync(folderPath) || !fs.lstatSync(folderPath).isDirectory()) {
    console.error(chalk.red(`${t.errorPrefix} Folder not found: ${folderPath}`));
    return;
  }

  const entries = await fg(['**/*'], { cwd: folderPath, absolute: true, onlyFiles: true });

  for (const entry of entries) {
    // Skip already translated files or non-text files based on some logic if needed
    // For now, translate all
    console.log(`${chalk.blue('Processing:')} ${path.basename(entry)}`);
    await translateFile(entry, toLangs);
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
        const res = await qlit.translate(obj, 'auto', to);
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
    if (spinner) spinner.fail(`${t.errorPrefix} [${to}] ${error.message}`);
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
