"""MinerU API client for PDF parsing.

Based on /home/binma/courseagent/docs/mineru_specification-v1.0.md
"""
import glob
import io
import json
import logging
import os
import time
import zipfile

import requests

logger = logging.getLogger(__name__)


class MinerUClient:
    def __init__(self, api_token: str | None = None, base_url: str | None = None):
        self.api_token = api_token or os.getenv("MINERU_API_TOKEN", "")
        self.base_url = (base_url or os.getenv("MINERU_BASE_URL", "https://mineru.net/api/v4")).rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

    def upload_pdf(self, pdf_path: str, data_id: str = "", language: str = "ch") -> str:
        """Upload PDF to MinerU API and return batch_id.

        Steps:
        1. POST /file-urls/batch → get batch_id + pre-signed upload URL
        2. PUT pre-signed URL (no Content-Type header!) → upload file binary
        """
        filename = os.path.basename(pdf_path)

        # Step 1: Get pre-signed URL
        resp = requests.post(
            f"{self.base_url}/file-urls/batch",
            headers=self.headers,
            json={
                "files": [{"name": filename, "data_id": data_id}],
                "enable_formula": True,
                "enable_table": True,
                "language": language,
            },
        )
        resp.raise_for_status()
        data = resp.json()["data"]
        batch_id = data["batch_id"]
        upload_url = data["file_urls"][0]
        logger.info(f"Got batch_id={batch_id}, uploading file...")

        # Step 2: Upload file (bare PUT, no Content-Type)
        with open(pdf_path, "rb") as f:
            put_resp = requests.put(upload_url, data=f)
        put_resp.raise_for_status()
        logger.info(f"File uploaded successfully")

        return batch_id

    def poll_results(self, batch_id: str, timeout: int = 300, interval: int = 5) -> dict:
        """Poll until parsing is done or timeout. Returns result dict."""
        start = time.time()
        while time.time() - start < timeout:
            resp = requests.get(
                f"{self.base_url}/extract-results/batch/{batch_id}",
                headers=self.headers,
            )
            resp.raise_for_status()
            result = resp.json()["data"]["extract_result"][0]
            state = result["state"]

            if state == "done":
                logger.info(f"Parsing done, zip_url available")
                return result
            elif state == "failed":
                raise RuntimeError(f"MinerU parsing failed: {result.get('err_msg', 'unknown')}")

            elapsed = int(time.time() - start)
            logger.info(f"State: {state} ({elapsed}s elapsed)")
            time.sleep(interval)

        raise TimeoutError(f"MinerU parsing timed out after {timeout}s")

    def download_and_extract(self, zip_url: str, output_dir: str) -> str:
        """Download ZIP and extract. Returns path to content_list.json."""
        os.makedirs(output_dir, exist_ok=True)

        resp = requests.get(zip_url)
        resp.raise_for_status()

        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            zf.extractall(output_dir)
        logger.info(f"Extracted to {output_dir}")

        # Find content_list.json (filename has UUID prefix)
        matches = glob.glob(os.path.join(output_dir, "*content_list.json"))
        if not matches:
            raise FileNotFoundError(f"No *content_list.json found in {output_dir}")

        return matches[0]

    def parse_pdf(self, pdf_path: str, output_dir: str | None = None) -> list[dict]:
        """Complete flow: upload → poll → download → return content_list.

        Args:
            pdf_path: Path to PDF file
            output_dir: Directory to store extracted results. Default: ./output/{filename}/

        Returns:
            content_list as Python list of dicts
        """
        filename = os.path.splitext(os.path.basename(pdf_path))[0]
        if output_dir is None:
            output_dir = os.path.join(os.path.dirname(pdf_path), "output", filename)

        batch_id = self.upload_pdf(pdf_path, data_id=filename)
        result = self.poll_results(batch_id)
        content_list_path = self.download_and_extract(result["full_zip_url"], output_dir)

        with open(content_list_path, "r", encoding="utf-8") as f:
            content_list = json.load(f)

        logger.info(f"Got {len(content_list)} blocks from {pdf_path}")
        return content_list
