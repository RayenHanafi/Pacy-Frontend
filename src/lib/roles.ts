import type { Role } from "./types";

/**
 * Each role owns exactly one home route. Route groups were the original plan,
 * but they don't add a URL segment — all three role homes would have collided
 * on `/`. Real segments also make the demo legible: the URL says which view
 * you're looking at.
 */
export const roleHome: Record<Role, string> = {
  patient: "/patient",
  doctor: "/doctor",
  pharmacy: "/pharmacy",
};

export const roleLabel: Record<Role, string> = {
  patient: "Patient",
  doctor: "Doctor",
  pharmacy: "Pharmacy",
};
