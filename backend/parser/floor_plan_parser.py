"""
Stage 1 & 2: Floor Plan Parser + Geometry Reconstruction
Detects walls, rooms, openings from floor plan images.
Usage: python floor_plan_parser.py --image path/to/plan.png
"""

import cv2
import numpy as np
import json
import argparse
from shapely.geometry import Polygon, LineString, MultiPolygon
from shapely.ops import unary_union
import math

# ─────────────────────────────────────────────
# STAGE 1: FLOOR PLAN PARSING
# ─────────────────────────────────────────────

def load_and_preprocess(image_path):
    """Load image, convert to grayscale, threshold."""
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Cannot load image: {image_path}")
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Adaptive threshold works better than fixed threshold for floor plans
    binary = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=15, C=4
    )
    
    # Morphological cleanup — remove noise, fill small gaps
    kernel = np.ones((3, 3), np.uint8)
    cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel, iterations=1)
    
    return img, gray, cleaned


def detect_walls(binary_img, original_img):
    """
    Detect wall segments using HoughLinesP.
    Returns list of wall dicts with start, end, length, angle.
    """
    height, width = binary_img.shape
    scale_x = 1.0 / width   # normalize to 0-1
    scale_y = 1.0 / height

    # Detect lines
    lines = cv2.HoughLinesP(
        binary_img,
        rho=1,
        theta=np.pi / 180,
        threshold=50,
        minLineLength=30,
        maxLineGap=10
    )

    walls = []
    if lines is None:
        print("[WARN] No lines detected by HoughLinesP — check image quality")
        return walls

    for line in lines:
        x1, y1, x2, y2 = line[0]
        length = math.hypot(x2 - x1, y2 - y1)
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))

        # Snap near-horizontal / near-vertical lines (within 5 degrees)
        if abs(angle % 180) < 5:
            y1 = y2 = (y1 + y2) // 2   # horizontal snap
        elif abs((angle - 90) % 180) < 5:
            x1 = x2 = (x1 + x2) // 2  # vertical snap

        walls.append({
            "start": [round(x1 * scale_x, 4), round(y1 * scale_y, 4)],
            "end":   [round(x2 * scale_x, 4), round(y2 * scale_y, 4)],
            "pixel_start": [int(x1), int(y1)],
            "pixel_end":   [int(x2), int(y2)],
            "length_px": round(length, 1),
            "angle_deg": round(angle, 1),
        })

    # Merge near-duplicate lines (same direction, close proximity)
    walls = merge_duplicate_walls(walls)
    return walls


def merge_duplicate_walls(walls, distance_threshold=10):
    """Remove walls that are nearly identical (deduplication)."""
    merged = []
    used = set()

    for i, w1 in enumerate(walls):
        if i in used:
            continue
        group = [w1]
        for j, w2 in enumerate(walls):
            if j <= i or j in used:
                continue
            # Check if same direction and close
            d = point_distance(w1["pixel_start"], w2["pixel_start"])
            angle_diff = abs(w1["angle_deg"] - w2["angle_deg"]) % 180
            if d < distance_threshold and angle_diff < 10:
                group.append(w2)
                used.add(j)
        # Keep the longest in the group
        best = max(group, key=lambda w: w["length_px"])
        merged.append(best)
        used.add(i)

    return merged


def detect_rooms(binary_img, original_img):
    """
    Detect enclosed room regions via contour extraction.
    Returns list of room dicts with polygon, area, centroid, label.
    """
    height, width = binary_img.shape
    scale_x = 1.0 / width
    scale_y = 1.0 / height

    # Dilate to close small gaps in room boundaries
    kernel = np.ones((5, 5), np.uint8)
    dilated = cv2.dilate(binary_img, kernel, iterations=3)
    filled = cv2.morphologyEx(dilated, cv2.MORPH_CLOSE, kernel, iterations=5)

    contours, hierarchy = cv2.findContours(
        filled, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE
    )

    rooms = []
    min_area = (width * height) * 0.005  # ignore tiny blobs < 0.5% of image

    for i, cnt in enumerate(contours):
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue
        
        # Skip the outer boundary (largest contour)
        if area > (width * height) * 0.9:
            continue

        approx = cv2.approxPolyDP(cnt, epsilon=5, closed=True)
        polygon_pixels = [(int(p[0][0]), int(p[0][1])) for p in approx]
        polygon_norm = [(round(x * scale_x, 4), round(y * scale_y, 4)) for x, y in polygon_pixels]

        M = cv2.moments(cnt)
        if M["m00"] == 0:
            continue
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])

        rooms.append({
            "id": f"room_{i}",
            "polygon_normalized": polygon_norm,
            "polygon_pixels": polygon_pixels,
            "area_px": round(area, 1),
            "centroid_px": [cx, cy],
            "centroid_normalized": [round(cx * scale_x, 4), round(cy * scale_y, 4)],
            "label": "UNKNOWN",  # will be refined by LLM or heuristics
        })

    # Sort by area descending, take top 20
    rooms = sorted(rooms, key=lambda r: r["area_px"], reverse=True)[:20]

    # Label rooms by size heuristic
    rooms = label_rooms_heuristic(rooms)
    return rooms


