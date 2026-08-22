// Speech-to-Text service with a graceful fallback chain.
// 1. Native Web Speech API (Chrome / Edge / Android)
// 2. MediaRecorder capture -> POST /api/transcribe (Workers AI Whisper, live API only)
// 3. Typed input (UI degrades with a clear message)
import { API } from './api.js';

class SpeechService {
  constructor() {
    this._recognition = null;
    this._mediaRecorder = null;
    this._chunks = [];
    this._stream = null;
    this._active = false;
    this._mode = null; // 'native' | 'server'
  }

  getCapabilities() {
    const nativeSTT = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const mediaRecorder = typeof window.MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    const serverASR = !this.useMockServer();
    return { nativeSTT, mediaRecorder, serverASR };
  }

  useMockServer() {
    // Server ASR only exists once the Cloudflare Worker endpoint is configured.
    return API.useMock;
  }

  /**
   * Begin listening. Returns 'native', 'server', or 'unsupported'.
   * handlers: { onInterim(text), onResult(text), onError(message), onEnd() }
   */
  startListening(handlers = {}) {
    if (this._active) return this._mode;
    const caps = this.getCapabilities();

    if (caps.nativeSTT) {
      this._mode = 'native';
      this._startNative(handlers);
      return this._mode;
    }

    if (caps.mediaRecorder && caps.serverASR) {
      this._mode = 'server';
      this._startServerASR(handlers);
      return this._mode;
    }

    return 'unsupported';
  }

  _startNative(handlers) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this._recognition = new SpeechRecognition();
    this._recognition.lang = 'en-IN';
    this._recognition.interimResults = true;
    this._recognition.continuous = true;

    this._recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      if (interim && handlers.onInterim) handlers.onInterim(interim);
      if (finalText && handlers.onResult) handlers.onResult(finalText);
    };

    this._recognition.onerror = (event) => {
      if (handlers.onError) handlers.onError(event.error);
    };

    this._recognition.onend = () => {
      this._active = false;
      if (handlers.onEnd) handlers.onEnd();
    };

    this._recognition.start();
    this._active = true;
  }

  async _startServerASR(handlers) {
    try {
      this._chunks = [];
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._mediaRecorder = new MediaRecorder(this._stream);
      this._mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this._chunks.push(e.data);
      };
      this._mediaRecorder.onstop = async () => {
        this._teardownStream();
        try {
          const blob = new Blob(this._chunks, { type: this._mediaRecorder.mimeType || 'audio/webm' });
          const text = await this._transcribe(blob);
          if (text && handlers.onResult) handlers.onResult(text);
        } catch (err) {
          if (handlers.onError) handlers.onError(err.message || 'Transcription failed');
        } finally {
          this._active = false;
          if (handlers.onEnd) handlers.onEnd();
        }
      };
      this._mediaRecorder.start();
      this._active = true;
    } catch (err) {
      this._active = false;
      if (handlers.onError) handlers.onError('Microphone permission denied or unavailable.');
    }
  }

  async _transcribe(audioBlob) {
    // Future Workers AI endpoint: @cf/openai/whisper with en-IN prompt hint.
    const res = await fetch(`${API.baseUrl}/transcribe`, { method: 'POST', body: audioBlob });
    if (!res.ok) throw new Error(`Transcription service error (${res.status})`);
    const data = await res.json();
    return data.text || '';
  }

  _teardownStream() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
  }

  stopListening() {
    if (!this._active) return;
    if (this._mode === 'native' && this._recognition) {
      this._recognition.stop(); // onend fires the handler
    } else if (this._mode === 'server' && this._mediaRecorder) {
      this._mediaRecorder.stop(); // onstop transcribes and fires onEnd
    }
  }

  isListening() {
    return this._active;
  }
}

export const Speech = new SpeechService();
