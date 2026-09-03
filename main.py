"""
PrimeHealth 360° Non-Clinical Patient Engagement — Demo Backend
FastAPI + Gemini API
"""

import os
import json
import uuid
from datetime import datetime
from typing import Optional

import traceback
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai

from data.patients import PATIENTS, get_all_patients_summary

load_dotenv()

# ── Gemini Setup ──────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel("gemini-2.5-flash")
else:
    gemini_model = None

# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(title="PrimeHealth Non-Clinical Engagement Demo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_ngrok_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["ngrok-skip-browser-warning"] = "true"
    return response

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

# ── Global error handler — shows real error in browser ────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print("\n=== UNHANDLED ERROR ===")
    print(tb)
    print("======================\n")
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {str(exc)}", "traceback": tb},
    )

# ── Score Logic ───────────────────────────────────────────────────────────────
SENTIMENT_DELTA = {"positive": 0.3, "neutral": 0.0, "negative": -0.4}
URGENCY_MULTIPLIER = {"low": 1.0, "medium": 1.2, "high": 1.5, "critical": 2.0}
TOPIC_LABELS = {
    "reception":          "Reception & Registration",
    "appointment":        "Appointment & Scheduling",
    "wait_time":          "Queue Management",
    "doctor_consultation":"Doctor Consultation",
    "nursing_staff":      "Nursing & Staff Behaviour",
    "pharmacy":           "Pharmacy",
    "billing":            "Billing & Insurance",
    "facility":           "Facility & Cleanliness",
    "care_coordination":  "Care Coordination & Discharge",
    "general":            "General Feedback",
}
CHANNEL_LABELS = {
    "whatsapp": "WhatsApp",
    "email": "Email",
    "phone": "Phone Call",
    "kiosk": "In-Person Kiosk",
    "google": "Google Reviews",
    "doctify": "Doctify",
    "survey": "Post-Visit Survey",
    "app": "Mobile App",
}


def update_score(current: float, sentiment: str, urgency: str) -> float:
    delta = SENTIMENT_DELTA.get(sentiment, 0.0) * URGENCY_MULTIPLIER.get(urgency, 1.0)
    return round(max(0.0, min(5.0, current + delta)), 1)


def score_to_band(score: float) -> str:
    if score >= 3.5:
        return "green"
    if score >= 2.5:
        return "amber"
    return "red"


def score_to_stars(score: float) -> int:
    return max(1, min(5, round(score)))


def should_alert(sentiment: str, urgency: str, score: float) -> bool:
    return (sentiment == "negative" and urgency in ("high", "critical")) or score < 2.0


# ── Gemini Analysis ───────────────────────────────────────────────────────────
ANALYSIS_PROMPT = """
You are an AI assistant for a healthcare patient experience platform in Dubai, UAE.
Analyse the following patient feedback and return a JSON object with EXACTLY these fields and values:

- sentiment: MUST be exactly one of: "positive", "neutral", "negative"
- sentiment_score: float from -1.0 (very negative) to +1.0 (very positive)
- topic: MUST be exactly one of: "reception", "appointment", "wait_time", "doctor_consultation", "nursing_staff", "pharmacy", "billing", "facility", "care_coordination", "general"
- urgency: MUST be exactly one of: "low", "medium", "high", "critical"
- summary: one sentence in English summarising the feedback and recommended action for staff
- language_detected: MUST be exactly one of: "Arabic", "English", "Hindi", "Filipino", "Other"

Channel: {channel}
Feedback text: {text}

Return ONLY valid JSON. Use EXACTLY the values listed above — no other values allowed.
"""


