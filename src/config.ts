import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_PATH = path.join(os.homedir(), '.qlitrc');

export interface Config {
  cliLang: string;
  defaultTargetLang: string;
}

const DEFAULT_CONFIG: Config = {
  cliLang: 'en',
  defaultTargetLang: 'en',
};

export function getConfig(): Config {
  if (!fs.existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }
  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function setConfig(config: Partial<Config>): void {
  const current = getConfig();
  const updated = { ...current, ...config };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
}
