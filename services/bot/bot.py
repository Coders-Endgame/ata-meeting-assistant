import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime

import numpy as np
import requests
import soundcard as sc
from faster_whisper import WhisperModel
from playwright.async_api import async_playwright
from supabase import Client, create_client

# Configure Logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)


class ZoomBot:
    def __init__(self, meeting_url, bot_name="ASR Bot", session_id=None):
        self.meeting_url = meeting_url
        self.bot_name = bot_name
        self.session_id = session_id
        self.browser = None
        self.page = None
        self.playwright = None
        self.is_running = False
        self.current_speaker = "Unknown"

        # Initialize Supabase client
        self.supabase: Client = None
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

        if supabase_url and supabase_key:
            try:
                self.supabase = create_client(supabase_url, supabase_key)
                logging.info("Supabase client initialized successfully")
            except Exception as e:
                logging.error(f"Failed to initialize Supabase client: {e}")
        else:
            logging.warning(
                "Supabase credentials not found. Transcripts will only be saved locally."
            )

        # Extract Meeting ID for filename
        import re

        self.meeting_id = "unknown"
        try:
            # Look for 9-11 digit numbers which are likely meeting IDs
            match = re.search(r"(\d{9,11})", meeting_url)
            if match:
                self.meeting_id = match.group(1)
        except:
            pass

        # Server URL for status reporting
        self.server_url = os.environ.get(
            "SERVER_URL", "http://host.docker.internal:3001"
        )

        # Create output directory
        if not os.path.exists("transcripts"):
            os.makedirs("transcripts")

        self.transcript_file = f"transcripts/transcript_{self.meeting_id}.json"
        # Load Configuration
        self.allowed_languages = None
        self.model_size = "small"
        self.device = None
        self.compute_type = None
        # Read per-session language from env (set by API when starting the bot)
        self.transcription_language = os.environ.get(
            "TRANSCRIPTION_LANGUAGE"
        )  # e.g. 'en' or 'tr'

        try:
            with open("config.json", "r") as f:
                config = json.load(f)
                self.allowed_languages = config.get("allowed_languages")
                self.model_size = config.get("model_size", "small")
                # self.device and self.compute_type are now determined at runtime

                if self.allowed_languages:
                    logging.info(f"Allowed languages: {self.allowed_languages}")

        except FileNotFoundError:
            logging.warning("Config file not found. Using defaults (small model).")
        except Exception as e:
            logging.error(f"Error loading config: {e}")

        if self.transcription_language:
            logging.info(
                f"Transcription language fixed to: {self.transcription_language} (Whisper will skip auto-detection)"
            )

        # Determine Device and Compute Type
        import torch

        if torch.cuda.is_available():
            self.device = "cuda"
            self.compute_type = "float16"
        else:
            self.device = "cpu"
            self.compute_type = "int8"

        logging.info(
            f"Model Config: {self.model_size} on {self.device} ({self.compute_type})"
        )

        # Initialize ASR Model
        logging.info(f"Loading Whisper Model ({self.model_size})...")
        try:
            self.model = WhisperModel(
                self.model_size, device=self.device, compute_type=self.compute_type
            )  # first its checking the cache
        except Exception as e:
            logging.error(
                f"Failed to load model on {self.device}, falling back to cpu/small: {e}"
            )
            self.model = WhisperModel("small", device="cpu", compute_type="int8")
        logging.info("Whisper Model Loaded.")

    def report_status(self, status):
        """Report bot status to the server"""
        if not self.session_id:
            return
        try:
            response = requests.post(
                f"{self.server_url}/api/bot/status/{self.session_id}",
                json={"status": status},
                timeout=5,
            )
            if response.ok:
                logging.info(f"Status reported: {status}")
            else:
                logging.warning(f"Failed to report status: {response.text}")
        except Exception as e:
            logging.warning(f"Could not report status to server: {e}")

    def convert_to_web_client_url(self, zoom_url):
        # Extract meeting ID and password
        import re

        try:
            # Examples:
            # https://zoom.us/j/1234567890?pwd=xxxxx
            # https://us02web.zoom.us/j/1234567890?pwd=xxxxx

            # Simple regex to capture the ID after /j/ or /wc/
            # match = re.search(r"/j/(\d+)", zoom_url)
            # if not match:
            #     match = re.search(r"/wc/(\d+)", zoom_url)

            # Using split as in the TS example provided by user, but adapted for Python
            if "/j/" in zoom_url:
                base = zoom_url.split("/j/")[0]
                remainder = zoom_url.split("/j/")[1]
            elif "/wc/" in zoom_url:
                base = zoom_url.split("/wc/")[0]
                remainder = zoom_url.split("/wc/")[1]
            else:
                return zoom_url  # Return original if pattern not found

            if "?" in remainder:
                meeting_id = remainder.split("?")[0]
                pwd_part = remainder.split("?")[1]
                # Clean up if ID has /join or similar
                meeting_id = meeting_id.replace("/join", "")
                return f"https://app.zoom.us/wc/{meeting_id}/join?{pwd_part}"
            else:
                meeting_id = remainder.replace("/join", "")
                return f"https://app.zoom.us/wc/{meeting_id}/join"

        except Exception as e:
            logging.error(f"Error converting URL: {e}")
            return zoom_url

    async def start_browser(self, headless=True):
        logging.info(f"Starting Browser (Headless: {headless})...")
        self.playwright = await async_playwright().start()

        args = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--disable-web-security",
            "--allow-running-insecure-content",
            "--start-maximized",
        ]

        self.browser = await self.playwright.chromium.launch(
            headless=headless,
            args=args,
            ignore_default_args=[
                "--mute-audio"
            ],  # Ensure we don't mute by default if PW does that
        )
        self.page = await self.browser.new_page()

        # Set viewport matching TS example
        await self.page.set_viewport_size({"width": 1920, "height": 1080})

        # User Agent
        await self.page.set_extra_http_headers(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        )

        # Permissions
        context = self.browser.contexts[0]
        await context.grant_permissions(
            ["microphone", "camera"]
        )  # We'll mute them later

        # Navigate
        target_url = self.convert_to_web_client_url(self.meeting_url)
        logging.info(f"Navigating to {target_url}")

        try:
            await self.page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
        except Exception as e:
            logging.error(f"Navigation error: {e}")

        # Join Logic (Ported from TS)
        logging.info("Waiting for join interface...")
        self.report_status("joining")  # Report joining status

        # Wait for the Zoom join UI to fully render (SPA needs time after DOM ready)
        join_ui_selectors = ", ".join([
            'input[type="text"]',
            "input#inputname",
            'input[placeholder*="name"]',
            'input[placeholder*="Name"]',
            "#input-for-name",
            "input.preview-meeting-info-field-input",
            "button.preview-join-button",
            "button.zm-btn--primary",
            "#joinBtn",
        ])
        try:
            await self.page.locator(join_ui_selectors).first.wait_for(
                state="visible", timeout=45000
            )
            logging.info("Join UI is ready")
        except Exception as e:
            logging.warning(f"Join UI elements not found within timeout, proceeding anyway: {e}")
        await asyncio.sleep(2)

        # Name Input
        name_input_selectors = [
            'input[type="text"]',
            "input#inputname",
            'input[placeholder*="name"]',
            'input[placeholder*="Name"]',
            "#input-for-name",
            "input.preview-meeting-info-field-input",
            '[data-testid="name-input"]',
        ]

        name_input = None
        for sel in name_input_selectors:
            try:
                if await self.page.locator(sel).first.is_visible(timeout=2000):
                    name_input = self.page.locator(sel).first
                    logging.info(f"Found name input: {sel}")
                    break
            except:
                continue

        if name_input:
            await name_input.click(click_count=3)
            await asyncio.sleep(0.2)
            await name_input.fill(self.bot_name)
            logging.info(f"Entered bot name: {self.bot_name}")
        else:
            logging.info("No name input found, continuing...")

        await asyncio.sleep(1)

        # Join Button
        join_btn_selectors = [
            "button.preview-join-button",
            "button.zm-btn--primary",
            'button[type="submit"]',
            "#joinBtn",
            "button.btn-join",
            '[data-testid="join-btn"]',
            "button.join-btn",
            'button[class*="join"]',
            'button[class*="Join"]',
            ".preview-meeting-info-btn",
        ]

        button_clicked = False
        for sel in join_btn_selectors:
            try:
                # TS logic checks visibility specifically
                btn = self.page.locator(sel).first
                if await btn.is_visible(timeout=1000):
                    await btn.click(force=True)
                    logging.info(f"Clicked join button: {sel}")
                    button_clicked = True
                    break
            except:
                continue

        if not button_clicked:
            logging.info("No join button clicked, trying Enter...")
            await self.page.keyboard.press("Enter")

        await asyncio.sleep(8)

        # Post-Join Dialogs (Audio/Video/TOS)

        # TOS ("Agree")
        try:
            agree_btn = self.page.locator(
                'button:has-text("Agree"), button:has-text("I Agree")'
            ).first
            if await agree_btn.is_visible(timeout=2000):
                await agree_btn.click(force=True)
                logging.info("Clicked TOS Agree")
        except:
            pass

        # Join Audio
        audio_selectors = [
            'button[data-testid="join-audio-by-computer"]',
            'button:has-text("Join Audio by Computer")',
            "button.join-audio-by-voip",
            '[class*="audio-option"]',
        ]
        for sel in audio_selectors:
            try:
                btn = self.page.locator(sel).first
                if await btn.is_visible(timeout=2000):
                    await btn.click(force=True)
                    logging.info(f"Clicked Join Audio: {sel}")
                    break
            except:
                continue

        # Post-join Mute (Ported from TS)
        # We want to mute output? No, we want to mute input (mic) but keep output (speakers) for loopback.
        # TS code "muteAudioVideo" mutes Mic and Video. We should do that.

        mute_audio_selectors = [
            'button[aria-label*="mute"]',
            'button[aria-label*="Mute"]',
            ".audio-button",
            '[data-testid="microphone-button"]',
        ]

        for sel in mute_audio_selectors:
            try:
                btn = self.page.locator(sel).first
                if await btn.is_visible(timeout=1000):
                    aria_label = await btn.get_attribute("aria-label") or ""
                    if "unmute" not in aria_label.lower():
                        await btn.click(force=True)
                        logging.info("Muted Mic")
                    break
            except:
                continue

        logging.info("Join flow completed.")
        self.report_status("active")  # Report active status after joining

    async def update_speaker(self):
        """Polls the DOM to find the active speaker and detect meeting end"""
        while self.is_running:
            try:
                # Check if meeting has ended
                await self.check_meeting_ended()

                # Zoom web client usually highlights the active speaker.
                # Class mapping often changes.
            except Exception as e:
                logging.debug(f"Speaker update error: {e}")
            await asyncio.sleep(2)

    async def check_meeting_ended(self):
        """Check if the meeting has ended by looking for end indicators"""
        try:
            # Common indicators that meeting has ended
            end_selectors = [
                # "Meeting has ended" or "The host has ended this meeting" messages
                'div:has-text("meeting has ended")',
                'div:has-text("Meeting has ended")',
                'div:has-text("host has ended")',
                'div:has-text("Host has ended")',
                'div:has-text("This meeting has been ended")',
                'div:has-text("removed from meeting")',
                'div:has-text("Removed from meeting")',
                # Rejoin or feedback buttons that appear after meeting ends
                'button:has-text("Rejoin")',
                'button:has-text("Leave feedback")',
                '[class*="meeting-ended"]',
                '[class*="meetingEnded"]',
                # Page changed to non-meeting page
                '.zm-modal-body-title:has-text("ended")',
            ]

            for selector in end_selectors:
                try:
                    element = self.page.locator(selector).first
                    if await element.is_visible(timeout=500):
                        logging.info(f"Meeting end detected via: {selector}")
                        await self.shutdown("Meeting ended by host")
                        return
                except:
                    continue

            # Also check if we're no longer on a meeting page (redirected)
            current_url = self.page.url
            if (
                current_url
                and "/wc/" not in current_url
                and "zoom" not in current_url.lower()
            ):
                logging.info(f"Detected navigation away from meeting: {current_url}")
                await self.shutdown("Redirected away from meeting")
                return

        except Exception as e:
            logging.debug(f"Meeting end check error: {e}")

    async def shutdown(self, reason="Unknown"):
        """Gracefully shutdown the bot"""
        if not self.is_running:
            return

        logging.info(f"Shutting down bot: {reason}")
        self.is_running = False

        # Report ended status to server
        self.report_status("ended")

        # Close browser
        try:
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
        except Exception as e:
            logging.error(f"Error closing browser: {e}")

        logging.info("Bot shutdown complete")

        # Exit the process
        import sys

        sys.exit(0)

    def write_transcript(self, text):
        entry = {
            "timestamp": datetime.now().isoformat(),
            "speaker": self.current_speaker,
            "text": text,
        }

        # Write to local file
        try:
            with open(self.transcript_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry) + "\n")
            logging.info(f"[{self.current_speaker}] {text}")
        except Exception as e:
            logging.error(f"Error writing transcript to file: {e}")

        # Write to Supabase database
        if self.supabase and self.session_id:
            try:
                self.supabase.table("transcripts").insert(
                    {
                        "session_id": self.session_id,
                        "speaker": self.current_speaker,
                        "transcript": text,
                    }
                ).execute()
                logging.info(f"Transcript saved to database")
            except Exception as e:
                logging.error(f"Error writing transcript to database: {e}")

    def run_audio_sync(self):
        """
        Live audio transcription with low latency.
        Uses periodic transcription during continuous speech to reduce delay.
        Transcription runs in background threads to not block audio capture.
        """
        SAMPLE_RATE = 16000
        FRAME_DURATION = 0.1  # 100ms chunks for processing
        FRAME_SAMPLES = int(SAMPLE_RATE * FRAME_DURATION)
        
        # Silence detection thresholds
        SPEECH_THRESHOLD = 0.01  # Amplitude threshold to detect speech
        PAUSE_THRESHOLD = 0.3    # Silence threshold to trigger transcription (seconds)
        PERIODIC_TRANSCRIPTION_INTERVAL = 5.0  # Transcribe every 5s during continuous speech
        MAX_UTTERANCE_DURATION = 10  # Hard limit for utterance length
        
        logging.info("Starting Audio Loopback Capture (Live Mode)...")
        logging.info(f"Settings: pause_threshold={PAUSE_THRESHOLD}s, periodic_interval={PERIODIC_TRANSCRIPTION_INTERVAL}s")
        
        # Thread pool for background transcription
        from concurrent.futures import ThreadPoolExecutor
        executor = ThreadPoolExecutor(max_workers=2)
        pending_futures = []
        
        try:
            import platform

            is_linux = platform.system() == "Linux"

            if is_linux:
                mic = sc.default_microphone()
                logging.info(f"Using microphone: {mic.name}")
            else:
                default_speaker = sc.default_speaker()
                mic = sc.get_microphone(
                    id=str(default_speaker.name), include_loopback=True
                )
                logging.info(f"Using loopback of speaker: {default_speaker.name}")

            # State variables
            buffer = []  # Current audio buffer
            silence_dur = 0.0
            speech_dur = 0.0
            time_since_last_transcription = 0.0
            is_speaking = False
            chunk_num = 0
            
            def submit_transcription(audio_buffer, is_partial=False):
                """Submit buffer for background transcription."""
                nonlocal chunk_num
                if not audio_buffer:
                    return
                chunk_num += 1
                # Make a copy of the buffer data
                audio_copy = [f.copy() for f in audio_buffer]
                future = executor.submit(self._transcribe_buffer, audio_copy, chunk_num, is_partial)
                pending_futures.append(future)
            
            def cleanup_completed_futures():
                """Remove completed futures from the list."""
                nonlocal pending_futures
                pending_futures = [f for f in pending_futures if not f.done()]

            with mic.recorder(samplerate=SAMPLE_RATE) as recorder:
                logging.info("Audio recorder started, listening for speech...")
                
                while self.is_running:
                    # Record small frame (100ms)
                    frame = recorder.record(numframes=FRAME_SAMPLES)
                    frame_mono = frame.mean(axis=1).astype(np.float32)
                    
                    # Cleanup completed transcription tasks
                    cleanup_completed_futures()
                    
                    max_amp = np.max(np.abs(frame_mono))
                    is_speech = max_amp >= SPEECH_THRESHOLD
                    
                    if is_speech:
                        if not is_speaking:
                            logging.info("🟢 Speech detected, accumulating audio...")
                            is_speaking = True
                        
                        silence_dur = 0.0
                        speech_dur += FRAME_DURATION
                        time_since_last_transcription += FRAME_DURATION
                        buffer.append(frame_mono.copy())
                        
                        # Check for periodic transcription (during continuous speech)
                        if time_since_last_transcription >= PERIODIC_TRANSCRIPTION_INTERVAL:
                            if len(buffer) > 50:  # At least 5 seconds of audio
                                logging.info(f"📝 Periodic transcription after {speech_dur:.1f}s of speech...")
                                submit_transcription(buffer, is_partial=True)
                                time_since_last_transcription = 0.0
                                # Keep last 1 second for context (overlap)
                                overlap_frames = int(1.0 / FRAME_DURATION)
                                buffer = buffer[-overlap_frames:] if len(buffer) > overlap_frames else []
                                speech_dur = len(buffer) * FRAME_DURATION
                        
                        # Hard limit safety check
                        if speech_dur >= MAX_UTTERANCE_DURATION:
                            logging.info(f"⏱️ Max duration reached ({MAX_UTTERANCE_DURATION}s), transcribing...")
                            submit_transcription(buffer, is_partial=False)
                            buffer = []
                            speech_dur = 0.0
                            time_since_last_transcription = 0.0
                            
                    else:
                        # Silence detected
                        if is_speaking:
                            buffer.append(frame_mono.copy())
                            silence_dur += FRAME_DURATION
                            time_since_last_transcription += FRAME_DURATION
                            
                            # Check if silence threshold is reached
                            if silence_dur >= PAUSE_THRESHOLD:
                                logging.info(f"🔴 Pause detected ({silence_dur:.1f}s), transcribing...")
                                submit_transcription(buffer, is_partial=False)
                                
                                # Reset state
                                buffer = []
                                is_speaking = False
                                silence_dur = 0.0
                                speech_dur = 0.0
                                time_since_last_transcription = 0.0
                        else:
                            # Not speaking, just cleanup occasionally
                            if len(pending_futures) > 5:
                                cleanup_completed_futures()

        except Exception as e:
            logging.error(f"Audio processing error: {e}")
        finally:
            executor.shutdown(wait=False)
    
    def _transcribe_buffer(self, buffer, chunk_num, is_partial=False):
        """Transcribe accumulated audio buffer and save to database."""
        try:
            # Concatenate all frames
            audio_data = np.concatenate(buffer)
            duration = len(audio_data) / 16000  # SAMPLE_RATE
            
            # Skip if too quiet
            if np.max(np.abs(audio_data)) < 0.01:
                logging.debug("   ⚠️ Too quiet, skipped")
                return
            
            # Build transcribe kwargs - use faster settings for live mode
            transcribe_kwargs = dict(
                beam_size=3,  # Reduced from 5 for speed
                best_of=3,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=300),  # Reduced from 500
                condition_on_previous_text=True,  # Enable for better continuity
                no_speech_threshold=0.5,  # Lowered from 0.6
            )
            if self.transcription_language:
                transcribe_kwargs["language"] = self.transcription_language
            
            start_time = time.time()
            segments, info = self.model.transcribe(audio_data, **transcribe_kwargs)
            
            # Check allowed languages
            if (
                not self.transcription_language
                and self.allowed_languages
                and info.language not in self.allowed_languages
            ):
                logging.info(f"Detected language '{info.language}' is not allowed. Skipping.")
                return
            
            # Collect all text segments
            texts = [s.text.strip() for s in segments if s.text.strip()]
            if texts:
                full_text = " ".join(texts)
                proc_time = time.time() - start_time
                prefix = "📝" if is_partial else "🎯"
                logging.info(f"{prefix} [{chunk_num}] ({proc_time:.1f}s) {full_text[:100]}{'...' if len(full_text) > 100 else ''}")
                self.write_transcript(full_text)
            else:
                logging.debug(f"   ⚠️ No text detected in chunk {chunk_num}")
                
        except Exception as e:
            logging.error(f"Transcription error in chunk {chunk_num}: {e}")

    async def run(self, headless=True):
        self.is_running = True
        await self.start_browser(headless=headless)

        import threading

        # Start audio thread
        audio_thread = threading.Thread(target=self.run_audio_sync)
        audio_thread.start()

        speaker_task = asyncio.create_task(self.update_speaker())

        # Keep main loop alive
        await speaker_task


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Zoom ASR Bot")
    parser.add_argument("--url", type=str, help="Zoom Meeting URL")
    parser.add_argument(
        "--name", type=str, default="ATA Smart Meeting Assistant", help="Bot Name"
    )
    parser.add_argument(
        "--session-id", type=str, help="Session ID for database storage"
    )
    parser.add_argument("--headless", action="store_true", help="Run in headless mode")
    args = parser.parse_args()

    # Auto-detect headless environment (like Docker)
    if os.name == "posix" and "DISPLAY" not in os.environ and not args.headless:
        print("No DISPLAY detected. forcing headless mode.")
        args.headless = True

    if args.url:
        url = args.url
    else:
        print("Error: No URL provided. Use --url argument.")
        sys.exit(1)

    bot = ZoomBot(url, bot_name=args.name, session_id=args.session_id)
    asyncio.run(bot.run(headless=args.headless))