def analyse_with_gemini(channel: str, text: str) -> dict:
    if not gemini_model:
        # Fallback mock when no API key
        sentiment = "negative" if any(w in text.lower() for w in ["wait", "long", "rude", "bad", "poor", "unacceptable", "frustrated", "wrong", "slow"]) else "positive" if any(w in text.lower() for w in ["thank", "great", "excellent", "good", "kind", "helpful", "happy"]) else "neutral"
        topic = (
            "wait_time"          if "wait" in text.lower() else
            "nursing_staff"      if any(w in text.lower() for w in ["staff", "nurse", "rude", "attitude"]) else
            "billing"            if any(w in text.lower() for w in ["bill", "insurance", "charge", "payment"]) else
            "doctor_consultation"if any(w in text.lower() for w in ["doctor", "physician", "consultation"]) else
            "pharmacy"           if "pharma" in text.lower() or "medicine" in text.lower() else
            "appointment"        if "appointment" in text.lower() else
            "reception"          if "reception" in text.lower() or "register" in text.lower() else
            "facility"           if any(w in text.lower() for w in ["clean", "facility", "toilet", "hygiene"]) else
            "general"
        )
        return {
            "sentiment": sentiment,
            "sentiment_score": -0.7 if sentiment == "negative" else 0.7 if sentiment == "positive" else 0.0,
            "topic": topic,
            "urgency": "high" if sentiment == "negative" else "low",
            "summary": f"[Demo mode — no API key] Signal classified as {sentiment}.",
            "language_detected": "English",
        }

    prompt = ANALYSIS_PROMPT.format(channel=CHANNEL_LABELS.get(channel, channel), text=text)
    response = gemini_model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.1,
        ),
    )
    return json.loads(response.text)


# ── Request / Response Models ─────────────────────────────────────────────────
class SignalRequest(BaseModel):
    channel: str
    text: str
    submitted_by: Optional[str] = "Staff"


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/departments", response_class=HTMLResponse)
async def departments_page(request: Request):
    return templates.TemplateResponse("departments.html", {"request": request})


@app.get("/api/departments")
async def get_departments():
    from collections import defaultdict
    dept: dict = defaultdict(lambda: {
        "positive": 0, "neutral": 0, "negative": 0,
        "signals": [], "patient_ids": set()
    })

    for pid, patient in PATIENTS.items():
        for sig in patient.get("signals", []):
            topic     = sig.get("topic", "general")
            sentiment = sig.get("sentiment", "neutral")
            dept[topic][sentiment]      += 1
            dept[topic]["patient_ids"].add(pid)
            dept[topic]["signals"].append({
                "date":         sig.get("date", ""),
                "channel":      sig.get("channel", ""),
                "text":         sig.get("text", ""),
                "sentiment":    sentiment,
                "urgency":      sig.get("urgency", "low"),
                "patient_name": patient["name"],
                "patient_id":   pid,
            })

    result = {}
    for topic, data in dept.items():
        total   = data["positive"] + data["neutral"] + data["negative"]
        neg_r   = data["negative"] / total if total else 0
        pos_r   = data["positive"] / total if total else 0
        band    = "red" if neg_r > 0.5 else "amber" if neg_r > 0.25 else "green"
        sat_pct = round(pos_r * 100)

        recent = sorted(data["signals"], key=lambda x: x["date"], reverse=True)[:3]

        result[topic] = {
            "label":            TOPIC_LABELS.get(topic, topic),
            "total":            total,
            "positive":         data["positive"],
            "neutral":          data["neutral"],
            "negative":         data["negative"],
            "satisfaction_pct": sat_pct,
            "band":             band,
            "patients_affected":len(data["patient_ids"]),
            "recent":           recent,
        }

    # Sort alphabetically by department label for a balanced, neutral display
    sorted_result = dict(sorted(
        result.items(),
        key=lambda x: x[1]["label"]
    ))
    return sorted_result


@app.get("/api/departments/{topic}")
async def get_department_detail(topic: str):
    signals = []
    counts  = {"positive": 0, "neutral": 0, "negative": 0}

    for pid, patient in PATIENTS.items():
        for sig in patient.get("signals", []):
            if sig.get("topic") != topic:
                continue
            sentiment = sig.get("sentiment", "neutral")
            counts[sentiment] += 1
            signals.append({
                "date":         sig.get("date", ""),
                "channel":      sig.get("channel", ""),
                "text":         sig.get("text", ""),
                "sentiment":    sentiment,
                "urgency":      sig.get("urgency", "low"),
                "patient_name": patient["name"],
                "patient_id":   pid,
            })

    if not signals:
        raise HTTPException(status_code=404, detail="Department not found or no signals")

    total   = sum(counts.values())
    neg_r   = counts["negative"] / total if total else 0
    pos_r   = counts["positive"] / total if total else 0
    band    = "red" if neg_r > 0.5 else "amber" if neg_r > 0.25 else "green"

    return {
        "topic":            topic,
        "label":            TOPIC_LABELS.get(topic, topic),
        "total":            total,
        "positive":         counts["positive"],
        "neutral":          counts["neutral"],
        "negative":         counts["negative"],
        "satisfaction_pct": round(pos_r * 100),
        "band":             band,
        "signals":          sorted(signals, key=lambda x: x["date"], reverse=True),
    }