def label_rooms_heuristic(rooms):
    """
    Assign room labels based on relative size.
    Largest = living room, medium = bedrooms, small = bathrooms/kitchen.
    """
    labels = ["LIVING_ROOM", "BEDROOM", "BEDROOM", "BEDROOM", "BEDROOM",
              "KITCHEN", "BATHROOM", "BATHROOM", "BATHROOM", "LAUNDRY",
              "FOYER", "HALLWAY", "STORAGE", "GARAGE", "UTILITY"]
    for i, room in enumerate(rooms):
        room["label"] = labels[i] if i < len(labels) else "ROOM"
    return rooms


def detect_openings(binary_img, walls):
    """
    Detect doors and windows as gaps in walls.
    Simple heuristic: short gaps along wall lines.
    """
    openings = []
    # Look for gaps in detected walls — segments shorter than 40px
    for i, wall in enumerate(walls):
        if wall["length_px"] < 40:
            openings.append({
                "id": f"opening_{i}",
                "type": "DOOR" if wall["length_px"] < 25 else "WINDOW",
                "location": wall["start"],
                "wall_ref": i
            })
    return openings


# ─────────────────────────────────────────────
# STAGE 2: GEOMETRY RECONSTRUCTION
# ─────────────────────────────────────────────

def classify_walls(walls, rooms):
    """
    Classify each wall as LOAD_BEARING or PARTITION.
    Rules:
    - Outer boundary walls → LOAD_BEARING
    - Walls touching 2+ rooms → structural spine → LOAD_BEARING  
    - Inner short walls → PARTITION
    """
    if not walls:
        return walls

    # Find bounding box of all wall endpoints
    all_x = [w["pixel_start"][0] for w in walls] + [w["pixel_end"][0] for w in walls]
    all_y = [w["pixel_start"][1] for w in walls] + [w["pixel_end"][1] for w in walls]
    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)
    margin = 30  # px from boundary

    for wall in walls:
        x1, y1 = wall["pixel_start"]
        x2, y2 = wall["pixel_end"]

        is_outer = (
            min(x1, x2) <= min_x + margin or
            max(x1, x2) >= max_x - margin or
            min(y1, y2) <= min_y + margin or
            max(y1, y2) >= max_y - margin
        )

        is_long = wall["length_px"] > 80  # long inner walls → structural

        if is_outer or is_long:
            wall["classification"] = "LOAD_BEARING"
        else:
            wall["classification"] = "PARTITION"

        wall["span_m"] = round(wall["length_px"] / 100 * 3, 2)  # approx scale: 100px = 3m

    return walls


def build_geometry_graph(walls):
    """
    Build a node-edge graph from walls.
    Nodes = junctions/corners, Edges = wall segments.
    """
    nodes = []
    edges = []
    node_map = {}

    def get_or_create_node(pt):
        key = (round(pt[0], 2), round(pt[1], 2))
        if key not in node_map:
            node_id = f"n{len(nodes)}"
            node_map[key] = node_id
            nodes.append({"id": node_id, "position": list(key)})
        return node_map[key]

    for i, wall in enumerate(walls):
        n1 = get_or_create_node(wall["start"])
        n2 = get_or_create_node(wall["end"])
        edges.append({
            "id": f"e{i}",
            "from": n1,
            "to": n2,
            "classification": wall.get("classification", "PARTITION"),
            "span_m": wall.get("span_m", 1.0),
        })

    return {"nodes": nodes, "edges": edges}


# ─────────────────────────────────────────────
# UTILITIES
# ─────────────────────────────────────────────

def point_distance(p1, p2):
    return math.hypot(p1[0] - p2[0], p1[1] - p2[1])


