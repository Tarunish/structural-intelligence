"""
Stage 4 & 5: Material Analysis + LLM Explainability
Recommends construction materials per structural element with cost-strength tradeoff.
Usage: python material_engine.py --parsed parsed_output.json
"""

import json
import math
import argparse
import os
import requests

# ─────────────────────────────────────────────
# STARTER MATERIAL DATABASE (from problem statement)
# ─────────────────────────────────────────────

MATERIALS = [
    {
        "id": "aac_block",
        "name": "AAC Blocks",
        "cost_score": 1,        # 1=low, 2=medium, 3=high
        "strength_score": 2,    # 1=low...4=very high
        "durability_score": 3,
        "best_use": ["PARTITION"],
        "cost_per_sqm": 450,    # INR estimate
        "description": "Autoclaved Aerated Concrete — lightweight, good insulation, easy to cut"
    },
    {
        "id": "red_brick",
        "name": "Red Brick",
        "cost_score": 2,
        "strength_score": 3,
        "durability_score": 2,
        "best_use": ["LOAD_BEARING"],
        "cost_per_sqm": 650,
        "description": "Traditional fired clay brick — reliable load-bearing, widely available"
    },
    {
        "id": "rcc",
        "name": "RCC (Reinforced Concrete)",
        "cost_score": 3,
        "strength_score": 4,
        "durability_score": 4,
        "best_use": ["COLUMN", "SLAB", "LOAD_BEARING"],
        "cost_per_sqm": 1200,
        "description": "Reinforced concrete — highest structural capacity, ideal for slabs and columns"
    },
    {
        "id": "steel_frame",
        "name": "Steel Frame",
        "cost_score": 3,
        "strength_score": 4,
        "durability_score": 4,
        "best_use": ["LONG_SPAN"],
        "cost_per_sqm": 1500,
        "description": "Structural steel — necessary for spans exceeding 5m, very high strength-to-weight"
    },
    {
        "id": "hollow_concrete",
        "name": "Hollow Concrete Block",
        "cost_score": 1,
        "strength_score": 2,
        "durability_score": 2,
        "best_use": ["PARTITION"],
        "cost_per_sqm": 380,
        "description": "Lightweight hollow block — good for non-structural interior walls"
    },
    {
        "id": "fly_ash_brick",
        "name": "Fly Ash Brick",
        "cost_score": 1,
        "strength_score": 2,
        "durability_score": 3,
        "best_use": ["PARTITION", "LOAD_BEARING"],
        "cost_per_sqm": 420,
        "description": "Eco-friendly industrial byproduct brick — good compressive strength, sustainable"
    },
    {
        "id": "precast_panel",
        "name": "Precast Concrete Panel",
        "cost_score": 2,
        "strength_score": 3,
        "durability_score": 4,
        "best_use": ["LOAD_BEARING", "SLAB"],
        "cost_per_sqm": 950,
        "description": "Factory-made panels — fast installation, consistent quality, good for structural walls"
    },
]


# ─────────────────────────────────────────────
# TRADEOFF SCORING ENGINE
# ─────────────────────────────────────────────

def compute_tradeoff_score(material, element_type, span_m=3.0, priority="balanced"):
    """
    Weighted cost-strength tradeoff.
    
    Weights differ by element type:
    - LOAD_BEARING: strength matters more (w_s=0.6, w_c=0.4)
    - PARTITION: cost matters more (w_s=0.3, w_c=0.7)
    - SLAB/COLUMN: max strength required (w_s=0.75, w_c=0.25)
    - LONG_SPAN (>5m): only very high strength eligible
    """
    weights = {
        "LOAD_BEARING": {"strength": 0.6,  "cost": 0.4,  "durability": 0.0},
        "PARTITION":    {"strength": 0.25, "cost": 0.6,  "durability": 0.15},
        "SLAB":         {"strength": 0.75, "cost": 0.15, "durability": 0.1},
        "COLUMN":       {"strength": 0.75, "cost": 0.15, "durability": 0.1},
        "LONG_SPAN":    {"strength": 0.8,  "cost": 0.1,  "durability": 0.1},
    }.get(element_type, {"strength": 0.5, "cost": 0.4, "durability": 0.1})

    # Normalize scores to 0-1
    s = material["strength_score"] / 4.0
    c = (4 - material["cost_score"]) / 3.0   # invert: lower cost = higher score
    d = material["durability_score"] / 3.0

    score = (
        weights["strength"] * s +
        weights["cost"] * c +
        weights["durability"] * d
    )

    # Penalty: if span > 5m and material can't handle it
    if span_m > 5.0 and material["strength_score"] < 4:
        score *= 0.5  # heavy penalty — not suitable for long span

    # Bonus: material is specifically designed for this use
    if element_type in material["best_use"] or "LOAD_BEARING" in material["best_use"] and element_type == "LOAD_BEARING":
        score *= 1.1

    return round(min(score, 1.0), 4)


