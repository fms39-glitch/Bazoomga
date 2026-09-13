import type { SurveyQuestion } from "./types";

export const QUESTION_BANK: SurveyQuestion[] = [
  {
    id: "bedtime",
    text: "Name something you do before going to bed.",
    answers: [
      { text: "Brush teeth", aliases: ["brush my teeth", "teeth", "toothbrush"], points: 38 },
      { text: "Watch TV", aliases: ["television", "netflix", "streaming"], points: 21 },
      { text: "Read", aliases: ["read a book", "book", "reading"], points: 15 },
      { text: "Set alarm", aliases: ["alarm clock", "alarm", "set my alarm"], points: 12 },
      { text: "Shower", aliases: ["bathe", "bath", "wash up"], points: 8 },
    ],
  },
  {
    id: "pizza",
    text: "Name a popular pizza topping.",
    answers: [
      { text: "Pepperoni", aliases: ["peperoni"], points: 42 },
      { text: "Mushrooms", aliases: ["mushroom", "shrooms"], points: 18 },
      { text: "Sausage", aliases: ["italian sausage"], points: 14 },
      { text: "Cheese", aliases: ["extra cheese", "mozzarella"], points: 13 },
      { text: "Onions", aliases: ["onion", "red onion"], points: 7 },
    ],
  },
  {
    id: "airport",
    text: "Name something people forget to pack for a trip.",
    answers: [
      { text: "Toothbrush", aliases: ["tooth brush"], points: 29 },
      { text: "Charger", aliases: ["phone charger", "cable", "charging cable"], points: 24 },
      { text: "Underwear", aliases: ["undies", "boxers", "socks and underwear"], points: 16 },
      { text: "Medication", aliases: ["medicine", "pills", "prescription"], points: 14 },
      { text: "Passport", aliases: ["id", "license", "driver license"], points: 9 },
    ],
  },
  {
    id: "office",
    text: "Name something you find on an office desk.",
    answers: [
      { text: "Computer", aliases: ["laptop", "monitor", "pc"], points: 33 },
      { text: "Pen", aliases: ["pens", "pencil", "pencils"], points: 22 },
      { text: "Paper", aliases: ["notepad", "notebook", "sticky notes"], points: 16 },
      { text: "Phone", aliases: ["cell phone", "mobile"], points: 14 },
      { text: "Coffee", aliases: ["coffee mug", "mug", "cup"], points: 8 },
    ],
  },
  {
    id: "breakfast",
    text: "Name a breakfast food.",
    answers: [
      { text: "Eggs", aliases: ["egg", "scrambled eggs", "omelet", "omelette"], points: 31 },
      { text: "Bacon", aliases: ["sausage and bacon"], points: 22 },
      { text: "Cereal", aliases: ["oatmeal", "granola"], points: 18 },
      { text: "Pancakes", aliases: ["pancake", "waffles", "waffle"], points: 15 },
      { text: "Toast", aliases: ["bread", "bagel"], points: 9 },
    ],
  },
  {
    id: "superhero",
    text: "Name a famous superhero.",
    answers: [
      { text: "Superman", aliases: ["clark kent"], points: 28 },
      { text: "Batman", aliases: ["bruce wayne", "the batman"], points: 24 },
      { text: "Spider-Man", aliases: ["spiderman", "spider man", "peter parker"], points: 22 },
      { text: "Wonder Woman", aliases: ["wonderwoman"], points: 12 },
      { text: "Iron Man", aliases: ["ironman", "tony stark"], points: 9 },
    ],
  },
  {
    id: "kitchen",
    text: "Name something in a kitchen you use every day.",
    answers: [
      { text: "Refrigerator", aliases: ["fridge", "freezer"], points: 27 },
      { text: "Microwave", aliases: ["microwave oven"], points: 21 },
      { text: "Sink", aliases: ["faucet"], points: 18 },
      { text: "Stove", aliases: ["oven", "range", "cooktop"], points: 16 },
      { text: "Coffee maker", aliases: ["kuerig", "keurig", "coffee pot"], points: 10 },
    ],
  },
  {
    id: "dog",
    text: "Name a reason people walk their dog.",
    answers: [
      { text: "Exercise", aliases: ["walk", "workout", "to exercise"], points: 34 },
      { text: "Potty", aliases: ["pee", "bathroom", "to go", "relieve itself"], points: 30 },
      { text: "Fresh air", aliases: ["outside", "outdoors"], points: 14 },
      { text: "Play", aliases: ["playtime", "fun"], points: 11 },
      { text: "Socialize", aliases: ["see other dogs", "dog park"], points: 6 },
    ],
  },
  {
    id: "movie",
    text: "Name something you eat at the movie theater.",
    answers: [
      { text: "Popcorn", aliases: ["pop corn"], points: 48 },
      { text: "Candy", aliases: ["sweets", "chocolate", "m&ms", "skittles"], points: 19 },
      { text: "Soda", aliases: ["pop", "soft drink", "coke", "drink"], points: 16 },
      { text: "Nachos", aliases: ["nacho"], points: 9 },
      { text: "Hot dog", aliases: ["hotdog"], points: 5 },
    ],
  },
  {
    id: "rain",
    text: "Name something people do when it rains.",
    answers: [
      { text: "Use an umbrella", aliases: ["umbrella", "open umbrella"], points: 36 },
      { text: "Stay inside", aliases: ["stay in", "stay home"], points: 22 },
      { text: "Drive carefully", aliases: ["slow down", "drive slow"], points: 14 },
      { text: "Wear a coat", aliases: ["raincoat", "jacket", "wear raincoat"], points: 13 },
      { text: "Watch a movie", aliases: ["netflix", "tv"], points: 8 },
    ],
  },
  {
    id: "job",
    text: "Name a job that requires a uniform.",
    answers: [
      { text: "Police officer", aliases: ["cop", "police", "officer"], points: 26 },
      { text: "Doctor", aliases: ["nurse", "surgeon", "medical"], points: 21 },
      { text: "Military", aliases: ["soldier", "army", "navy"], points: 18 },
      { text: "Fast food", aliases: ["mcdonalds", "burger king", "restaurant"], points: 16 },
      { text: "Pilot", aliases: ["flight attendant", "airline"], points: 10 },
    ],
  },
  {
    id: "phone",
    text: "Name something people do on their phone too much.",
    answers: [
      { text: "Scroll social media", aliases: ["instagram", "tiktok", "facebook", "social media", "scrolling"], points: 32 },
      { text: "Text", aliases: ["texting", "messaging"], points: 22 },
      { text: "Play games", aliases: ["gaming", "games"], points: 16 },
      { text: "Watch videos", aliases: ["youtube", "videos"], points: 15 },
      { text: "Check email", aliases: ["email", "emails"], points: 8 },
    ],
  },
];

export function shuffleQuestions(count: number): SurveyQuestion[] {
  const copy = [...QUESTION_BANK];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.max(1, Math.min(count, copy.length)));
}
