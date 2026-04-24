# Ata Meeting Assistant — Akış Şemaları

Bu dokümanda uygulamanın temel sequence diyagramları yer almaktadır.

---

## 1. Kimlik Doğrulama & Session Oluşturma Akışı

```mermaid
sequenceDiagram
    actor U as Kullanıcı
    participant F as Frontend (React)
    participant SB as Supabase (Auth + DB)
    participant API as API Gateway (Express :3001)

    U->>F: Uygulamayı Aç
    F->>SB: OAuth/E-posta ile Giriş
    SB-->>F: Access Token + Kullanıcı Bilgisi

    U->>F: Zoom URL Gir / Ses Dosyası Seç
    alt Online Meeting (Zoom)
        F->>SB: Session Kaydı Oluştur (sessions + session_member)
        SB-->>F: session_id
        F->>API: POST /api/bot/start {sessionId, zoomUrl}
        API-->>F: Bot başlatma onayı
    else Offline Meeting (Ses Yükleme)
        F->>SB: Session Kaydı Oluştur
        SB-->>F: session_id
        F->>SB: Audio Dosyasını Storage'a Yükle
        SB-->>F: public audio_url
        F->>SB: Session source_url Güncelle
    end
    F->>F: /session/:sessionId sayfasına yönlendir
```

---

## 2. Zoom Bot ile Canlı Toplantı Akışı

```mermaid
sequenceDiagram
    actor U as Kullanıcı
    participant F as Frontend (React)
    participant API as API Gateway (Express)
    participant B as Zoom Bot (Docker + Playwright)
    participant Z as Zoom (Harici Servis)
    participant SB as Supabase (Realtime DB)
    participant S as Summarizer (FastAPI :8000)
    participant O as Ollama (LLM :11434)

    API->>B: Docker Container Başlat
    B->>Z: Toplantıya Katıl (Playwright)
    Z-->>B: Ses/Görüntü Akışı

    loop Ses Parçalarını Sürekli İşle
        B->>B: Ses Kaydet (PulseAudio)
        B->>B: Whisper ile Transkript Çıkar
        B->>SB: INSERT transcripts (speaker, text, timestamp)
    end

    SB-->>F: Realtime Subscription: Yeni Transkript
    F->>F: Transkript Listesini Güncelle

    opt Canlı Özet (Live Summary)
        F->>API: GET /api/bot/status/:sessionId
        API-->>F: Bot Aktif
        F->>S: POST /api/summarize {transcripts}
        S->>O: LLM Prompt Gönder
        O-->>S: Özet Metin + Action Items
        S-->>F: summary + action_items
        F->>SB: INSERT summaries + action_items
    end

    U->>F: Toplantıyı Bitir / Botu Durdur
    F->>API: POST /api/bot/stop {sessionId}
    API->>B: Container Durdur
    B-->>API: Bot Durdu Onayı
    API-->>F: Başarılı
```

---

## 3. Ses Yükleme, Transkripsiyon ve Özetleme Akışı

```mermaid
sequenceDiagram
    actor U as Kullanıcı
    participant F as Frontend (React)
    participant SB as Supabase (Storage + DB)
    participant API as API Gateway (Express)
    participant S as Summarizer (FastAPI :8000)
    participant O as Ollama (LLM :11434)

    U->>F: Ses Dosyası Seç & Yükle
    F->>SB: PUT storage/audio/:sessionId/:file
    SB-->>F: public URL

    U->>F: Transcribe & Summarize Butonu
    F->>API: POST /api/transcribe {audioUrl}
    API->>S: Forward isteği
    S->>S: Whisper ile Transkript Çıkar
    S-->>API: transcript listesi
    API-->>F: transcripts

    F->>SB: INSERT transcripts
    F->>SB: UPDATE session status

    U->>F: Generate Summary
    F->>API: POST /api/summarize {transcripts}
    API->>S: Forward isteği
    S->>O: Prompt: "Özet ve Action Item üret"
    O-->>S: JSON/Metin Yanıt
    S-->>API: summary + action_items
    API-->>F: Sonuç

    F->>SB: INSERT summaries + action_items
    SB-->>F: Kayıt Onayı
    F->>F: Ekranda Göster
```

---

## 4. Genel Mimari Özet (Basitleştirilmiş Tek Diyagram)

```mermaid
sequenceDiagram
    actor U as Kullanıcı
    participant F as Frontend (React + Vite)
    participant SB as Supabase (Auth, DB, Realtime, Storage)
    participant API as API Gateway (Express :3001)
    participant B as Zoom Bot (Docker, Python)
    participant S as Summarizer (FastAPI :8000)
    participant O as Ollama (LLM)

    U->>F: Giriş Yap
    F->>SB: Auth isteği
    SB-->>F: Kullanıcı oturumu

    U->>F: Toplantı Başlat (Zoom veya Ses Yükleme)

    alt Zoom Toplantısı
        F->>API: Bot Başlat
        API->>B: Docker container aç
        B->>SB: Transkript kaydet
        SB-->>F: Realtime güncelleme
    else Ses Dosyası
        F->>SB: Dosya yükle
        F->>API: Transcribe isteği
        API->>S: Whisper işlemi
        S-->>API: Transkript
        API-->>F: Sonuç
    end

    U->>F: Özet & Aksiyon Üret
    F->>API: Summarize isteği
    API->>S: Forward
    S->>O: LLM çağrısı
    O-->>S: Yanıt
    S-->>API: Özet + Action Items
    API-->>F: Sonuç
    F->>SB: Kaydet & Göster
```