def rank_materials_for_element(element_type, span_m=3.0, top_n=3):
    """Return top N ranked materials for a structural element type."""
    ranked = []
    for mat in MATERIALS:
        score = compute_tradeoff_score(mat, element_type, span_m)
        ranked.append({
            "material": mat,
            "tradeoff_score": score,
            "element_type": element_type,
            "span_m": span_m,
        })

    ranked.sort(key=lambda x: x["tradeoff_score"], reverse=True)
    return ranked[:top_n]


def analyze_all_elements(parsed_data):
    """
    For each wall in parsed data, determine element type and recommend materials.
    """
    walls = parsed_data.get("walls", [])
    recommendations = []

    for wall in walls:
        classification = wall.get("classification", "PARTITION")
        span_m = wall.get("span_m", 3.0)

        # Determine element type
        if span_m > 5.0:
            element_type = "LONG_SPAN"
        elif classification == "LOAD_BEARING":
            element_type = "LOAD_BEARING"
        else:
            element_type = "PARTITION"

        ranked = rank_materials_for_element(element_type, span_m)

        # Structural concern detection
        concerns = []
        if span_m > 5.0:
            concerns.append(f"⚠️ Long unsupported span of {span_m}m detected — steel frame or RCC required")
        if span_m > 3.5 and classification == "PARTITION":
            concerns.append(f"⚠️ Partition wall with {span_m}m span — consider upgrading to load-bearing")

        recommendations.append({
            "wall_id": wall.get("id", "unknown"),
            "element_type": element_type,
            "span_m": span_m,
            "top_materials": ranked,
            "structural_concerns": concerns,
        })

    # Add slab and column recommendations
    recommendations.append({
        "wall_id": "floor_slab",
        "element_type": "SLAB",
        "span_m": 4.0,
        "top_materials": rank_materials_for_element("SLAB", 4.0),
        "structural_concerns": [],
    })

    recommendations.append({
        "wall_id": "columns",
        "element_type": "COLUMN",
        "span_m": 3.0,
        "top_materials": rank_materials_for_element("COLUMN", 3.0),
        "structural_concerns": [],
    })

    return recommendations


# ─────────────────────────────────────────────
# STAGE 5: LLM EXPLAINABILITY
# ─────────────────────────────────────────────

def generate_explanation_with_llm(recommendations, rooms, api_key=None):
    """
    Call Claude API to generate human-readable explanations.
    Falls back to template-based explanation if no API key.
    """
    if not api_key:
        return generate_template_explanation(recommendations, rooms)

    # Build a compact summary for the LLM
    summary = []
    for rec in recommendations[:8]:  # limit context size
        top = rec["top_materials"][0] if rec["top_materials"] else {}
        mat = top.get("material", {})
        summary.append(
            f"- {rec['element_type']} wall (span: {rec['span_m']}m): "
            f"Best material → {mat.get('name','?')} "
            f"(score: {top.get('tradeoff_score','?')}, "
            f"cost: {'Low' if mat.get('cost_score',2)==1 else 'Medium' if mat.get('cost_score',2)==2 else 'High'}, "
            f"strength: {mat.get('strength_score','?')}/4)"
        )
        if rec["structural_concerns"]:
            summary.append(f"  CONCERN: {rec['structural_concerns'][0]}")

    rooms_list = [r.get("label", "ROOM") for r in rooms[:6]]

    prompt = f"""You are a structural engineering AI assistant. 
A floor plan has been parsed with the following rooms: {', '.join(rooms_list)}.

Material recommendations per structural element:
{chr(10).join(summary)}

Write a clear, professional explanation (3-4 paragraphs) covering:
1. Overall material strategy for this building
2. Why specific materials were chosen for load-bearing vs partition walls
3. Any structural concerns and how to address them
4. Cost-strength tradeoff rationale

Be specific — cite span measurements and material properties. 
Write as if explaining to a non-expert building owner."""

    try:
        response = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 800,
                "messages": [{"role": "user", "content": prompt}]
            },
            timeout=30
        )
        data = response.json()
        return data["content"][0]["text"]
    except Exception as e:
        print(f"[WARN] LLM call failed: {e} — using template explanation")
        return generate_template_explanation(recommendations, rooms)


