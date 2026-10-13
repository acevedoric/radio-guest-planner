const norm = (s?: string | null) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** True si ambos nombres se refieren a la misma persona (ignora acentos,
 * mayúsculas y signos; acepta que uno contenga al otro). */
export const sameGuestName = (a?: string | null, b?: string | null): boolean => {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
};
