export function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!password) {
    return { score: 0, label: "", color: "" };
  }

  let met = 0;
  if (password["length"] >= 8) met++;
  if (/[A-Z]/["test"](password)) met++;
  if (/[a-z]/["test"](password)) met++;
  if (/[0-9]/["test"](password)) met++;
  if (/[^A-Za-z0-9]/["test"](password)) met++;

  const hasAllCategories = met === 5;

  if (!hasAllCategories) {
    return { score: 0, label: "Very Weak", color: "#ef4444" };
  }
  if (password["length"] < 10) {
    return { score: 1, label: "Weak", color: "#f97316" };
  }
  if (password["length"] < 14) {
    return { score: 2, label: "Fair", color: "#eab308" };
  }
  return { score: 3, label: "Strong", color: "#22c55e" };
}