def generate_template_explanation(recommendations, rooms):
    """Fallback: rule-based explanation without LLM."""
    lb_walls = [r for r in recommendations if r["element_type"] == "LOAD_BEARING"]
    partition_walls = [r for r in recommendations if r["element_type"] == "PARTITION"]
    long_spans = [r for r in recommendations if r["element_type"] == "LONG_SPAN"]
    concerns = [c for r in recommendations for c in r["structural_concerns"]]

    top_lb = lb_walls[0]["top_materials"][0]["material"] if lb_walls else {}
    top_pt = partition_walls[0]["top_materials"][0]["material"] if partition_walls else {}

    explanation = f"""
STRUCTURAL MATERIAL ANALYSIS — AUTONOMOUS STRUCTURAL INTELLIGENCE SYSTEM
=========================================================================

LOAD-BEARING WALLS ({len(lb_walls)} detected):
The primary recommendation for load-bearing walls is {top_lb.get('name', 'Red Brick')}. 
{top_lb.get('description', '')} 
These walls carry the vertical loads of the structure and require high compressive strength 
(strength score: {top_lb.get('strength_score', 3)}/4). The cost is justified by structural necessity.

PARTITION WALLS ({len(partition_walls)} detected):
For non-structural interior partition walls, {top_pt.get('name', 'AAC Blocks')} is recommended.
{top_pt.get('description', '')}
Since partition walls carry no structural load, cost-efficiency is prioritised 
(cost score: {top_pt.get('cost_score', 1)}/3 — lower is cheaper).

FLOOR SLAB:
RCC (Reinforced Concrete) is the standard recommendation for floor slabs. 
With a 4m typical span, RCC provides the required flexural strength with an 
excellent durability score of 4/4, ensuring 50+ year structural life.

{'STRUCTURAL CONCERNS DETECTED: ' + chr(10).join(concerns) if concerns else 'NO MAJOR STRUCTURAL CONCERNS DETECTED.'}

COST-STRENGTH TRADEOFF SUMMARY:
Load-bearing elements use high-strength materials (weight: 60% strength, 40% cost).
Partition elements optimise for cost (weight: 25% strength, 60% cost, 15% durability).
Long spans (>5m) require steel frame or RCC regardless of cost — safety is non-negotiable.
"""
    return explanation.strip()


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def run_material_analysis(parsed_path, api_key=None, output_path="material_report.json"):
    with open(parsed_path) as f:
        parsed_data = json.load(f)

    print("[OK] Running material analysis...")
    recommendations = analyze_all_elements(parsed_data)

    print("[OK] Generating explanation...")
    explanation = generate_explanation_with_llm(
        recommendations, 
        parsed_data.get("rooms", []),
        api_key=api_key
    )

    # Calculate total cost estimate
    total_cost = 0
    for rec in recommendations:
        if rec["top_materials"]:
            mat = rec["top_materials"][0]["material"]
            area = rec["span_m"] * 3.0  # span × height (3m)
            total_cost += mat["cost_per_sqm"] * area

    report = {
        "recommendations": recommendations,
        "explanation": explanation,
        "estimated_total_cost_inr": round(total_cost, 2),
        "summary": {
            "load_bearing_walls": sum(1 for r in recommendations if r["element_type"] == "LOAD_BEARING"),
            "partition_walls": sum(1 for r in recommendations if r["element_type"] == "PARTITION"),
            "long_spans": sum(1 for r in recommendations if r["element_type"] == "LONG_SPAN"),
            "total_concerns": sum(len(r["structural_concerns"]) for r in recommendations),
        }
    }

    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n✅ Material analysis complete → {output_path}")
    print(f"   Load-bearing walls: {report['summary']['load_bearing_walls']}")
    print(f"   Partition walls: {report['summary']['partition_walls']}")
    print(f"   Structural concerns: {report['summary']['total_concerns']}")
    print(f"   Estimated cost: ₹{report['estimated_total_cost_inr']:,.0f}")
    print(f"\n--- EXPLANATION ---\n{explanation}\n")

    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Material Analysis Engine")
    parser.add_argument("--parsed", type=str, default="parsed_output.json")
    parser.add_argument("--api-key", type=str, default=os.environ.get("ANTHROPIC_API_KEY"))
    parser.add_argument("--output", type=str, default="material_report.json")
    args = parser.parse_args()

    run_material_analysis(args.parsed, api_key=args.api_key, output_path=args.output)
