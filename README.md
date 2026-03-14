<div style="text-align: center;">
  <img src="https://raw.githubusercontent.com/reformlabs/.github/addbf9601ac994c6a7d2fa8aa7fd9b758c070f86/reformlabs%20loading.svg" width="1096" height="496" />
</div>

# Qlit by Reform Labs (@reformlabs/qlit)

High-performance CLI translator and i18n automation tool with DeepL integration, parallel processing, and auto-generated localization.

> [!IMPORTANT]
> This project is developed by **Reform Labs**. Users are free to use the system and contribute, but they may not redistribute it by claiming ownership as if it were their own project.

## Features ⚡

* **Turbo Parallel Engine**: Translates up to **30+ strings concurrently** using a high-performance worker pool (sliding window).
* **Mirror Rotation (v3.0.0)**: Automatically rotates between **14+ global mirrors** to bypass rate limits and ensure maximum uptime.
* **DeepL Native Batching**: Sends up to 50 strings in a single request for lightning-fast DeepL translations.
* **Intelligent Deduplication**: Automatically detects identical strings in bulk tasks (like i18n JSONs) and translates them only once.
* **Auto-i18n Generator (Scanner)**: Scans your source code (`.js`, `.ts`, `.py`, `.html`, etc.) for hardcoded strings and generates a translated JSON file instantly.
* **Smart Filtering**: Automatically ignores `node_modules`, `dist`, and system files during scanning.
* **Markdown Preservation**: Fully preserves **bold**, *italic*, `code`, and [links] during translation.
* **Clean & Professional**: 100% silenced third-party module logs and a premium CLI experience with Ora spinners and Chalk colors.

## Installation

```bash
npm install -g @reformlabs/qlit
```

## CLI Usage

### Basic Commands

* **Quick Translation**: `qlit <text>`
  Instantly translates to the default language.
  *Example:* `qlit "Hello"`

* **Targeted & Multi Translation**: `qlit to <language(s)> <text>`
  Translates into a specific language or multiple languages separated by commas.
  *Example:* `qlit to tr,de "Hello"`

* **i18n Automation**: `qlit i18n <file> --to <language>`
  Translates JSON localization files without breaking their keys.
  *Example:* `qlit i18n tr.json --to en`

* **Scan & Translate (Auto-Generator)**: `qlit scan <dir> --to <language>`
  Scans your project (js, ts, py, etc.) for hardcoded strings and creates a ready-to-use translation file.
  *Example:* `qlit scan ./src --to tr`

* **List Languages**: `qlit list`
  Displays 130+ supported languages and their codes.

* **Configuration**: `qlit config <language>`
  Permanently sets the default translation language and CLI language.
  *(You can override the config path by setting the `QLIT_CONFIG_PATH` environment variable)*

* **Folder Translation**: `qlit --folder <path> to <language>`
  Translates all files within a folder recursively while maintaining the file structure.
  *Example:* `qlit --folder ./locales to en`

### Advanced Options

* **Configurable Concurrency**: Use `-p` or `--parallel` to set worker count.
  *Example:* `qlit i18n large.json --to de --parallel 50`

* **Interactive Shell**: `qlit -i`
  Opens a persistent, fast translation session.

* **Clipboard Support**: Add `--copy` to result-copying flow.

* **JSON Data**: Add `--json` to get full linguistic data (definitions, examples).

### Options List

* `-p, --parallel <n>`: Set concurrency limit (default: 30).
* `-c, --copy`: Copy result to clipboard.
* `-j, --json`: Output full developer JSON response.
* `-f, --file <path>`: Perform file content translation.
* `-i, --interactive`: Start an interactive translation shell.

---

## Using as a Library

### JavaScript / Node.js

```javascript
const qlit = require('qlit');

async function test() {
  // Batch Translation
  const list = ['Hello', 'World'];
  const results = await qlit.translateBatch(list, 'en', 'tr');
  console.log(results[0].translation); // "Merhaba"
}
```

### TypeScript

```typescript
import qlit from '@reformlabs/qlit';

const res = await qlit.translate('Hello', 'en', 'tr');
```

## .env Configuration (Optional)

If you want to use DeepL Pro/Free, add a `.env` file to the root directory of your project:

```env
DEEPL_API_KEY=your_key_here
```

## License and Rights

This project is open source, but the ownership rights belong to **Reform Labs**. Users may use the system, but they may not redistribute it by presenting it as their own work.

---

Made with ❤️ by **Reform Labs**
