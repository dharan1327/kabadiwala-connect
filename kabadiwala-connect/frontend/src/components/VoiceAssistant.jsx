import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { CATEGORIES } from '../lib/constants.js';

// Spoken phrases per language. Only English is reviewed for the demo. Tamil and Hindi phrases
// are starting points and must be checked by native speakers before public use.
export const PHRASES = {
  'en-IN': { heard: 'You said', none: 'Sorry, I could not match a scrap category. Please try again or choose it manually.' },
  'ta-IN': { heard: 'நீங்கள் சொன்னது', none: 'மன்னிக்கவும், வகையை அடையாளம் காண முடியவில்லை. மீண்டும் முயலவும் அல்லது கைமுறையாகத் தேர்வு செய்யவும்.' },
  'hi-IN': { heard: 'आपने कहा', none: 'माफ़ कीजिए, श्रेणी पहचान नहीं सका। कृपया फिर से कोशिश करें या मैन्युअली चुनें।' },
};

// Keyword lists for category selection. Extend and verify with native speakers.
const KEYWORDS = {
  paper: ['paper', 'newspaper', 'காகிதம்', 'காகித', 'कागज़', 'कागज'],
  cardboard: ['cardboard', 'carton', 'அட்டை', 'गत्ता'],
  plastic: ['plastic', 'பிளாஸ்டிக்', 'प्लास्टिक'],
  mixed_plastics: ['mixed plastic', 'mixed plastics'],
  iron: ['iron', 'இரும்பு', 'लोहा'],
  aluminium: ['aluminium', 'aluminum', 'அலுமினியம்', 'एल्युमिनियम'],
  copper: ['copper', 'செம்பு', 'तांबा'],
  glass: ['glass', 'கண்ணாடி', 'कांच'],
  circuit_boards: ['circuit', 'motherboard', 'மின்சுற்று', 'सर्किट'],
  cables: ['cable', 'wire', 'கேபிள்', 'केबल'],
  batteries: ['battery', 'batteries', 'பேட்டரி', 'बैटरी'],
  screens: ['screen', 'monitor', 'திரை', 'स्क्रीन'],
  motors: ['motor', 'மோட்டார்', 'मोटर'],
  other: ['other'],
};

export function parseCategory(text) {
  const t = (text || '').toLowerCase();
  for (const [code, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => t.includes(w.toLowerCase()))) return code;
  }
  return null;
}

export default function VoiceAssistant({ mode = 'category', onCategory, getReadout }) {
  const [lang, setLang] = useState('en-IN');
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [message, setMessage] = useState('');
  const recogRef = useRef(null);
  const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => () => recogRef.current?.abort?.(), []);

  const startListening = () => {
    if (!SR) {
      setMessage('Voice input is not supported in this browser. Please use Chrome or Edge, or type your choice.');
      return;
    }
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      if (mode === 'category') {
        const code = parseCategory(text);
        if (code) {
          onCategory?.(code);
          const cat = CATEGORIES.find((c) => c.value === code);
          setMessage(`${PHRASES[lang].heard}: "${text}" → ${cat.label}`);
        } else {
          setMessage(PHRASES[lang].none);
        }
      }
    };
    rec.onerror = (e) => setMessage(`Voice input stopped (${e.error}). Please check microphone permission.`);
    rec.onend = () => setListening(false);
    recogRef.current = rec;
    setListening(true);
    setMessage('');
    rec.start();
  };

  const stopListening = () => { recogRef.current?.stop(); setListening(false); };

  const speak = () => {
    if (!ttsSupported) {
      setMessage('Spoken responses are not supported in this browser.');
      return;
    }
    const text = getReadout?.(lang) || '';
    if (!text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang.slice(0, 2)));
    if (voice) u.voice = voice;
    else setMessage(`No ${lang} voice is installed on this device, so the browser default voice will be used.`);
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-forest">Voice assistant</p>
        <label className="text-sm">
          <span className="sr-only">Language</span>
          <select className="input !w-auto py-1.5 text-sm" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="en-IN">English</option>
            <option value="ta-IN">தமிழ் (Tamil)</option>
            <option value="hi-IN">हिन्दी (Hindi)</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {mode === 'category' && (
          <button className={listening ? 'btn-danger' : 'btn-primary'} onClick={listening ? stopListening : startListening}>
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {listening ? 'Stop' : 'Speak a category'}
          </button>
        )}
        <button className="btn-ghost" onClick={speak}><Volume2 className="h-4 w-4" /> Read out</button>
      </div>
      {listening && (
        <p className="flex items-center gap-2 text-sm text-red-700" aria-live="polite">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" /> Recording… speak now
        </p>
      )}
      {transcript && <p className="text-sm text-ink/70">Transcript: “{transcript}”</p>}
      {message && <p className="text-sm text-ink/80" aria-live="polite">{message}</p>}
    </div>
  );
}