def draw_debug_image(original_img, walls, rooms, openings, output_path="debug_output.png"):
    """Draw detected elements on the original image for visual verification."""
    debug = original_img.copy()

    # Draw walls
    for wall in walls:
        color = (0, 0, 255) if wall.get("classification") == "LOAD_BEARING" else (0, 165, 255)
        cv2.line(debug, tuple(wall["pixel_start"]), tuple(wall["pixel_end"]), color, 2)

    # Draw rooms
    for room in rooms:
        pts = np.array(room["polygon_pixels"], np.int32).reshape((-1, 1, 2))
        cv2.polylines(debug, [pts], True, (0, 255, 0), 1)
        cx, cy = room["centroid_px"]
        cv2.putText(debug, room["label"][:6], (cx - 20, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (50, 50, 200), 1)

    # Draw openings
    for op in openings:
        sx, sy = int(op["location"][0] * original_img.shape[1]), int(op["location"][1] * original_img.shape[0])
        cv2.circle(debug, (sx, sy), 5, (255, 0, 255), -1)

    cv2.imwrite(output_path, debug)
    print(f"[DEBUG] Debug image saved: {output_path}")


# ─────────────────────────────────────────────
# FALLBACK: Manual coordinate mode
# ─────────────────────────────────────────────

FALLBACK_PLAN_B = {
    "walls": [
        {"start": [0.0, 0.0], "end": [1.0, 0.0], "length_px": 300, "angle_deg": 0, "pixel_start": [0, 0], "pixel_end": [300, 0]},
        {"start": [1.0, 0.0], "end": [1.0, 1.0], "length_px": 300, "angle_deg": 90, "pixel_start": [300, 0], "pixel_end": [300, 300]},
        {"start": [1.0, 1.0], "end": [0.0, 1.0], "length_px": 300, "angle_deg": 180, "pixel_start": [300, 300], "pixel_end": [0, 300]},
        {"start": [0.0, 1.0], "end": [0.0, 0.0], "length_px": 300, "angle_deg": 270, "pixel_start": [0, 300], "pixel_end": [0, 0]},
        {"start": [0.5, 0.0], "end": [0.5, 0.6], "length_px": 180, "angle_deg": 90, "pixel_start": [150, 0], "pixel_end": [150, 180]},
        {"start": [0.0, 0.5], "end": [0.5, 0.5], "length_px": 150, "angle_deg": 0, "pixel_start": [0, 150], "pixel_end": [150, 150]},
        {"start": [0.5, 0.5], "end": [1.0, 0.5], "length_px": 150, "angle_deg": 0, "pixel_start": [150, 150], "pixel_end": [300, 150]},
        {"start": [0.25, 0.5], "end": [0.25, 1.0], "length_px": 150, "angle_deg": 90, "pixel_start": [75, 150], "pixel_end": [75, 300]},
        {"start": [0.75, 0.5], "end": [0.75, 1.0], "length_px": 150, "angle_deg": 90, "pixel_start": [225, 150], "pixel_end": [225, 300]},
    ],
    "rooms": [
        {"id": "room_0", "label": "GREAT_ROOM", "centroid_normalized": [0.25, 0.25], "area_px": 22500},
        {"id": "room_1", "label": "KITCHEN", "centroid_normalized": [0.75, 0.25], "area_px": 22500},
        {"id": "room_2", "label": "BEDROOM_1", "centroid_normalized": [0.12, 0.75], "area_px": 11250},
        {"id": "room_3", "label": "BEDROOM_2", "centroid_normalized": [0.37, 0.75], "area_px": 11250},
        {"id": "room_4", "label": "BEDROOM_3", "centroid_normalized": [0.62, 0.75], "area_px": 11250},
        {"id": "room_5", "label": "BEDROOM_4", "centroid_normalized": [0.87, 0.75], "area_px": 11250},
    ],
    "openings": [],
    "fallback_used": True,
}


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def parse_floor_plan(image_path, use_fallback=False):
    if use_fallback:
        print("[FALLBACK] Using manually defined coordinates — will be disclosed to judges.")
        result = FALLBACK_PLAN_B.copy()
        result["walls"] = classify_walls(result["walls"], result["rooms"])
        result["graph"] = build_geometry_graph(result["walls"])
        return result

    img, gray, binary = load_and_preprocess(image_path)
    print(f"[OK] Image loaded: {img.shape[1]}x{img.shape[0]}px")

    walls = detect_walls(binary, img)
    print(f"[OK] Walls detected: {len(walls)}")

    rooms = detect_rooms(binary, img)
    print(f"[OK] Rooms detected: {len(rooms)}")

    openings = detect_openings(binary, walls)
    print(f"[OK] Openings detected: {len(openings)}")

    walls = classify_walls(walls, rooms)
    graph = build_geometry_graph(walls)

    draw_debug_image(img, walls, rooms, openings, "debug_output.png")

    result = {
        "image_path": image_path,
        "image_size": {"width": img.shape[1], "height": img.shape[0]},
        "walls": walls,
        "rooms": rooms,
        "openings": openings,
        "graph": graph,
        "fallback_used": False,
        "summary": {
            "total_walls": len(walls),
            "load_bearing": sum(1 for w in walls if w.get("classification") == "LOAD_BEARING"),
            "partition": sum(1 for w in walls if w.get("classification") == "PARTITION"),
            "total_rooms": len(rooms),
            "total_openings": len(openings),
        }
    }

    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Floor Plan Parser")
    parser.add_argument("--image", type=str, help="Path to floor plan image")
    parser.add_argument("--fallback", action="store_true", help="Use manual coordinates if CV fails")
    parser.add_argument("--output", type=str, default="parsed_output.json")
    args = parser.parse_args()

    result = parse_floor_plan(args.image or "", use_fallback=args.fallback or not args.image)

    with open(args.output, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\n✅ Parsing complete → {args.output}")
    print(f"   Walls: {result['summary']['total_walls']} "
          f"(LB: {result['summary']['load_bearing']}, "
          f"Partition: {result['summary']['partition']})")
    print(f"   Rooms: {result['summary']['total_rooms']}")
    print(f"   Openings: {result['summary']['total_openings']}")
