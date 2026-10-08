export default function PlayerText({ text = "" }) {
  return text.split(/(\b[XO]\b)/).map((part, index) =>
    part === "X" || part === "O"
      ? <span key={index} className={`player-${part.toLowerCase()}`}>{part}</span>
      : part,
  );
}
