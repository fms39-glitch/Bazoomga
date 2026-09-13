import { SurveyQuestion } from "./types";

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: "q1",
    prompt: "Name something people do when they wake up in the morning.",
    answers: [
      { text: "Brush teeth", aliases: ["brush their teeth", "brushing teeth"], points: 42 },
      { text: "Check phone", aliases: ["phone", "scroll phone", "check social media"], points: 28 },
      { text: "Shower", aliases: ["take a shower", "bath"], points: 18 },
      { text: "Drink coffee", aliases: ["coffee", "make coffee"], points: 12 },
    ],
  },
  {
    id: "q2",
    prompt: "Name a fruit that is hard to eat neatly.",
    answers: [
      { text: "Mango", aliases: ["mangoes"], points: 38 },
      { text: "Watermelon", aliases: ["melon"], points: 30 },
      { text: "Pineapple", aliases: [], points: 20 },
      { text: "Pomegranate", aliases: [], points: 12 },
    ],
  },
  {
    id: "q3",
    prompt: "Name something you might forget before leaving the house.",
    answers: [
      { text: "Keys", aliases: ["car keys", "house keys"], points: 45 },
      { text: "Wallet", aliases: ["purse", "money"], points: 25 },
      { text: "Phone", aliases: ["cell phone", "mobile"], points: 20 },
      { text: "Lunch", aliases: ["food", "snack"], points: 10 },
    ],
  },
  {
    id: "q4",
    prompt: "Name a place where people whisper.",
    answers: [
      { text: "Library", aliases: ["the library"], points: 40 },
      { text: "Church", aliases: ["temple", "mosque"], points: 28 },
      { text: "Movie theater", aliases: ["cinema", "movies"], points: 22 },
      { text: "Hospital", aliases: ["doctor's office"], points: 10 },
    ],
  },
  {
    id: "q5",
    prompt: "Name something associated with a birthday party.",
    answers: [
      { text: "Cake", aliases: ["birthday cake"], points: 44 },
      { text: "Balloons", aliases: ["balloon"], points: 26 },
      { text: "Presents", aliases: ["gifts", "gift"], points: 20 },
      { text: "Candles", aliases: ["birthday candles"], points: 10 },
    ],
  },
  {
    id: "q6",
    prompt: "Name a reason someone might be late to work.",
    answers: [
      { text: "Traffic", aliases: ["bad traffic", "jam"], points: 48 },
      { text: "Overslept", aliases: ["alarm", "slept in"], points: 26 },
      { text: "Car trouble", aliases: ["flat tire", "car broke down"], points: 16 },
      { text: "Kids", aliases: ["childcare", "school drop off"], points: 10 },
    ],
  },
  {
    id: "q7",
    prompt: "Name something people are afraid of.",
    answers: [
      { text: "Spiders", aliases: ["spider", "bugs"], points: 35 },
      { text: "Heights", aliases: ["falling", "high places"], points: 30 },
      { text: "Public speaking", aliases: ["speaking in public"], points: 22 },
      { text: "Snakes", aliases: ["snake"], points: 13 },
    ],
  },
  {
    id: "q8",
    prompt: "Name something you find in a kitchen drawer.",
    answers: [
      { text: "Utensils", aliases: ["forks", "spoons", "knives"], points: 40 },
      { text: "Batteries", aliases: ["battery"], points: 22 },
      { text: "Scissors", aliases: [], points: 20 },
      { text: "Tape", aliases: ["duct tape", "scotch tape"], points: 18 },
    ],
  },
];

export function pickQuestions(count: number): SurveyQuestion[] {
  return SURVEY_QUESTIONS.slice(0, Math.min(count, SURVEY_QUESTIONS.length));
}

export const SURVEY_PROMPTS = SURVEY_QUESTIONS.map((q) => q.prompt);