@app.get("/api/patients")
async def list_patients():
    return get_all_patients_summary()


@app.get("/api/patients/{patient_id}")
async def get_patient(patient_id: str):
    patient = PATIENTS.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@app.post("/api/patients/{patient_id}/signal")
async def submit_signal(patient_id: str, body: SignalRequest):
    try:
        patient = PATIENTS.get(patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        # Run AI analysis
        analysis = analyse_with_gemini(body.channel, body.text)
        print("Gemini analysis:", analysis)

        sentiment  = analysis.get("sentiment", "neutral")
        urgency    = analysis.get("urgency", "low")
        topic      = analysis.get("topic", "general")
        summary    = analysis.get("summary", "")
        lang       = analysis.get("language_detected", "English")
        sent_score = analysis.get("sentiment_score", 0.0)

        # Update patient profile
        old_score  = patient["score"]
        new_score  = update_score(old_score, sentiment, urgency)
        new_band   = score_to_band(new_score)
        new_stars  = score_to_stars(new_score)
        alert_flag = should_alert(sentiment, urgency, new_score)

        patient["score"]       = new_score
        patient["colour_band"] = new_band
        patient["stars"]       = new_stars

        # Update sentiment trend
        if sentiment == "positive":
            patient["sentiment_trend"] = "Positive"
        elif sentiment == "negative":
            patient["sentiment_trend"] = "Declining"

        # Add new signal to history
        new_signal = {
            "id": f"sig_{uuid.uuid4().hex[:8]}",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "channel": body.channel,
            "text": body.text,
            "sentiment": sentiment,
            "topic": topic,
            "urgency": urgency,
            "submitted_by": body.submitted_by,
        }
        patient["signals"].insert(0, new_signal)

        # Update complaint / appreciation counts
        if sentiment == "negative":
            patient["open_complaints"] = patient.get("open_complaints", 0) + 1
        elif sentiment == "positive":
            patient["appreciation_notes"] = patient.get("appreciation_notes", 0) + 1

        # Create alert if needed
        if alert_flag:
            alert = {
                "id": f"alert_{uuid.uuid4().hex[:8]}",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "type": "complaint",
                "summary": summary,
                "status": "open",
            }
            patient["active_alerts"].insert(0, alert)

        return {
            "signal_id": new_signal["id"],
            "sentiment": sentiment,
            "sentiment_score": sent_score,
            "topic": topic,
            "topic_label": TOPIC_LABELS.get(topic, topic),
            "urgency": urgency,
            "summary": summary,
            "language_detected": lang,
            "alert_triggered": alert_flag,
            "old_score": old_score,
            "new_score": new_score,
            "score_delta": round(new_score - old_score, 1),
            "new_colour_band": new_band,
            "new_stars": new_stars,
            "patient_name": patient["name"],
        }

    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print("\n=== SIGNAL ENDPOINT ERROR ===")
        print(tb)
        print("=============================\n")
        return JSONResponse(status_code=500, content={"detail": f"{type(e).__name__}: {str(e)}"})


@app.get("/api/patients/{patient_id}/alerts")
async def get_alerts(patient_id: str):
    patient = PATIENTS.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient.get("active_alerts", [])


@app.get("/widget", response_class=HTMLResponse)
async def widget_page(request: Request, mrn: str = Query(...)):
    return templates.TemplateResponse(
        "widget.html",
        {"request": request, "mrn": mrn.upper().strip()},
        headers={"X-Frame-Options": "ALLOWALL"},
    )


@app.get("/api/widget/{patient_id}")
async def get_widget_data(patient_id: str):
    patient = PATIENTS.get(patient_id.upper())
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {
        "id":               patient["id"],
        "name":             patient["name"],
        "name_ar":          patient.get("name_ar", ""),
        "score":            patient["score"],
        "colour_band":      patient["colour_band"],
        "stars":            patient["stars"],
        "sentiment_trend":  patient["sentiment_trend"],
        "open_complaints":  patient.get("open_complaints", 0),
        "total_visits_12m": patient.get("total_visits_12m", 0),
        "preferred_language": patient.get("preferred_language", "English"),
        "last_visit":       patient.get("last_visit", ""),
        "active_alerts":    patient.get("active_alerts", []),
        "signals":          patient.get("signals", [])[:3],
    }


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "gemini_configured": bool(GEMINI_API_KEY),
        "patients_loaded": len(PATIENTS),
    }
