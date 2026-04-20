"""ASR client: extract audio from video via ffmpeg, transcribe via SiliconFlow ASR API."""
import logging
import os
import subprocess
import tempfile

import requests

logger = logging.getLogger(__name__)

MAX_AUDIO_BYTES = 25 * 1024 * 1024  # 25 MB per segment
SEGMENT_MINUTES = 10


class ASRClient:
    def __init__(
        self,
        api_key: str = "",
        base_url: str = "",
        model: str = "",
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model

    def extract_audio(self, video_path: str, output_path: str | None = None) -> str:
        """Extract audio from video to 16kHz mono WAV."""
        if output_path is None:
            tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            output_path = tmp.name
            tmp.close()

        cmd = [
            "ffmpeg", "-i", video_path,
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            "-y", output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {result.stderr[:500]}")
        return output_path

    def split_audio(self, wav_path: str, segment_minutes: int = SEGMENT_MINUTES) -> list[str]:
        """Split large WAV into timed segments."""
        segments: list[str] = []
        cmd = [
            "ffmpeg", "-i", wav_path,
            "-f", "null", "-",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        duration = 0.0
        for line in result.stderr.splitlines():
            if "time=" in line:
                time_str = line.split("time=")[-1].split()[0]
                parts = time_str.split(":")
                duration = float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])

        seg_seconds = segment_minutes * 60
        num_segs = int(duration / seg_seconds) + 1
        if num_segs <= 1:
            return [wav_path]

        for i in range(num_segs):
            tmp = tempfile.NamedTemporaryFile(suffix=f"_seg{i}.wav", delete=False)
            seg_path = tmp.name
            tmp.close()
            start = i * seg_seconds
            cmd = [
                "ffmpeg", "-i", wav_path, "-ss", str(start), "-t", str(seg_seconds),
                "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                "-y", seg_path,
            ]
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if r.returncode == 0 and os.path.getsize(seg_path) > 0:
                segments.append(seg_path)
            else:
                os.unlink(seg_path)
        return segments or [wav_path]

    def transcribe(self, audio_path: str) -> str:
        """Transcribe a single audio file via ASR API (multipart form)."""
        url = f"{self.base_url}/audio/transcriptions"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        filename = os.path.basename(audio_path)
        with open(audio_path, "rb") as f:
            files = {
                "file": (filename, f),
                "model": (None, self.model),
            }
            resp = requests.post(url, headers=headers, files=files, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        return data.get("text", "").strip()

    def transcribe_video(self, video_path: str) -> str:
        """Full pipeline: extract audio → split if large → transcribe → concatenate."""
        wav_path = None
        segments = []
        try:
            wav_path = self.extract_audio(video_path)
            file_size = os.path.getsize(wav_path)
            if file_size > MAX_AUDIO_BYTES:
                segments = self.split_audio(wav_path)
            else:
                segments = [wav_path]

            full_text = []
            for i, seg in enumerate(segments):
                logger.info(f"[asr] Transcribing segment {i + 1}/{len(segments)}")
                text = self.transcribe(seg)
                if text:
                    full_text.append(text)

            return "\n".join(full_text)
        finally:
            if wav_path and os.path.exists(wav_path):
                os.unlink(wav_path)
            for seg in segments:
                if seg != wav_path and os.path.exists(seg):
                    os.unlink(seg)
