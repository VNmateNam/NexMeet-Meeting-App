"""
NexMeet – Python Whisper Transcription Service
Receives audio chunks via HTTP and returns transcription text.
Optionally connects to Socket.IO to broadcast live transcriptions.
"""

import os
import io
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
import openai

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", os.getenv("CLIENT_URL", "")])

# Initialize OpenAI client (Whisper API)
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SUPPORTED_FORMATS = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg"}
MAX_FILE_SIZE_MB = 25


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "nexmeet-whisper"})


@app.route("/transcribe", methods=["POST"])
def transcribe():
    """
    Accepts audio file upload and returns transcription.

    Form fields:
    - audio: audio file (required)
    - language: BCP-47 language code e.g. 'en' (optional)
    - speaker: speaker name for the transcript line (optional)
    - room_id: meeting room ID (optional, for logging)
    - prompt: Whisper prompt to improve accuracy (optional)
    """
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]
    language = request.form.get("language", "en")
    speaker = request.form.get("speaker", "Speaker")
    prompt = request.form.get("prompt", "Meeting transcription. Proper nouns and technical terms.")

    # Validate file size
    audio_file.seek(0, 2)  # seek to end
    file_size_mb = audio_file.tell() / (1024 * 1024)
    audio_file.seek(0)

    if file_size_mb > MAX_FILE_SIZE_MB:
        return jsonify({"error": f"File too large. Max {MAX_FILE_SIZE_MB}MB"}), 413

    # Write to temp file for Whisper
    suffix = os.path.splitext(audio_file.filename or "audio.webm")[1] or ".webm"
    if suffix.lower() not in SUPPORTED_FORMATS:
        suffix = ".webm"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as f:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language=language,
                prompt=prompt,
                response_format="verbose_json",
                timestamp_granularities=["word"],
            )

        result = {
            "success": True,
            "text": transcript.text.strip(),
            "speaker": speaker,
            "language": transcript.language,
            "duration": transcript.duration,
            "words": [
                {"word": w.word, "start": w.start, "end": w.end}
                for w in (transcript.words or [])
            ],
        }
        return jsonify(result)

    except openai.APIError as e:
        return jsonify({"error": f"OpenAI API error: {str(e)}"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.route("/transcribe/url", methods=["POST"])
def transcribe_url():
    """
    Transcribe from a URL (e.g. pre-signed S3 URL).
    Body: { url, language?, speaker?, prompt? }
    """
    data = request.get_json()
    if not data or "url" not in data:
        return jsonify({"error": "url is required"}), 400

    import urllib.request

    url = data["url"]
    speaker = data.get("speaker", "Speaker")
    language = data.get("language", "en")
    prompt = data.get("prompt", "")

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        urllib.request.urlretrieve(url, tmp.name)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as f:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language=language,
                prompt=prompt,
            )
        return jsonify({"success": True, "text": transcript.text.strip(), "speaker": speaker})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


if __name__ == "__main__":
    port = int(os.getenv("WHISPER_PORT", 8000))
    debug = os.getenv("FLASK_ENV") == "development"
    print(f"\n🎙️  NexMeet Whisper Service running on port {port}")
    print(f"🔑  OpenAI key: {'✓ Set' if os.getenv('OPENAI_API_KEY') else '✗ Missing'}\n")
    app.run(host="0.0.0.0", port=port, debug=debug)
