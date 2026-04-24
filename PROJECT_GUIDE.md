# Ata Meeting Assistant — Proje Rehberi

Bu doküman, **Ata Meeting Assistant** projesinde kullanılan tüm teknolojileri, mimariyi, veri akışlarını ve geliştirme süreçlerini açıklar. Proje ile ilgili gelebilecek neredeyse tüm sorulara bu rehbere bakarak yanıt verebilirsiniz.

---

## 1. Proje Özeti ve Amaç

**Ata Meeting Assistant**, Zoom toplantılarını otomatik olarak dinleyip gerçek zamanlı transkript çıkaran, toplantı sonrası yapay zeka destekli özet ve aksiyon maddeleri üreten bir web uygulamasıdır. Ayrıca kullanıcılar ses dosyası yükleyerek offline (çevrimdışı) toplantı analizi de yapabilir.

### Temel Özellikler
- Zoom toplantısına bot katılımı ve gerçek zamanlı transkripsiyon
- Offline ses dosyası yükleme, transkripsiyon ve özetleme
- AI destekli toplantı özeti ve aksiyon maddesi çıkarımı
- Transkript üzerinden sohbet (chat) imkanı
- Çoklu dil desteği (İngilizce ve Türkçe transkripsiyon)
- Tema (aydınlık/karanlık) desteği

---

## 2. Mimari Genel Bakış

Proje, **beş ana katmandan** oluşan dağıtık (distributed) bir mimariye sahiptir:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  API Gateway    │────▶│   Zoom Bot      │
│  (React + Vite) │     │  (Express.js)   │     │ (Docker + Python│
│    Port 5173    │     │    Port 3001    │     │  + Playwright)  │
└────────┬────────┘     └────────┬────────┘     └─────────────────┘
         │                       │
         │               ┌───────┘
         │               ▼
         │      ┌─────────────────┐
         │      │  Summarizer     │
         │      │ (FastAPI + LLM) │
         │      │    Port 8000    │
         │      └────────┬────────┘
         │               │
         ▼               ▼
