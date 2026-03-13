export function categoryColor(category: string) {
  if (category === "food") return "#7FD69A";
  if (category === "daily") return "#7FAFF5";
  if (category === "outside_food") return "#F296A5";
  if (category === "utility") return "#BF97F4";
  if (category === "travel") return "#F2CB6D";
  if (category === "other") return "#D4AA86";
  return "#8A97A4";
}

export function categoryTrackColor(category: string) {
  if (category === "food") return "#F1FBF4";
  if (category === "daily") return "#F1F6FF";
  if (category === "outside_food") return "#FDF1F4";
  if (category === "utility") return "#F8F2FF";
  if (category === "travel") return "#FDF7E8";
  if (category === "other") return "#FAF3ED";
  return "#EEF1F5";
}
