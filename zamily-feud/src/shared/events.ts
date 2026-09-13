export const SOCKET_EVENTS = {
  ROOM_CREATE: "room:create",
  ROOM_JOIN: "room:join",
  ROOM_STATE: "room:state",
  ROOM_ERROR: "room:error",

  PLAYER_READY: "player:ready",
  PLAYER_DECLINE: "player:decline",

  HOST_CONFIGURE: "host:configure",
  HOST_START: "host:start",
  HOST_PAUSE: "host:pause",
  HOST_RESUME: "host:resume",
  HOST_STOP: "host:stop",
  HOST_FORCE_NEXT: "host:force-next",
  HOST_SWITCH_MODE: "host:switch-mode",
  HOST_OVERRIDE: "host:override",

  QUESTION_NEW: "question:new",
  TTS_ENDED: "tts:ended",
  TIMER_START: "timer:start",

  ANSWER_SUBMIT: "answer:submit",
  ANSWER_LOCKED: "answer:locked",
  ANSWER_REVEAL: "answer:reveal",
} as const;
