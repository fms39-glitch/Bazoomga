"use client";

import { FormEvent, useState } from "react";

export function AnswerInput({
  disabled,
  locked,
  onSubmit,
}: {
  disabled: boolean;
  locked: boolean;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim() || disabled || locked) return;
    onSubmit(value.trim());
    setValue("");
  };

  if (locked) {
    return (
      <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4 text-center text-emerald-100">
        Answer locked. Waiting for the reveal...
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-6 flex w-full max-w-xl gap-3">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        maxLength={80}
        placeholder="Type your answer — it's private until reveal"
        className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-lg text-white outline-none ring-gold/40 placeholder:text-white/30 focus:ring-2"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="rounded-2xl bg-gold px-5 py-3 font-display text-lg text-navy disabled:opacity-40"
      >
        Lock in
      </button>
    </form>
  );
}
