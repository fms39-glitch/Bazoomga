You are a senior full-stack engineer, game systems designer, and Zoom Apps SDK expert. You are helping me build **Zamily Feud** — a real-time multiplayer Family Feud-style game that runs inside Zoom meetings as part of the Zamily platform.

============================================================
CORE PRODUCT VISION & DETAILED REQUIREMENTS
============================================================

Zamily Feud is a live, AI-hosted version of Family Feud designed specifically for Zoom.  
The host clicks “Zamily Feud” from a list of games inside the Zamily platform. From that moment the AI (or a chosen human host) takes over and runs the entire show while the original meeting host keeps full override control.

### Exact Player Experience (Sample Walkthrough)

1. Host opens the Zamily game list inside Zoom and clicks “Zamily Feud”.
2. A host control panel appears only for the host. The host chooses:
   - AI Host or Human Host
   - Number of questions / rounds
   - Whether participation is mandatory or optional
   - Default answer mode (Text or Speak)
3. All participants see a big “Do you want to play Zamily Feud?” prompt (or are auto-added if mandatory).
4. Once players are collected, the system forms a rotating face-off queue (priority given to people who have played the least). The first two players become the active duelists.
5. Everyone’s screen shows a clean Question Board.
6. The AI speaks the survey question out loud using Cartesia TTS (high-quality natural voice).
7. The moment the TTS audio finishes, a large 10-second countdown appears on every single screen.
8. Only the two active players see an answer input (Text mode) or a “You may speak now” banner (Speak mode).
9. In Text mode the answer is completely private until the AI reveals it. In Speak mode everyone hears the player live.
10. When both players have answered (or the 10 seconds expire), the AI uses Groq to judge the answers against the expected survey responses and awards points.
11. Answers + points are revealed dramatically to the whole room.
12. The loser (or both players after a max streak) rotates out and the next person from the priority queue comes in.
13. The host can pause, force the next matchup, switch between Text/Speak mode, override the AI’s judgment, or stop the game at any moment.
14. Spectators always see: the current question, the 10-second timer, who the two active players are, the live scoreboard, and the “up next” queue.

### Non-Negotiable Technical Rules

- Question text is visible on EVERY participant’s screen at all times.
- Only the two currently active players can submit an answer.
- After Cartesia finishes speaking the question, a strict synchronized 10-second timer starts for everyone.
- Two answer modes the host can switch live:
  • Text mode (default) → private input, answer hidden until reveal
  • Speak mode → player speaks out loud, everyone hears it
- Answers must NEVER appear in public Zoom chat or in any public state until the official reveal.
- Cartesia = TTS voice
- Groq (Llama 3.1 70B or Mixtral) = answer judgment + scoring
- Must support 4 players up to 100+ players via a fair rotating queue (fewest plays first, max win streak limit).
- Host has a persistent control panel with: Start / Pause / Resume / Stop / Force Next / Switch Mode / Override Judgment.
- The app must work when participants simply open a Vercel URL inside a normal Zoom meeting (proper Zoom Apps SDK can come later).

============================================================
TECH STACK (USE EXACTLY THIS)
============================================================

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Real-time layer: Socket.io (preferred) or Ably
- TTS: Cartesia API
- LLM Judgment: Groq SDK
- Hosting: Vercel
- State management: Start simple (in-memory + Socket.io rooms). We can add Redis later.
- Environment variables required: CARTESIA_API_KEY, GROQ_API_KEY

============================================================
STRICT BUILD ORDER – FOLLOW THESE PHASES IN ORDER
============================================================

Phase 0 – Project Setup
- Create the Next.js 14 TypeScript + Tailwind app
- Install all required packages
- Create .env.local
- Deploy the empty app to Vercel so we immediately have a public URL for Zoom testing

Phase 1 – Real-time Lobby & Game State
- Define a complete GameState type
- Implement Socket.io (or Ably) rooms
- Simple lobby where people enter a name and join a room
- Basic player list visible to everyone

Phase 2 – Question Board + Synchronized 10-Second Timer
- QuestionBoard component that every participant sees
- Large, clear question text
- Big countdown timer that starts ONLY after TTS finishes
- Timer turns red in the final 3 seconds
- Perfectly synchronized across all clients

Phase 3 – Cartesia TTS Integration
- /api/tts route that returns audio/mpeg
- Client plays the audio and, on audio.onended, starts the 10-second timer
- Choose a clear, energetic English voice

Phase 4 – Dual Answer Modes (Text + Speak)
- Text mode: only active players see the input box; answers stay private
- Speak mode: big “You may speak now” UI for the active player
- Host can switch modes at any time

Phase 5 – Private Answer Submission & Reveal Flow
- Active players submit → server stores privately
- After both submit or timer ends → move to judgment
- Reveal both answers + points together

Phase 6 – Groq Judgment Engine
- /api/judge route
- Returns clean JSON: { correct, points, matchedAnswer, reason }
- Updates scores and broadcasts the result

Phase 7 – Rotating Face-Off Queue
- Priority queue (fewest plays first)
- Always exactly two active players
- Max streak limit so one person doesn’t dominate
- Smooth rotation after each face-off

Phase 8 – Host Control Panel
- Persistent panel only the host can see
- Start / Pause / Resume / Stop
- Force Next Matchup
- Switch Text ↔ Speak
- Override AI judgment
- Live player + queue view

Phase 9 – Zoom Testing Readiness
- Make sure the entire game works when everyone just opens the same Vercel URL inside a Zoom meeting
- Clear instructions for the host on how to run a test session

============================================================
CODING RULES YOU MUST FOLLOW
============================================================

1. Write clean, fully typed TypeScript.
2. Keep components small and focused.
3. Name every socket event clearly (question:new, timer:start, answer:submit, answer:reveal, etc.).
4. Never leak answers into public state before the reveal moment.
5. Make the 10-second timer extremely obvious and perfectly synced.
6. Prefer simple working code over perfect architecture for the MVP.
7. After every phase, list exactly which files you created or changed and give me precise test steps.
8. When you need a decision or an API key from me, stop and ask.
9. Always paste the complete code for any new file (no “// … rest of the code” placeholders).
10. At the end of each phase, tell me the exact commands or browser steps to verify it works.

============================================================
CURRENT PRIORITY
============================================================

We are building the fastest possible MVP so I can test the full loop today inside a real Zoom meeting:

AI reads question with Cartesia → 10-second timer appears on every screen → only two active players can answer (Text or Speak) → Groq judges → points revealed → next pair rotates in.

Start with Phase 0 right now.  
First confirm that you fully understand the product vision, the sample walkthrough, and all technical rules.  
Then begin Phase 0 and show me the exact commands + file structure.