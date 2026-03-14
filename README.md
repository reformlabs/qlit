<p align="center">
  <img src="https://github.com/reformlabs/qlit/raw/main/assets/banner.png" alt="Qlit Banner">
</p>

# Qlit by Reform Labs (@reformlabs/qlit)

An open-source library and CLI tool that enables fast, smart, and seamless translation directly from your terminal or projects.

> [!IMPORTANT]
> This project is developed by **Reform Labs**. Users are free to use the system and contribute, but they may not redistribute it by claiming ownership as if it were their own project.

## Features

* **DeepL Integration**: Automatically switches to the high-quality DeepL engine when an API key is provided.
* **Auto-i18n Generator**: Scans your source code for hardcoded strings and generates a translated JSON file instantly.
* **i18n Support**: Bulk translates JSON/YAML localization files while preserving their keys.
* **Auto-Mirror (Uninterrupted Service)**: Automatically switches between 8+ different servers to provide an “always-working” experience.
* **Smart Cache**: Avoids sending API requests for identical translations for 5 minutes, improving speed.
* **Markdown Support**: Preserves `code`, **bold**, *italic*, and links during translation.
* **File Translator**: Translates text files line-by-line and saves the result as a new file.
* **Pipe Support**: Supports Unix pipes (e.g., `cat logs.txt | qlit`).
* **Multiple Target Languages**: Translate the same text into multiple languages at once (e.g., `en,tr,de`).
* **Interactive Mode**: Opens a persistent shell session for continuous translation.
* **JSON Output**: Provides clean JSON output containing all technical data for developers.
* **Advanced CLI**: Premium CLI experience with Ora spinner, Chalk colors, and clipboard support.
* **Dual Support**: Fully compatible with both TypeScript and JavaScript (ESM/CJS) projects.

## Installation

```bash
npm install -g qlit
```

## CLI Usage

Start by configuring the CLI language and the default target language:

```bash
qlit config tr
```

*(Sets the CLI language to Turkish and the default target language to TR.)*

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

### Advanced Usage & Options

* **Pipe Support**: `cat logs.txt | qlit to tr`
  Translates outputs coming from other commands directly.

* **File Translation**: `qlit to en -f readme.txt`
  Reads a file and saves the result as `readme_en.txt`.

* **Interactive Mode**: `qlit -i`
  Opens a fast shell for continuous translations.

* **JSON Mode**: `qlit "Hello" --json`
  Returns full API data (pronunciation, definitions, etc.) as JSON.

* **Clipboard Support**: `--copy`
  Automatically copies the translation result to the clipboard.

### Options List

* `-c, --copy`: Copies the result to the clipboard.
* `-j, --json`: Returns full JSON output.
* `-f, --file <path>`: Performs file translation.
* `-i, --interactive`: Starts an interactive shell.

---

## Using as a Library

### JavaScript / Node.js

```javascript
const qlit = require('qlit');

async function test() {
  // Translation
  const res = await qlit.translate('Hello', 'en', 'tr');
  console.log(res.translation); // "Merhaba"
  console.log(res.engine);      // "lingva" or "deepl"
}
```

### TypeScript

```typescript
import qlit, { Language } from 'qlit';

const res = await qlit.translate('Hello', 'en', 'tr');
const langs: Language[] = await qlit.getLanguages();
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
