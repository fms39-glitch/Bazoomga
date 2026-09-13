"""
agents.py
---------
The two AI agents that power Zamily Feud. This module has NO game-state,
NO player logic, and NO sockets -- it only knows how to talk to a local
Ollama model. The Node.js server calls this service over plain HTTP and
treats it as a black box.

1. HostAgent       -> generates the host's spoken lines
2. FuzzyJudgeAgent -> clusters raw answers / checks live guesses
"""

import json
import os
import requests

from dotenv import load_dotenv

load_dotenv()

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL_NAME = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")


def _chat(system_prompt: str, user_prompt: str, expect_json: bool = False) -> str:
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 1024,
    }
    if expect_json:
        payload["response_format"] = {"type": "json_object"}

    resp = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=30)
    if not resp.ok:
        print(f"Groq API error: {resp.status_code} {resp.text}")
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# Agent 1: Host Agent
# ---------------------------------------------------------------------------

HOST_SYSTEM_PROMPT = """You are the AI host of a Family-Feud-style party game called Zamily Feud.
Your energy is warm, upbeat, and a little theatrical -- think classic game-show host.
Keep every line SHORT (1-2 sentences max). Never break character. Never mention that
you are an AI or a language model.
"""


class HostAgent:
    def intro(self, question: str) -> str:
        prompt = f"Introduce this survey question to the crowd with excitement: '{question}'"
        return _chat(HOST_SYSTEM_PROMPT, prompt)

    def reveal(self, question: str, answer: str, points: int, rank: int) -> str:
        prompt = (
            f"The survey question was '{question}'. Reveal answer #{rank} on the board: "
            f"'{answer}' worth {points} points. React with appropriate excitement "
            f"(more excitement for a higher-ranked / higher-point answer)."
        )
        return _chat(HOST_SYSTEM_PROMPT, prompt)

    def wrong_guess(self, guess: str) -> str:
        prompt = f"A contestant just guessed '{guess}' and it was NOT on the board. Give a short, gentle 'X' reaction."
        return _chat(HOST_SYSTEM_PROMPT, prompt)

    def round_end(self, winning_team: str, total_points: int) -> str:
        prompt = f"The round just ended. '{winning_team}' won the round with {total_points} points. Celebrate them."
        return _chat(HOST_SYSTEM_PROMPT, prompt)


# ---------------------------------------------------------------------------
# Agent 2: Fuzzy Judge Agent
# ---------------------------------------------------------------------------

JUDGE_SYSTEM_PROMPT = """You are a precise semantic clustering engine for a survey-based game.
You will be given a survey QUESTION and a list of raw ANSWERS submitted by different players.
Group answers that refer to the SAME real-world thing in the context of the question
(e.g. "puppy" and "dog" both count as "dog" when the question is about pets; "okra" and
"ladyfinger" are the same vegetable). Do NOT group answers that are genuinely different
things, even if they seem similar.

Return ONLY valid JSON in this exact shape, with no extra commentary:
{
  "clusters": [
    {"label": "<best short label for the group>", "members": ["<raw answer 1>", "<raw answer 2>"], "count": <number of members>}
  ]
}
Sort the clusters array by "count" descending.
"""


class FuzzyJudgeAgent:
    def cluster(self, question: str, answers: list[str]) -> list[dict]:
        user_prompt = (
            f"QUESTION: {question}\n"
            f"ANSWERS: {json.dumps(answers)}\n\n"
            "Cluster these now."
        )
        raw = _chat(JUDGE_SYSTEM_PROMPT, user_prompt, expect_json=True)
        try:
            parsed = json.loads(raw)
            clusters = parsed.get("clusters", [])
        except (json.JSONDecodeError, AttributeError):
            clusters = [{"label": a, "members": [a], "count": 1} for a in answers]

        clusters.sort(key=lambda c: c.get("count", 0), reverse=True)
        return clusters

    def is_match(self, question: str, guess: str, board_answers: list[str]) -> str | None:
        prompt = (
            f"QUESTION: {question}\n"
            f"BOARD ANSWERS: {json.dumps(board_answers)}\n"
            f"CONTESTANT GUESS: '{guess}'\n\n"
            "Does the guess semantically match exactly one of the board answers? "
            'Return ONLY JSON: {"match": "<the matching board answer, or null>"}'
        )
        raw = _chat(JUDGE_SYSTEM_PROMPT, prompt, expect_json=True)
        try:
            parsed = json.loads(raw)
            return parsed.get("match")
        except (json.JSONDecodeError, AttributeError):
            return None


# ---------------------------------------------------------------------------
# Agent 3: Question Generator Agent
# ---------------------------------------------------------------------------

GENERATOR_SYSTEM_PROMPT = """You are a creative writer for a Family-Feud-style party game.
Generate 5 fun, engaging, and slightly quirky survey questions that would be fun for a group of friends or coworkers to answer.
Return ONLY valid JSON in this exact shape, with no extra commentary:
{
  "questions": [
    "Question 1",
    "Question 2",
    "Question 3",
    "Question 4",
    "Question 5"
  ]
}
"""

class QuestionGeneratorAgent:
    def generate_questions(self) -> list[str]:
        prompt = "Generate 5 new survey questions."
        raw = _chat(GENERATOR_SYSTEM_PROMPT, prompt, expect_json=True)
        try:
            parsed = json.loads(raw)
            return parsed.get("questions", [])
        except (json.JSONDecodeError, AttributeError):
            return ["Name a fruit.", "Name a color.", "Name an animal.", "Name a vehicle.", "Name a shape."]

