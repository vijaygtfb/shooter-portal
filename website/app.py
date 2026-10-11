from __future__ import annotations

import base64
import json
import re
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
ENTRY_FILE = "index-DMOemp9J.js"
MOCK_FILE = "server-DumS0e95.js"
CSS_FILE = "index-DQ_S4IMO.css"

st.set_page_config(page_title="Shooter ID Portal", layout="wide", initial_sidebar_state="collapsed")
st.markdown(
    """
    <style>
      #MainMenu, footer, header { visibility: hidden; }
      .block-container { max-width: 100%; padding: 0; }
      iframe[title="streamlit.components.v1.html"] { display: block; }
    </style>
    """,
    unsafe_allow_html=True,
)


def read_asset(name: str) -> str:
    path = ASSETS / name
    if not path.is_file():
        raise FileNotFoundError(f"Required frontend asset is missing: {path}")
    return path.read_text(encoding="utf-8")


def data_url(name: str) -> str:
    raw = (ASSETS / name).read_bytes()
    suffix = Path(name).suffix.lower()
    mime = {".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".eot": "application/vnd.ms-fontobject", ".svg": "image/svg+xml"}.get(suffix, "application/octet-stream")
    return f"data:{mime};base64,{base64.b64encode(raw).decode('ascii')}"


def export_mapping(source: str) -> tuple[str, str]:
    match = re.search(r"export\s*\{([^}]+)\}\s*;?\s*$", source)
    if not match:
        raise ValueError("Could not find the React entry bundle exports")
    bindings = []
    for item in match.group(1).split(","):
        parts = item.strip().split(" as ")
        if len(parts) == 2:
            local, public = parts
        else:
            local = public = parts[0]
        bindings.append(f"{json.dumps(public)}:{local}")
    assignment = "window.__APP_MODULE_EXPORTS__={" + ",".join(bindings) + "};"
    return source[: match.start()] + match.group(0) + "\n" + assignment, match.group(1)


def make_mock_module(source: str) -> str:
    pattern = re.compile(r'import\s*\{([^}]+)\}\s*from\s*[\'"]\./index-DMOemp9J\.js[\'"];?')
    match = pattern.search(source)
    if not match:
        raise ValueError("Could not resolve the mock server's React bundle import")
    bindings = []
    for item in match.group(1).split(","):
        parts = item.strip().split(" as ")
        if len(parts) == 2:
            public, local = parts
        else:
            public = local = parts[0]
        bindings.append(f"{public}:{local}")
    replacement = "const {" + ",".join(bindings) + "}=window.__APP_MODULE_EXPORTS__;"
    return source[: match.start()] + replacement + source[match.end() :]


entry, _ = export_mapping(read_asset(ENTRY_FILE))
entry = entry.replace(
    'import("./server-DumS0e95.js")',
    'import(window.__APP_MODULE_URLS__["server-DumS0e95.js"])',
)
mock = make_mock_module(read_asset(MOCK_FILE))
css = read_asset(CSS_FILE)
css = re.sub(
    r"url\((['\"]?)(/assets/([^)'\"]+))\1\)",
    lambda match: "url(" + data_url(match.group(3).split("?", 1)[0].split("#", 1)[0]) + ")",
    css,
)
config_path = ROOT / "config.js"
config = config_path.read_text(encoding="utf-8") if config_path.is_file() else 'window.__APP_CONFIG__={useMockApi:true};'

# The Streamlit iframe has no filesystem URL for the Vite chunks. Load the mock
# server as a Blob module, and expose entry exports so the server can import them.
page = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shooter ID Portal</title>
  <style>{css}</style>
  <style>html,body,#root{{margin:0;width:100%;min-height:100%;font-family:Inter var,sans-serif}}body{{overflow:auto}}</style>
</head>
<body>
  <div id="root"></div>
  <script>{config}</script>
  <script>
    window.__APP_MODULE_EXPORTS__ = {{}};
    const mockSource = {json.dumps(mock)};
    const mockUrl = URL.createObjectURL(new Blob([mockSource], {{type: "text/javascript"}}));
    window.__APP_MODULE_URLS__ = {{"server-DumS0e95.js": mockUrl}};
  </script>
  <script type="module">{entry}</script>
</body>
</html>"""

components.html(page, height=1100, scrolling=True)
