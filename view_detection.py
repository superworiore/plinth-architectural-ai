
import json
import webbrowser
from pathlib import Path
from html import escape

project_dir = Path(__file__).resolve().parent
response_file = project_dir / "api_response.json"
html_file = project_dir / "floorplan_detection_result.html"

if not response_file.exists():
    raise FileNotFoundError(
        f"API response not found: {response_file}"
    )

with response_file.open("r", encoding="utf-8") as file:
    result = json.load(file)

image_url = result.get("annotated_image")

if not image_url or not image_url.startswith("data:image/"):
    raise ValueError(
        "No annotated image found. Save the complete API response "
        "including the annotated_image field in api_response.json."
    )

detection_count = result.get("detection_count", 0)
width = result.get("image_width", "Unknown")
height = result.get("image_height", "Unknown")

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PLINTH AI Floor Plan Detection</title>
</head>
<body style="font-family:Arial,sans-serif;background:#f3f4ef;
margin:0;padding:24px;color:#263329">
<h1>PLINTH — Floor Plan AI</h1>
<p>Detected objects: <strong>{escape(str(detection_count))}</strong></p>
<p>Image dimensions: {escape(str(width))} × {escape(str(height))}</p>
<img src="{image_url}"
     alt="Annotated floor plan"
     style="max-width:100%;height:auto;border:1px solid #aaa">
<p>AI detections are estimates, not verified measurements
or building-code compliance results.</p>
</body>
</html>"""

html_file.write_text(html, encoding="utf-8")
webbrowser.open(html_file.resolve().as_uri())

print("Result saved to:", html_file)
