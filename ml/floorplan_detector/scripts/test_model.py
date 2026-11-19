from pathlib import Path
from ultralytics import YOLO

root = Path("ml/floorplan_detector")
weights = root / "weights" / "best.pt"
test_images = root / "dataset" / "test" / "images"

if not weights.exists():
    raise FileNotFoundError(f"Model not found: {weights}")

extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
images = sorted(
    p for p in test_images.iterdir()
    if p.is_file() and p.suffix.lower() in extensions
)

if not images:
    raise FileNotFoundError(
        f"No test images found in {test_images.resolve()}"
    )

image_path = images[0]
print(f"Testing image: {image_path}")

model = YOLO(str(weights))
results = model.predict(
    source=str(image_path),
    imgsz=640,
    conf=0.25,
    device="cpu",
    save=True,
    project=str(root / "runs"),
    name="first_prediction",
    exist_ok=True
)

result = results[0]
print("\nDetected objects:")

if result.boxes is None or len(result.boxes) == 0:
    print("No objects detected at confidence 0.25.")
else:
    for box in result.boxes:
        class_id = int(box.cls[0].item())
        confidence = float(box.conf[0].item())
        coords = [round(v, 1) for v in box.xyxy[0].tolist()]
        print(
            f"{model.names[class_id]} | "
            f"confidence={confidence:.3f} | "
            f"box_xyxy={coords}"
        )

print("\nAnnotated image saved to:")
print(Path(result.save_dir).resolve())
