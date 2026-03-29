"""
Main FastAPI Server — Structural Intelligence System
Serves the full pipeline: upload image → parse → 3D data → materials → explain
Run: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import json, os, shutil, tempfile, sys

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "parser"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "materials"))

from parser.floor_plan_parser import parse_floor_plan
from materials.material_engine import analyze_all_elements, generate_explanation_with_llm

app = FastAPI(title="Structural Intelligence System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")


@app.get("/")
def root():
    return {"status": "ok", "message": "Structural Intelligence System API"}


@app.get("/health")
def health():
    return {"status": "healthy", "api_key_set": bool(ANTHROPIC_API_KEY)}


@app.post("/api/parse")
async def parse_floor_plan_endpoint(
    file: UploadFile = File(None),
    use_fallback: bool = False
):
    """
    Stage 1+2: Parse a floor plan image.
    Returns walls, rooms, openings, geometry graph.
    """
    if use_fallback or file is None:
        result = parse_floor_plan("", use_fallback=True)
        return result

    # Save uploaded file
    suffix = os.path.splitext(file.filename)[-1] if file.filename else ".png"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        result = parse_floor_plan(tmp_path, use_fallback=False)
    except Exception as e:
        # Auto fallback if CV fails
        print(f"[WARN] CV parsing failed: {e} — using fallback")
        result = parse_floor_plan("", use_fallback=True)
        result["cv_error"] = str(e)
    finally:
        os.unlink(tmp_path)

    return result


@app.post("/api/analyze")
async def analyze_materials_endpoint(parsed_data: dict):
    """
    Stage 4+5: Material analysis + LLM explanation.
    Input: parsed floor plan data from /api/parse
    """
    if not parsed_data.get("walls"):
        raise HTTPException(status_code=400, detail="No wall data provided. Run /api/parse first.")

    recommendations = analyze_all_elements(parsed_data)
    explanation = generate_explanation_with_llm(
        recommendations,
        parsed_data.get("rooms", []),
        api_key=ANTHROPIC_API_KEY or None
    )

    total_cost = 0
    for rec in recommendations:
        if rec["top_materials"]:
            mat = rec["top_materials"][0]["material"]
            total_cost += mat["cost_per_sqm"] * rec["span_m"] * 3.0

    return {
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


@app.post("/api/full-pipeline")
async def full_pipeline(
    file: UploadFile = File(None),
    use_fallback: bool = False
):
    """
    Runs the complete pipeline in one call:
    Upload image → parse → materials → explanation
    Returns everything needed by the 3D frontend.
    """
    # Stage 1+2
    if use_fallback or file is None:
        parsed = parse_floor_plan("", use_fallback=True)
    else:
        suffix = os.path.splitext(file.filename)[-1] if file.filename else ".png"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        try:
            parsed = parse_floor_plan(tmp_path)
        except Exception as e:
            parsed = parse_floor_plan("", use_fallback=True)
            parsed["cv_error"] = str(e)
        finally:
            os.unlink(tmp_path)

    # Stage 4+5
    recommendations = analyze_all_elements(parsed)
    explanation = generate_explanation_with_llm(
        recommendations, parsed.get("rooms", []),
        api_key=ANTHROPIC_API_KEY or None
    )

    total_cost = sum(
        rec["top_materials"][0]["material"]["cost_per_sqm"] * rec["span_m"] * 3.0
        for rec in recommendations if rec["top_materials"]
    )

    return {
        "parsed": parsed,
        "materials": {
            "recommendations": recommendations,
            "explanation": explanation,
            "estimated_total_cost_inr": round(total_cost, 2),
        },
        "status": "success",
        "fallback_used": parsed.get("fallback_used", False),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
