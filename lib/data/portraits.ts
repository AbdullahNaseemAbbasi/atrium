import type { User } from "./types";

/*
 * Placeholder profile photos for the synthetic demo people, from the
 * randomuser.me portrait set. Fixed numbers so every run shows the same faces.
 */
const PORTRAITS: Record<string, { set: "men" | "women"; n: number }> = {
  Alex: { set: "men", n: 32 },
  Liam: { set: "men", n: 46 },
  Noah: { set: "men", n: 52 },
  Ethan: { set: "men", n: 75 },
  Daniel: { set: "men", n: 41 },
  Chris: { set: "men", n: 22 },
  Marcus: { set: "men", n: 67 },
  Omar: { set: "men", n: 85 },
  Leo: { set: "men", n: 15 },
  Emma: { set: "women", n: 44 },
  Sophia: { set: "women", n: 65 },
  Olivia: { set: "women", n: 68 },
  Ava: { set: "women", n: 79 },
  Priya: { set: "women", n: 90 },
  Hannah: { set: "women", n: 21 },
  Maya: { set: "women", n: 33 },
  Zara: { set: "women", n: 57 },
  Sam: { set: "women", n: 12 },
};

export function portraitUrl(user: Pick<User, "name" | "avatarHue">) {
  const firstName = user.name.split(" ")[0];
  const portrait = PORTRAITS[firstName] ?? { set: user.avatarHue % 2 === 0 ? "men" : "women", n: user.avatarHue % 100 };
  return `https://randomuser.me/api/portraits/${portrait.set}/${portrait.n}.jpg`;
}

