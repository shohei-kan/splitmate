export function categoryColor(category: string) {
  if (category === "food") return "#8FCB95";
  if (category === "daily") return "#89AEEA";
  if (category === "outside_food") return "#E79A9A";
  if (category === "utility") return "#B095E5";
  if (category === "travel") return "#E7CA7E";
  if (category === "other") return "#BCA18E";
  return "#8A97A4";
}

export function categoryTrackColor(category: string) {
  if (category === "food") return "#F1FAF2";
  if (category === "daily") return "#F2F6FF";
  if (category === "outside_food") return "#FDF2F2";
  if (category === "utility") return "#F7F2FF";
  if (category === "travel") return "#FCF8EC";
  if (category === "other") return "#F7F2EE";
  return "#EEF1F5";
}