┌─────────────────────────────────────────┐
│            Supabase Cloud               │
│  (Auth + PostgreSQL + Realtime + Storage)│
└─────────────────────────────────────────┘
```

### Servis Sorumlulukları
| Servis | Teknoloji | Port | Görevi |
|---|---|---|---|
| **Frontend** | React + TypeScript + Vite | 5173 | Kullanıcı arayüzü, yönlendirme, gerçek zamanlı abonelikler |
| **API Gateway** | Node.js + Express | 3001 | Bot yönetimi, summarizer proxy, kullanıcı tercihleri |
| **Zoom Bot** | Python + Playwright + Whisper | — | Zoom'a katılma, ses yakalama, transkript üretimi |
| **Summarizer** | Python + FastAPI + Ollama | 8000 | AI özetleme, transkripsiyon, sohbet endpoint'leri |
| **Database** | Supabase (PostgreSQL) | — | Veri kalıcılığı, kimlik doğrulama, dosya depolama |

---

## 3. Teknoloji Yığını ve Kullanım Sebepleri

### 3.1 Frontend Katmanı

#### React (`^19.2.0`)
- **Ne olduğu**: Facebook tarafından geliştirilen, bileşen tabanlı bir JavaScript UI kütüphanesi.
- **Neden kullanıldı**: Kullanıcı arayüzünü modüler bileşenlere ayırmak, state yönetimini kolaylaştırmak ve geniş ekosistemi sayesinde hızlı geliştirme yapmak için.
- **Sistemdeki rolü**: Tüm sayfalar (LandingPage, AuthPage, MainPage, SessionPage), bileşenler (Topbar) ve yönlendirme mantığı React ile yazılmıştır.

#### React DOM (`^19.2.0`)
- **Ne olduğu**: React bileşenlerini tarayıcının DOM'una render eden paket.
- **Neden kullanıldı**: React 19 ile birlikte gelen güncel render motorunu kullanmak için.

#### TypeScript (`~5.9.3`)
- **Ne olduğu**: JavaScript'in üst kümesi; statik tip denetimi sağlar.
- **Neden kullanıldı**: Büyük projede hata yakalama, otomatik tamamlama (intellisense), kodun okunabilirliği ve bakım kolaylığı için.
- **Sistemdeki rolü**: `.tsx` dosyaları ile tip güvenli bileşenler; arayüzler (`TranscriptItem`, `ActionItem`, `Participant` vb.) tanımlanmıştır.

#### Vite (`^7.2.4`)
- **Ne olduğu**: Hızlı bir frontend build aracı ve geliştirme sunucusu.
- **Neden kullanıldı**: Webpack'e göre çok daha hızlı başlatma süresi (HMR — Hot Module Replacement) ve optimize edilmiş üretim derlemesi için.
- **Sistemdeki rolü**: `vite.config.ts` içinde geliştirme sunucusu ve API proxy yapılandırması tanımlıdır.

#### React Router DOM (`^7.13.0`)
- **Ne olduğu**: React uygulamalarında sayfa yönlendirmesi (client-side routing) kütüphanesi.
- **Neden kullanıldı**: SPA (Single Page Application) mantığında çok sayfalı bir deneyim sunmak için sayfa yenilemeden URL değişimi yapmak amacıyla.
- **Sistemdeki rolü**: `/` (Landing), `/auth` (Giriş), `/dashboard` (Ana sayfa), `/session/:sessionId` (Oturum detayı) rotalarını yönetir.

#### Material UI (MUI) (`^7.3.7`)
- **Ne olduğu**: Google'ın Material Design prensiplerine dayalı React bileşen kütüphanesi.
- **Neden kullanıldı**: Hızlı ve tutarlı UI geliştirme; hazır Dialog, Button, TextField, Snackbar, Chip, Checkbox gibi bileşenler.
- **Sistemdeki rolü**: Tüm sayfalardaki form elemanları, diyaloglar, ikonlar (MUI Icons) ve layout bileşenleri.

#### MUI X Date Pickers (`^8.26.0`)
- **Ne olduğu**: MUI'nin gelişmiş tarih/saat seçici bileşenleri.
- **Sistemdeki rolü**: Gelecekte toplantı planlama gibi özellikler için eklenmiş (mevcut akışta doğrudan kullanımı görünmüyor ancak bağımlılık mevcut).

#### Emotion (`^11.14.0`, `^11.14.1`)
- **Ne olduğu**: CSS-in-JS çözümü; JavaScript içinde stil yazmayı sağlar.
- **Neden kullanıldı**: MUI'nin varsayılan stil motoru olduğu için zorunlu bağımlılık olarak gelir.

#### Day.js (`^1.11.19`)
- **Ne olduğu**: Hafif bir tarih/saat işleme kütüphanesi (Moment.js alternatifi).
- **Sistemdeki rolü**: Tarih formatlama işlemleri.

---

### 3.2 API Gateway (Backend)

#### Node.js & Express.js (`^4.21.0`)
- **Ne olduğu**: minimalist web framework for Node.js.
- **Neden kullanıldı**: Hafif, hızlı ve esnek bir HTTP sunucusu kurmak için. JSON body parsing, CORS, routing gibi temel ihtiyaçları karşılar.
- **Sistemdeki rolü**: `/api/bot/*` (bot yönetimi), `/api` (summarizer proxy), `/api/preferences` (kullanıcı tercihleri) endpoint'lerini sunar.

#### CORS (`^2.8.5`)
- **Ne olduğu**: Cross-Origin Resource Sharing desteği sağlayan middleware.
- **Neden kullanıldı**: Frontend (5173) ve Summarizer (8000) farklı portlardan çalıştığı için tarayıcı güvenlik kısıtlamalarını aşmak için.

#### dotenv (`^17.2.3`)
- **Ne olduğu**: `.env` dosyasındaki ortam değişkenlerini `process.env`'ye yükler.
- **Neden kullanıldı**: API anahtarları, veritabanı URL'leri gibi hassas bilgileri koddan ayırmak için.

---

### 3.3 Zoom Bot Servisi

#### Python 3.12
- **Neden kullanıldı**: Ses işleme, makine öğrenimi ve otomasyon kütüphanelerinin zengin ekosistemi.

#### Playwright (async API)
- **Ne olduğu**: Microsoft tarafından geliştirilen, tarayıcıları programatik olarak kontrol eden kütüphane.
- **Neden kullanıldı**: Zoom web istemcisine (web client) gerçek bir tarayıcı gibi giriş yapmak, butonlara tıklamak, toplantıya katılmak için.
- **Sistemdeki rolü**: Chromium başlatır, Zoom URL'sine gider, isim girer, "Join" butonuna tıklar, ses/video izinlerini yönetir.

#### Faster-Whisper
- **Ne olduğu**: OpenAI Whisper modelinin optimize edilmiş (CTranslate2 tabanlı) versiyonu.
- **Neden kullanıldı**: Gerçek zamanlı konuşma tanıma (ASR) için hızlı ve doğru transkripsiyon.
- **Sistemdeki rolü**: Bot, Zoom'dan yakaladığı sesi chunk'lar halinde Whisper'a verir ve konuşulan metni çıkarır.

#### soundcard
- **Ne olduğu**: Python ile sistem ses kartına erişim sağlayan, cross-platform ses kayıt kütüphanesi.
- **Neden kullanıldı**: Zoom'un tarayıcı üzerinden çıkardığı sesi sanal ses cihazı üzerinden yakalamak için.
- **Sistemdeki rolü**: Linux'ta `module-null-sink` (PulseAudio) üzerinden, Windows/macOS'ta speaker loopback üzerinden ses kaydı yapar.

#### NumPy
- **Ne olduğu**: Sayısal hesaplama kütüphanesi.
- **Neden kullanıldı**: Ses buffer'larının (numpy array) işlenmesi, amplitude hesaplamaları ve sessizlik tespiti için.

#### Requests
- **Ne olduğu**: HTTP istemci kütüphanesi.
- **Sistemdeki rolü**: Bot, durum güncellemelerini API Gateway'e (`/api/bot/status/:sessionId`) POST eder.

#### Supabase Python Client
- **Ne olduğu**: Supabase backend'ine Python'dan bağlanma kütüphanesi.
- **Sistemdeki rolü**: Bot, transkriptleri doğrudan PostgreSQL `transcripts` tablosuna yazar.

#### PyTorch
- **Ne olduğu**: Derin öğrenme framework'ü.
- **Sistemdeki rolü**: Faster-Whisper modelinin çalışma ortamını sağlar; CUDA varsa GPU kullanımına izin verir.

---

### 3.4 AI Summarizer Servisi

#### FastAPI
- **Ne olduğu**: Modern, hızlı (Starlette tabanlı), otomatik OpenAPI dokümantasyonu üreten Python web framework'ü.
- **Neden kullanıldı**: Asenkron endpoint'ler, Pydantic validasyonu ve kolay test edilebilirlik için.
- **Sistemdeki rolü**: `/summarize`, `/transcribe`, `/chat`, `/models`, `/health` endpoint'lerini sunar.

#### Uvicorn
- **Ne olduğu**: ASGI sunucusu.
- **Neden kullanıldı**: FastAPI uygulamasını çalıştırmak için (`uvicorn main:app --reload --port 8000`).

#### Pydantic
- **Ne olduğu**: Python için veri validasyon ve ayar yönetimi kütüphanesi.
- **Neden kullanıldı**: Request/response modellerinin tip güvenliği ve otomatik validasyonu.
- **Sistemdeki rolü**: `SummarizeRequest`, `ChatRequest`, `ActionItemOut`, `SummarizeResponse` gibi modeller tanımlıdır.

#### httpx
- **Ne olduğu**: Modern, async destekli HTTP istemcisi.
- **Neden kullanıldı**: FastAPI'nin async yapısına uygun olarak Ollama'ya istek atmak için.

#### OpenAI Whisper (`openai-whisper`)
- **Ne olduğu**: OpenAI'ın orijinal Whisper implementasyonu.
- **Neden kullanıldı**: Offline ses dosyası transkripsiyonu (summarizer servisi içinde).
- **Sistemdeki rolü**: Kullanıcının yüklediği ses dosyasını transkribe eder.

#### Ollama
- **Ne olduğu**: Yerel makinede büyük dil modelleri (LLM) çalıştırmayı kolaylaştıran araç.
- **Neden kullanıldı**: Toplantı özetleme ve aksiyon maddesi çıkarımı için **yerel (local) LLM** çalıştırmak; bulut API maliyeti ve gizlilik endişelerini ortadan kaldırmak.
- **Sistemdeki rolü**: `llama3.1` (varsayılan) modeli çalıştırılır. `POST /api/generate` ile prompt gönderilir, JSON formatında yanıt alınır.

#### Groq (Python SDK)
- **Ne olduğu**: Groq API'sine erişim sağlayan Python kütüphanesi.
- **Neden kullanıldı**: Offline (ses dosyası) özetleme işlemlerinde **remote LLM provider** olarak Groq kullanılabilir. Hızlı inference sunar.
- **Sistemdeki rolü**: `.env`'de `REMOTE_LLM_PROVIDER=groq` ve `REMOTE_LLM_API_KEY` tanımlıysa, Ollama yerine Groq üzerinden `llama-3.1-8b-instant` veya benzeri model çağrılır.

#### python-dotenv
- **Ne olduğu**: Python uygulamalarında `.env` dosyasını okumak için.
- **Sistemdeki rolü**: `services/summarizer/config.py` iki üst dizindeki `.env` dosyasını yükler.

---

### 3.5 Veritabanı ve BaaS

#### Supabase
- **Ne olduğu**: Firebase alternatifi açık kaynaklı Backend-as-a-Service; PostgreSQL üzerine kuruludur.
- **Neden kullanıldı**: Tek bir platformda **kimlik doğrulama**, **ilişkisel veritabanı**, **gerçek zamanlı abonelikler** ve **dosya depolama** ihtiyaçlarını karşılamak.

**Supabase Alt Hizmetleri:**

| Alt Hizmet | Kullanım Alanı |
|---|---|
| **Auth** | Kullanıcı kaydı, giriş, oturum yönetimi (JWT tabanlı) |
| **PostgreSQL** | Tüm uygulama verisi (sessions, transcripts, summaries, action_items, bots, profiles, user_preferences) |
| **Realtime** | `transcripts`, `action_items`, `sessions` tablolarındaki değişiklikleri anlık frontend'e iletme |
| **Storage** | `audio-uploads` bucket'ına offline ses dosyası yükleme |
| **Row Level Security (RLS)** | `authenticated` rolüne sahip kullanıcıların tablolara erişimini sınırlandırma |

---

### 3.6 Altyapı ve Araçlar

#### Docker & Docker Compose
- **Ne olduğu**: Uygulamaları konteynerler içinde izole çalıştırma teknolojisi.
- **Neden kullanıldı**: Zoom Bot'un karmaşık sistem bağımlılıklarını (PulseAudio, Chromium, Python kütüphaneleri) izole bir ortamda çalıştırmak ve taşınabilirliği artırmak.
- **Sistemdeki rolü**: `services/bot/Dockerfile` ve `docker-compose.yml` ile bot imajı oluşturulur. API Gateway `docker compose run` ile botu başlatır.

#### PulseAudio
- **Ne olduğu**: Linux ses sunucusu.
- **Neden kullanıldı**: Docker içinde sanal bir ses çıkışı (null sink) oluşturmak; tarayıcının sesini bu sanal cihaza yönlendirip botun yakalamasını sağlamak.
- **Sistemdeki rolü**: `start.sh` içinde `module-null-sink` yüklenir, default sink/source ayarlanır.

#### ESLint (`^9.39.1`)
- **Ne olduğu**: JavaScript/TypeScript kod kalitesi ve stil denetleyicisi.
- **Sistemdeki rolü**: `npm run lint` ile kod kalitesi kontrolü.

#### Playwright Test (`@playwright/test`)
- **Ne olduğu**: E2E (end-to-end) test framework'ü.
- **Sistemdeki rolü**: `tests/e2e/` altında gerçek tarayıcıda çalışan testler; auth, dashboard, offline flow, session sayfalarını test eder.

---

## 4. Servislerin Detaylı İşleyişi

### 4.1 Frontend (React)

#### Kimlik Doğrulama Akışı
1. `App.tsx`, `supabase.auth.getSession()` ile mevcut oturumu kontrol eder.
2. `onAuthStateChange` aboneliği ile oturum değişikliklerini dinler.
3. Kullanıcı giriş yapmamışsa `/auth` sayfasına yönlendirir.
4. Giriş yapan kullanıcının profili `profiles` tablosunda tutulur.

#### Dashboard (MainPage)
- **Online Meeting (Zoom)**: Kullanıcı Zoom URL'si girer.
  - Yeni session oluşturulur (`sessions` tablosuna INSERT, `source_type='Zoom'`).
  - Kullanıcı `session_member` tablosuna eklenir.
  - API Gateway'e `POST /api/bot/start` isteği atılır.
  - `/session/:sessionId` sayfasına yönlendirilir.
- **Offline Meeting (Ses Yükleme)**: Kullanıcı ses dosyası seçer.
  - Dosya `audio-uploads` bucket'ına yüklenir.
  - `sessions` tablosuna `source_type='offline'`, `source_ref=dosya_yolu` ile kayıt oluşturulur.
  - Arka planda `POST /api/transcribe` isteği atılır.
  - `/session/:sessionId` sayfasına yönlendirilir.

#### SessionPage (Oturum Detayı)
- **Veri Çekme**: `fetchSessionData` fonksiyonu ile session bilgisi, transkriptler, özet, aksiyon maddeleri, katılımcılar çekilir.
- **Realtime Abonelikler**:
  - `transcripts` tablosu: Yeni transkript geldiğinde liste anında güncellenir.
  - `action_items` tablosu: INSERT/UPDATE/DELETE event'leri dinlenir.
  - `sessions` tablosu: `processing_status` değiştiğinde (özellikle `completed` olduğunda) veri yeniden çekilir.
- **Polling Fallback**: Realtime çalışmazsa 3 saniyelik interval ile veri çekilir.
- **Bot Durumu**: 5 saniyede bir `GET /api/bot/status/:sessionId` ile botun çalışıp çalışmadığı kontrol edilir.
- **Özet Üretme**: Kullanıcı "Generate" butonuna basınca `POST /api/summarize` çağrılır.
- **Canlı Özet (Live Summary)**: Bot aktifken otomatik olarak belirli aralıklarla (varsayılan 15 sn) özet üretilir.
- **Chat**: `POST /api/chat` ile transkript üzerinden soru sorulur.
- **Export**: Transkript (TXT) ve özet+aksiyonlar (JSON) olarak indirilebilir.

### 4.2 API Gateway (Express)

#### Bot Yönetimi (`routers/botRouter.js`)
- `POST /start`: `docker compose run` ile yeni bot konteyneri başlatır. `runningBots` Map'i ile aktif botları bellekte takip eder.
- `POST /stop`: İlgili Docker sürecine `SIGTERM` gönderir.
- `GET /status/:sessionId`: Botun çalışma durumunu döner.
- `POST /status/:sessionId`: Botun kendisi durum raporu gönderir (`starting` → `joining` → `active`).
- `GET /list`: Çalışan tüm botları listeler.

#### Summarizer Proxy (`routers/summarizerRouter.js`)
- Tüm istekleri `http://localhost:8000`'deki FastAPI servisine iletir (proxy).
- Endpoint'ler: `/transcribe`, `/summarize`, `/chat`, `/models`.
- ECONNREFUSED hatası alırsa 503 döner ve kullanıcıya summarizer'ın çalışmadığını bildirir.

#### Kullanıcı Tercihleri (`routers/preferencesRouter.js`)
- `GET /:userId`: Kullanıcının `preferred_model` ve `preferred_language` bilgisini çeker. Yoksa otomatik oluşturur.
- `PUT /:userId`: Tercihleri günceller (upsert).

### 4.3 Zoom Bot (`services/bot/bot.py`)

#### Başlatma ve Tarayıcı
1. Docker konteyneri başlatılır; ortam değişkenleri (`ZOOM_URL`, `SESSION_ID`, `SUPABASE_URL`, `TRANSCRIPTION_LANGUAGE`) aktarılır.
2. `start.sh` PulseAudio'yu başlatır, sanal ses cihazı (`ZoomAudio`) oluşturur.
3. `bot.py` çalışmaya başlar:
   - Playwright ile Chromium başlatılır (headless, no-sandbox, fake media stream).
   - Zoom web client URL'sine gidilir (`app.zoom.us/wc/{id}/join`).
   - İsim alanına "ATA Smart Meeting Assistant" yazılır.
   - Join butonuna tıklanır; ses (computer audio) katılımı sağlanır.
   - Mikrofon sessize alınır (sadece dinleyici modu).

#### Ses Yakalama ve Transkripsiyon
- `soundcard` ile sanal ses cihazından 16kHz, 100ms chunk'lar halinde ses okunur.
- Amplitude threshold (`0.01`) ile konuşma tespiti yapılır.
- **VAD (Voice Activity Detection) mantığı**:
  - Konuşma başlayınca buffer biriktirilir.
  - Sürekli konuşma durumunda her 5 saniyede bir periyodik transkripsiyon yapılır (overlap ile).
  - Sessizlik 0.3 sn'yi geçerse veya maksimum 10 sn konuşma olursa buffer tamamen transkribe edilir.
- `faster_whisper.WhisperModel` ile transcription yapılır.
- Sonuçlar hem lokal JSON dosyasına (`transcripts/`) hem de Supabase `transcripts` tablosuna yazılır.

#### Toplantı Bitiş Kontrolü
- Her 2 saniyede bir DOM'da "meeting has ended", "Rejoin" butonu gibi elementler aranır.
- URL değişimi de toplantının bittiği olarak yorumlanır.
- Bitince `shutdown()` çağrılır; tarayıcı kapatılır, API Gateway'e `ended` durumu raporlanır.

### 4.4 Summarizer (`services/summarizer/`)

#### Yapılandırma (`config.py`)
- Proje kökündeki `.env`'yi okur.
- `OLLAMA_HOST`, `OLLAMA_MODEL`, `WHISPER_MODEL`, `REMOTE_LLM_PROVIDER`, `REMOTE_LLM_API_KEY` gibi değerleri yükler.

#### Veritabanı (`database.py`)
- Supabase service role key ile client oluşturur.
- `_update_processing_status` helper'ı session durumunu günceller.

#### Transkripsiyon (`transcriber.py`)
- `_transcribe_and_summarize(session_id)` background task olarak çalışır.
1. Session'dan `source_ref` (ses dosyası yolu) alınır.
2. Supabase Storage'dan dosya indirilir.
3. Geçici dosyaya yazılır, `whisper.load_model()` ile transkripsiyon yapılır.
4. Segmentler `transcripts` tablosuna kaydedilir.
5. Durum `summarizing` yapılır.
6. `_run_summarization` çağrılır.
7. Başarılı/başarısız durumda `processing_status` güncellenir.

#### Özetleme (`summarizer.py`)
- `_run_summarization(session_id, model, language)`:
1. Session'ın `source_type`'ına bakar: `offline` ise `mode='remote'`, `Zoom` ise `mode='local'`.
2. `get_provider(mode, model)` ile LLM provider seçilir.
   - Local mode → Ollama çağrılır.
   - Remote mode → Groq çağrılır (hızlı inference için).
   - Remote başarısız olursa fallback olarak Ollama'ya düşülür.
3. Transkriptler `transcripts` tablosundan çekilir, metin haline getirilir.
4. LLM'e prompt gönderilir; JSON formatında `summary` + `action_items` beklenir.
5. Yanıt parse edilir (JSON parse, regex fallback).
6. Eski özet ve aksiyon maddeleri silinir, yenileri `summaries` ve `action_items` tablolarına yazılır.
7. Aksiyon maddesine atanan kişi varsa `action_item_assignees` tablosuna kaydedilir.

#### Chat (`chat.py`)
- `POST /chat`:
1. Session'a ait tüm transkriptler çekilir.
2. Sistem prompt'una transkript ve kullanıcı soru geçmişi eklenir.
3. Ollama'ya gönderilir.
4. Yanıt kullanıcıya döner.

### 4.5 Veritabanı Şeması (Supabase PostgreSQL)

**Temel Tablolar:**

| Tablo | Amaç | Önemli Kolonlar |
|---|---|---|
| `sessions` | Toplantı oturumları | `id` (UUID), `source_type` (Zoom/offline), `source_ref` (URL veya dosya yolu), `processing_status` |
| `session_member` | Kullanıcı-oturum ilişkisi | `session_id`, `user_id` |
| `transcripts` | Konuşma metinleri | `session_id`, `speaker`, `transcript`, `timestamp_ms` |
| `summaries` | AI özetleri | `session_id`, `summary` |
| `action_items` | Çıkarılan görevler | `session_id`, `description`, `status` (pending/completed) |
| `action_item_assignees` | Görev atamaları | `action_item_id`, `assigned_to` |
| `bots` | Çalışan bot kayıtları | `session`, `started_at`, `terminated_at` |
| `profiles` | Kullanıcı profilleri | `id` (auth.users FK), `first_name`, `last_name`, `email` |
| `user_preferences` | Kullanıcı tercihleri | `user_id`, `preferred_model`, `preferred_language` |

**RLS (Row Level Security):**
- Tüm tablolarda RLS aktiftir.
- `authenticated` rolündeki kullanıcılar tüm tablolara tam erişime sahiptir (geliştirme kolaylığı için catch-all policy).
- **Not**: Production ortamında daha kısıtlayıcı policy'ler yazılması önerilir (örneğin sadece `session_member` olan kullanıcılar session'ı görebilir).

**Realtime:**
- `transcripts`, `summaries`, `action_items`, `sessions` tabloları `supabase_realtime` yayınına eklenmiştir. Bu sayede frontend bu tablolardaki değişiklikleri anlık alır.

**Storage:**
- `audio-uploads` bucket'ı özel (private) olarak tanımlanmıştır.
- Kimliği doğrulanmış kullanıcılar dosya yükleyip okuyabilir.

---

## 5. API Endpointleri Özeti

### API Gateway (Express, :3001)

| Endpoint | Method | Açıklama |
|---|---|---|
| `/health` | GET | Sağlık kontrolü |
| `/api/config` | GET | Frontend ayarlarını döner (`live_summary_interval_sec`) |
| `/api/bot/start` | POST | Bot başlatır (zoomUrl, sessionId, language) |
| `/api/bot/stop` | POST | Bot durdurur |
| `/api/bot/status/:sessionId` | GET | Bot durumunu sorgular |
| `/api/bot/status/:sessionId` | POST | Bot durum güncellemesi alır |
| `/api/bot/list` | GET | Çalışan botları listeler |
| `/api/summarize` | POST | Özetleme isteğini summarizer'a iletir |
| `/api/transcribe` | POST | Transkripsiyon isteğini summarizer'a iletir |
| `/api/chat` | POST | Sohbet isteğini summarizer'a iletir |
| `/api/models` | GET | Mevcut LLM modellerini listeler |
| `/api/preferences/:userId` | GET | Kullanıcı tercihlerini getirir |
| `/api/preferences/:userId` | PUT | Kullanıcı tercihlerini günceller |

### Summarizer (FastAPI, :8000)

| Endpoint | Method | Açıklama |
|---|---|---|
| `/health` | GET | Sağlık kontrolü |
| `/models` | GET | Ollama'daki modelleri listeler |
| `/summarize` | POST | Transkriptleri özetler ve aksiyon maddeleri çıkarır |
| `/transcribe` | POST | Ses dosyasını transkribe eder, ardından özetler |
| `/chat` | POST | Transkript üzerinden sohbet |

---

## 6. Çevresel Değişkenler (`.env`) Rehberi

```env
# Frontend ve Auth
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>

# Backend (Service Role — tüm tablolara tam erişim)
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_URL=https://<project>.supabase.co

# Ollama (yerel LLM)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1

# Whisper (offline transkripsiyon)
WHISPER_MODEL=base        # veya small, medium

# Remote LLM (opsiyonel — Groq)
REMOTE_LLM_PROVIDER=groq
REMOTE_LLM_API_KEY=gsk_...
REMOTE_LLM_MODEL=llama-3.1-8b-instant
```

**Önemli Notlar:**
- `VITE_` önekli değişkenler frontend tarafından görülebilir (tarayıcıya gider), bu yüzden sadece `anon_key` (public) kullanılır.
- `SUPABASE_SERVICE_ROLE_KEY` yalnızca backend servislerde (API Gateway, Summarizer, Bot) kullanılır; client'a asla verilmemelidir.
- `.env` dosyası `.gitignore`'a eklenmiştir; `.env.example` şablon olarak sunulur.

---

## 7. Başlatma ve Çalıştırma Akışı

### Geliştirme Ortamı (Quick Start)

```bash
./start.sh        # macOS/Linux
.\start.ps1       # Windows
```

Bu script'ler şunları yapar:
1. **Preflight Check**: Node.js, Python, Docker, `.env` dosyası kontrolü.
2. **Ollama**: Eğer çalışmıyorsa `ollama serve` başlatır.
3. **Summarizer**: Python virtual environment oluşturur (yoksa), bağımlılıkları kurar, FastAPI'yi `uvicorn` ile 8000 portunda başlatır.
4. **API Gateway**: `services/api` dizininde `npm start` ile Express sunucusunu 3001 portunda başlatır.
5. **Frontend**: `npm run dev` ile Vite geliştirme sunucusunu 5173 portunda başlatır.
6. **Cleanup**: Ctrl+C ile tüm süreçler gracefully durdurulur.

### Manuel Başlatma

```bash
# Terminal 1 — Ollama
ollama serve

# Terminal 2 — Summarizer
cd services/summarizer
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 3 — API Gateway
cd services/api
npm install
npm start

# Terminal 4 — Frontend
npm install
npm run dev
```

### Vite Proxy
`vite.config.ts`'te `/api` istekleri otomatik olarak `http://localhost:3001`'e yönlendirilir. Bu sayede frontend `fetch('/api/...')` yazarak CORS sorunu yaşamadan backend'e ulaşır.

---

## 8. Test Stratejisi

Proje üç kategoride test içerir:

### 8.1 E2E (End-to-End) Testleri — Playwright
- **Konumu**: `tests/e2e/`
- **Kapsamı**: Gerçek tarayıcıda kullanıcı akışları (kayıt, giriş, dashboard, session, offline flow, ayarlar).
- **Konfigürasyon**: `playwright.config.ts` — Chromium, headless, 1 worker, 180 sn timeout.
- **Komut**: `npm run test:e2e`

### 8.2 Entegrasyon Testleri — Node.js Built-in Test Runner
- **Konumu**: `tests/integration/`
- **Kapsamı**: API Gateway endpoint'lerinin canlı testi (`/health`, `/api/summarize`, `/api/transcribe`, `/api/chat`, `/api/bot/start`).
- **Komut**: `npm run test:integration`

### 8.3 Yük Testleri
- **Konumu**: `tests/integration/load.test.mjs`
- **Kapsamı**: 5 eşzamanlı özetleme isteği ile servis davranışı ölçülür.
- **Komut**: `npm run test:load`

### 8.4 Python Birim Testleri — pytest
- **Konumu**: `services/summarizer/tests/`
- **Kapsamı**: FastAPI endpoint'leri (in-process ASGI), JSON parse helper'ları, sahte (fake) Supabase ile veri kalıcılığı.
- **Komut**: `npm run test:python` (veya `python -m pytest services/summarizer/tests`)

### Test Öncesi Kontroller (Preflight)
- `tests/helpers/preflight.mjs`: Stack'in çalışır durumda olup olmadığını kontrol eder.
- `tests/helpers/playwright-preflight.mjs`: Playwright tarayıcılarının kurulu olup olmadığını kontrol eder.

---

## 9. Güvenlik Notları

1. **Service Role Key**: `SUPABASE_SERVICE_ROLE_KEY` RLS politikalarını bypass eder. Sadece güvenilir backend servislerinde kullanılmalıdır.
2. **Anon Key**: `VITE_SUPABASE_ANON_KEY` tarayıcıya gider ve RLS kurallarına tabidir.
3. **Storage Policies**: `audio-uploads` bucket'ına sadece giriş yapmış kullanıcılar yazabilir/okuyabilir. Daha sıkı policy için kullanıcı ID'si bazlı path kontrolü eklenebilir.
4. **CORS**: API Gateway'de `cors()` açık; geliştirme ortamı için uygundur. Production'da spesifik origin'lere kısıtlanmalıdır.
5. **Docker Bot**: Bot konteyneri `--no-sandbox` ile çalışır; bu geliştirme ortamı gereğidir. Production'da güvenlik profilleri değerlendirilmelidir.

---

## 10. Sık Sorulan Sorular / Troubleshooting

**Q: Frontend `/api` istekleri nereye gidiyor?**
A: `vite.config.ts` içinde proxy yapılandırması var; geliştirme sunucusunda `http://localhost:3001`'e yönlendirilir. Production'da bunun yerine aynı domain veya bir reverse proxy (Nginx) kullanılmalıdır.

**Q: Bot neden Docker içinde çalışıyor?**
A: Bot'un ihtiyaç duyduğu sistem bağımlılıkları (PulseAudio, Chromium, ALSA) host makineden bağımsız ve tekrarlanabilir bir ortamda çalışması için.

**Q: Transkriptler nasıl anlık ekrana düşüyor?**
A: Supabase Realtime (PostgreSQL logical replication). Frontend `supabase.channel(...).on('postgres_changes', ...).subscribe()` ile belirli tablolardaki değişiklikleri dinler.

**Q: Offline ve Zoom özetlemesi arasındaki fark nedir?**
A: Zoom oturumları `source_type='Zoom'` olduğu için `local` mode (Ollama) kullanır. Offline ses dosyaları `source_type='offline'` olduğu için `remote` mode (Groq) kullanır; Groq başarısız olursa Ollama'ya fallback yapar.

**Q: Özetleme neden uzun sürüyor?**
A: Ollama yerel makinede çalışır; model boyutu (~4.7GB) ve donanım hızına bağlıdır. GPU kullanımı inference süresini ciddi şekilde kısaltır.

**Q: `llm_providers.py` dosyası nerede?**
A: Kodda `from llm_providers import get_provider` şeklinde bir import var ancak mevcut dosya listesinde bu modül görünmüyor. Bu modül `get_provider(mode, model)` fonksiyonunu içermeli ve local (Ollama) veya remote (Groq) provider nesnesi döndürmelidir. Muhtemelen geliştirme sürecinde eklenmesi gereken bir modüldür.

**Q: Bot toplantıya giremiyor / ses alamıyor?**
A: PulseAudio düzgün başlamamış olabilir. Docker loglarını kontrol edin. Ayrıca Zoom web client arayüzü değişiklikleri botun DOM seçicilerini etkileyebilir; `bot.py` içindeki CSS selector'ler güncellenmelidir.

**Q: Testler neden başarısız oluyor?**
A: `npm run test:stack:check` ile servislerin çalışır durumda olduğundan emin olun. Playwright testleri için `npx playwright install` ile tarayıcıların yüklü olduğundan emin olun.

---

## 11. Dizin Yapısı Referansı

```
ata-meeting-assistant/
├── src/                          # Frontend (React + TypeScript)
│   ├── components/               #   Yeniden kullanılabilir UI bileşenleri (Topbar)
│   ├── pages/                    #   Sayfa bileşenleri (LandingPage, AuthPage, MainPage, SessionPage)
│   ├── assets/                   #   Statik dosyalar
│   ├── App.tsx                   #   Kök bileşen ve routing
│   ├── supabaseClient.ts         #   Supabase istemci başlatma (anon key)
│   └── App.css / *.css           #   Stil dosyaları
│
├── services/
│   ├── api/                      #   Express.js API Gateway
│   │   ├── server.js             #     Sunucu başlatma ve router bağlama
│   │   ├── lib/supabase.js       #     Supabase istemci (service role)
│   │   ├── routers/              #     Endpoint router'ları
│   │   │   ├── botRouter.js      #       Bot yönetimi
│   │   │   ├── summarizerRouter.js  #    Summarizer proxy
│   │   │   └── preferencesRouter.js #    Kullanıcı tercihleri
│   │   └── package.json
│   │
│   ├── bot/                      #   Zoom Bot (Docker + Python)
│   │   ├── bot.py                #     Ana bot mantığı (Playwright + Whisper)
│   │   ├── config.json           #     Bot yapılandırması (dil, model boyutu)
│   │   ├── Dockerfile            #     Konteyner imajı tanımı
│   │   ├── docker-compose.yml    #     Konteyner koşum dosyası
│   │   ├── start.sh              #     PulseAudio + bot başlatma
│   │   └── requirements.txt      #     Python bağımlılıkları
│   │
│   └── summarizer/               #   AI Summarizer (FastAPI)
│       ├── main.py               #     FastAPI uygulama başlatma
│       ├── summarizer.py         #     Özetleme mantığı
│       ├── transcriber.py        #     Whisper transkripsiyon
│       ├── chat.py               #     Sohbet endpoint'i
│       ├── database.py           #     Supabase bağlantısı
│       ├── models.py             #     Pydantic modelleri
│       ├── config.py             #     Ortam değişkeni okuma
│       ├── requirements.txt      #     Python bağımlılıkları
│       └── tests/                #     pytest birim testleri
│
├── supabase/
│   └── snippets/                 #   SQL migration ve policy dosyaları
│
├── tests/
│   ├── e2e/                      #   Playwright E2E testleri
│   ├── integration/              #   Node.js entegrasyon testleri
│   ├── fixtures/                 #   Test verileri (ses dosyası)
│   └── helpers/                  #   Test yardımcıları
│
├── public/                       #   Vite public assets
├── .env / .env.example           #   Ortam değişkenleri
├── start.sh / start.ps1          #   Tüm servisleri başlatma script'leri
├── vite.config.ts                #   Vite yapılandırması
├── playwright.config.ts          #   Playwright test yapılandırması
├── package.json                  #   Node.js bağımlılıkları ve script'ler
└── tsconfig.*.json               #   TypeScript yapılandırmaları
```

---

Bu rehber, projenin teknik altyapısını, kararlarını ve işleyişini anlamak için kapsamlı bir referans niteliğindedir. Yeni bir özellik eklerken, hata ayıklarken veya mimari bir değişiklik yaparken bu dokümana başvurulması önerilir.
