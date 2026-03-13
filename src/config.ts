import fs from 'fs';
import path from 'path';
import os from 'os';

export interface QlitConfig {
  defaultTargetLang: string;
  cliLang: string;
}

const DEFAULT_CONFIG: QlitConfig = {
  defaultTargetLang: 'tr',
  cliLang: 'en'
};

/**
 * Gets the configuration file path. 
 * Can be overridden by QLIT_CONFIG_PATH environment variable.
 */
export function getConfigPath(): string {
  return process.env.QLIT_CONFIG_PATH || path.join(os.homedir(), '.qlitrc');
}

export function getConfig(): QlitConfig {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

export function setConfig(config: Partial<QlitConfig>): void {
  const configPath = getConfigPath();
  const current = getConfig();
  const updated = { ...current, ...config };
  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2));
}
