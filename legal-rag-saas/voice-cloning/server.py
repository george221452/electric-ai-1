import os
os.environ["COQUI_TOS_AGREED"] = "1"

import torch
import warnings
warnings.filterwarnings('ignore')

# Fix for PyTorch 2.6+ weights_only - only if function exists
try:
    if hasattr(torch.serialization, 'add_safe_globals'):
        torch.serialization.add_safe_globals([
            'TTS.tts.configs.xtts_config.XttsConfig',
            'TTS.tts.models.xtts.Xtts',
            'TTS.tts.models.xtts.XttsArgs',
        ])
except:
    pass

# Fix for older torch versions
try:
    import zipfile
    original_init = torch.serialization._init_zipfile_reader
    def patched_init(self, name_or_buffer, **kwargs):
        kwargs['weights_only'] = False
        return original_init(self, name_or_buffer, **kwargs)
    torch.serialization._init_zipfile_reader = patched_init
except:
    pass

from TTS.api import TTS
import tempfile
import soundfile as sf
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Global TTS model
tts = None
device = None

def load_model():
    """Load XTTS v2 model"""
    global tts, device
    
    if torch.cuda.is_available():
        device = "cuda"
        print("🚀 Using CUDA")
    else:
        device = "cpu"
        print("💻 Using CPU")
    
    print("⏳ Loading XTTS v2 model...")
    try:
        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=(device == "cuda"))
        print("✅ Model loaded successfully!")
        return True
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        import traceback
        traceback.print_exc()
        return False

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy" if tts else "loading",
        "model": "xtts_v2",
        "device": device
    })

@app.route('/speak', methods=['POST'])
def speak():
    """Generate speech from text using voice clone"""
    global tts
    
    if not tts:
        return jsonify({"error": "Model not loaded"}), 503
    
    try:
        data = request.get_json()
        text = data.get('text', '')
        speaker_wav = data.get('speaker_wav', '') or data.get('voice_id', '')
        language = data.get('language', 'pl')  # Folosim 'pl' pentru română (cel mai apropiat fonetic)
        
        if not text:
            return jsonify({"error": "No text provided"}), 400
        
        # Use default voice if no speaker_wav provided
        if not speaker_wav or not os.path.exists(speaker_wav):
            # Try to find any voice sample
            samples_dir = "/app/voice-samples"
            if os.path.exists(samples_dir):
                for f in os.listdir(samples_dir):
                    if f.endswith(('.wav', '.mp3')):
                        speaker_wav = os.path.join(samples_dir, f)
                        break
        
        # Generate speech
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            output_path = tmp.name
        
        if speaker_wav and os.path.exists(speaker_wav):
            # Clone voice
            tts.tts_to_file(
                text=text,
                speaker_wav=speaker_wav,
                language=language,
                file_path=output_path
            )
        else:
            # Use default speaker
            tts.tts_to_file(
                text=text,
                file_path=output_path
            )
        
        return send_file(output_path, mimetype='audio/wav')
        
    except Exception as e:
        print(f"Error generating speech: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/voices', methods=['GET'])
def list_voices():
    """List available voice samples"""
    voices = []
    samples_dir = "/app/voice-samples"
    if os.path.exists(samples_dir):
        for f in os.listdir(samples_dir):
            if f.endswith(('.wav', '.mp3', '.webm')):
                voices.append({
                    "name": f.replace('.wav', '').replace('.mp3', '').replace('.webm', ''),
                    "file": f,
                    "path": os.path.join(samples_dir, f)
                })
    return jsonify({"voices": voices})

if __name__ == '__main__':
    # Load model at startup
    load_model()
    
    # Start server
    print("🎙️ Voice cloning server starting on port 7860...")
    app.run(host='0.0.0.0', port=7860, threaded=True)
