"""
main.py -- Python Agent Service (no game state, no players, no sockets)
-------------------------------------------------------------------
This is a small internal API that only exposes the two AI agents.
The Node.js server is the only thing that should call this -- think of
it as a "brain" microservice sitting behind your real backend.

Run with:
    uvicorn main:app --reload --port 8000
"""

import os
from fastapi import FastAPI, Response, HTTPException
from pydantic import BaseModel
import requests as http_requests

from agents import HostAgent, FuzzyJudgeAgent, QuestionGeneratorAgent

app = FastAPI(title="Zamily Feud - Agent Service")

host = HostAgent()
judge = FuzzyJudgeAgent()
generator = QuestionGeneratorAgent()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class ClusterRequest(BaseModel):
    question: str
    answers: list[str]


class MatchRequest(BaseModel):
    question: str
    guess: str
    board_answers: list[str]


class IntroRequest(BaseModel):
    question: str


class RevealRequest(BaseModel):
    question: str
    answer: str
    points: int
    rank: int


class WrongRequest(BaseModel):
    guess: str


class RoundEndRequest(BaseModel):
    winning_team: str
    total_points: int


# ---------------------------------------------------------------------------
# Fuzzy Judge Agent endpoints
# ---------------------------------------------------------------------------

@app.post("/cluster")
def cluster(req: ClusterRequest):
    clusters = judge.cluster(req.question, req.answers)
    return {"clusters": clusters}


@app.post("/match")
def match(req: MatchRequest):
    result = judge.is_match(req.question, req.guess, req.board_answers)
    return {"match": result}


# ---------------------------------------------------------------------------
# Host Agent endpoints
# ---------------------------------------------------------------------------

@app.post("/host/intro")
def host_intro(req: IntroRequest):
    return {"line": host.intro(req.question)}


@app.post("/host/reveal")
def host_reveal(req: RevealRequest):
    return {"line": host.reveal(req.question, req.answer, req.points, req.rank)}


@app.post("/host/wrong")
def host_wrong(req: WrongRequest):
    return {"line": host.wrong_guess(req.guess)}


@app.post("/host/round-end")
def host_round_end(req: RoundEndRequest):
    return {"line": host.round_end(req.winning_team, req.total_points)}


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Generator endpoints
# ---------------------------------------------------------------------------

@app.post("/generate-questions")
def generate_questions():
    return {"questions": generator.generate_questions()}


# ---------------------------------------------------------------------------
# TTS endpoint (Cartesia)
# ---------------------------------------------------------------------------

class TTSRequest(BaseModel):
    text: str


@app.post("/tts")
def text_to_speech(req: TTSRequest):
    cartesia_key = os.environ.get("CARTESIA_API_KEY", "")
    if not cartesia_key:
        raise HTTPException(status_code=503, detail="TTS not configured: missing CARTESIA_API_KEY")

    voice_id = os.environ.get("CARTESIA_VOICE_ID", "69267136-1bdc-412f-ad78-0caad210fb40")

    resp = http_requests.post(
        "https://api.cartesia.ai/tts/bytes",
        headers={
            "X-API-Key": cartesia_key,
            "Cartesia-Version": "2024-06-10",
            "Content-Type": "application/json",
        },
        json={
            "model_id": "sonic-2",
            "transcript": req.text,
            "voice": {"mode": "id", "id": voice_id},
            "output_format": {
                "container": "mp3",
                "encoding": "mp3",
                "sample_rate": 44100,
            },
        },
        timeout=30,
    )
    if not resp.ok:
        print(f"Cartesia error: {resp.status_code} {resp.text}")
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    return Response(content=resp.content, media_type="audio/mpeg")
