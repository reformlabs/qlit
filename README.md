<p align="center">
  <img src="https://github.com/reformlabs/qlit/raw/main/assets/banner.png" alt="Qlit Banner">
</p>

# Qlit by Reform Labs (@reform/qlit)

Terminalden veya projelerinden hızlı, akıllı ve kesintisiz çeviri yapmanızı sağlayan açık kaynaklı bir kütüphane ve CLI aracı.

> [!IMPORTANT]
> Bu proje **Reform Labs** tarafından geliştirilmiştir. Kullanıcılar sistemi özgürce kullanabilir ve katkıda bulunabilir, ancak projenin mülkiyetini kendilerine aitmiş gibi göstererek paylaşamazlar.

## Özellikler

-   **DeepL Entegrasyonu**: API anahtarı eklendiğinde otomatik olarak yüksek kaliteli DeepL motoruna geçer.
-   **i18n Desteği**: JSON/YAML yerelleştirme dosyalarını anahtarları koruyarak toplu çevirir.
-   **Auto-Mirror (Kesintisiz Hizmet)**: 8+ farklı sunucu arasında otomatik geçiş yaparak "asla bozulmayan" bir deneyim sunar.
-   **Akıllı Önbellek**: Aynı çeviriler için 5 dakika boyunca API isteği atmaz, hızı artırır.
-   **Markdown Desteği**: `code`, **bold**, *italic* ve linkleri çeviri sırasında korur.
-   **Dosya Çeviricisi**: Metin dosyalarını satır satır çevirir ve sonucu yeni bir dosyaya kaydeder.
-   **Pipe (Boru) Desteği**: Unix pipe'larını destekler (örn: `cat logs.txt | qlit`).
-   **Çoklu Hedef Dil**: Aynı metni aynı anda birden fazla dile çevirebilir (örn: `en,tr,de`).
-   **İnteraktif Mod**: Sürekli çeviri yapmak için kalıcı bir shell oturumu açar.
-   **JSON Çıktı**: Geliştiriciler için tüm teknik veriyi içeren temiz JSON çıktısı sağlar.
-   **Gelişmiş CLI**: Ora spinner, Chalk renkleri ve Clipboard desteği ile premium deneyim.
-   **Dual Support**: Hem TypeScript hem de JavaScript (ESM/CJS) projelerinde tam uyumluluk.

## Kurulum

```bash
npm install -g qlit
```

## CLI Kullanımı

CLI dilini ve varsayılan hedef dili ayarlayarak başlayın:

```bash
qlit config tr # CLI'yı Türkçe yapar ve varsayılan hedef dili TR olarak ayarlar
```

### Temel Komutlar

- **Hızlı Çeviri**: `qlit <metin>`  
  Varsayılan dile anında çeviri yapar.  
  *Örnek:* `qlit "Hello"`

- **Hedefli ve Çoklu Çeviri**: `qlit to <dil(ler)> <metin>`  
  Belirli bir dile veya virgülle ayrılmış birden fazla dile çeviri yapar.  
  *Örnek:* `qlit to tr,de "Hello"`

- **i18n Otomasyonu**: `qlit i18n <dosya> --to <dil>`  
  JSON yerelleştirme dosyalarını anahtarları bozmadan çevirir.  
  *Örnek:* `qlit i18n tr.json --to en`

- **Dilleri Listele**: `qlit list`  
  Desteklenen 130+ dili ve kodlarını görüntüler.

- **Yapılandırma**: `qlit config <dil>`  
  Varsayılan çeviri dilini ve CLI dilini kalıcı olarak ayarlar.

### Gelişmiş Kullanım & Seçenekler

- **Pipe Desteği**: `cat logs.txt | qlit to tr`  
  Diğer komutlardan gelen çıktıları doğrudan çevirir.
- **Dosya Çeviri**: `qlit to en -f readme.txt`  
  Dosyayı okur ve `readme_en.txt` olarak kaydeder.
- **İnteraktif Mod**: `qlit -i`  
  Sürekli çeviri için hızlı bir shell açar.
- **JSON Modu**: `qlit "Hello" --json`  
  Tüm API verisini (telaffuz, tanımlar vb.) JSON olarak döner.
- **Pano Desteği**: `--copy`  
  Çeviri sonucunu otomatik olarak kopyalar.

### Seçenek Listesi
- `-c, --copy`: Sonucu panoya kopyalar.
- `-j, --json`: Tam JSON çıktısı verir.
- `-f, --file <yol>`: Dosya çevirisi yapar.
- `-i, --interactive`: İnteraktif shell başlatır.

---

## Kütüphane Olarak Kullanım

### JavaScript / Node.js
```javascript
const qlit = require('qlit');

async function test() {
  // Çeviri
  const res = await qlit.translate('Hello', 'en', 'tr');
  console.log(res.translation); // "Merhaba"
  console.log(res.engine);      // "lingva" veya "deepl"
}
```

### TypeScript
```typescript
import qlit, { Language } from 'qlit';

const res = await qlit.translate('Hello', 'en', 'tr');
const langs: Language[] = await qlit.getLanguages();
```

## .env Yapılandırması (Opsiyonel)
DeepL Pro/Free kullanmak isterseniz projenizin kök dizinine bir `.env` dosyası ekleyin:
```env
DEEPL_API_KEY=your_key_here
```

## Lisans ve Haklar

Bu proje açık kaynaklıdır ancak mülkiyet hakları **Reform Labs**'a aittir. Kullanıcılar sistemi kullanabilir, ancak sistemi "kendi yapımı" gibi göstererek tekrar dağıtamazlar.

---
Made with ❤️ by **Reform Labs**