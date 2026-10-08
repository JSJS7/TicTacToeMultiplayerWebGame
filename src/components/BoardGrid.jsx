import { useState } from "react";
import { availableMoves, CHAOS_EFFECTS } from "../../shared/chaosRules.js";
import EffectIcon from "./EffectIcon.jsx";

export default function BoardGrid({ game, canPlay, onMove }) {
  const [previewId, setPreviewId] = useState(null);
  const legalMoves = availableMoves(game);
  const previewEffect = game.chaos?.effects.find(
    (effect) => effect.id === previewId,
  );
  const targets = previewEffect?.type === "erase" && ["X", "O"].every((symbol) => {
    const index = previewEffect.targets[symbol];
    return Number.isInteger(index) && game.squares[index] === symbol && !game.chaos.blocked.includes(index);
  })
    ? Object.values(previewEffect.targets)
    : [];

  return (
    <div className="board" data-next-player={game.xIsNext ? "X" : "O"}>
      {Array.from({ length: game.boardHeight }, (_, row) => (
        <div key={row} className="board-row">
          {Array.from({ length: game.boardWidth }, (_, col) => {
            const index = row * game.boardWidth + col;
            const value = game.squares[index];
            const effect = game.chaos?.effects.find(
              (item) => item.index === index,
            );
            const blocked = game.chaos?.blocked.includes(index);
            const winning = game.winner?.line.includes(index);
            const bonus = game.chaos?.bonus && legalMoves.includes(index);
            const showPreview = () =>
              setPreviewId(effect?.type === "erase" || effect?.type === "block" ? effect.id : null);
            const classes = [
              "square",
              value && `player-${value.toLowerCase()}`,
              effect && `effect-${effect.type}`,
              winning && "winning",
              blocked && "blocked-tile",
              targets.includes(index) && "sacrifice-preview",
              previewEffect?.type === "block" && previewEffect.target === index && value === null && !blocked && !effect && "block-preview",
              bonus && "bonus-target",
            ];
            return (
              <button
                key={index}
                className={classes.filter(Boolean).join(" ")}
                disabled={!canPlay || !legalMoves.includes(index)}
                aria-label={`Row ${row + 1}, column ${col + 1}: ${blocked ? "blocked" : value || (effect ? CHAOS_EFFECTS[effect.type].name : "empty")}`}
                title={
                  effect
                    ? `${CHAOS_EFFECTS[effect.type].name}: ${CHAOS_EFFECTS[effect.type].description}`
                    : undefined
                }
                onMouseEnter={showPreview}
                onMouseLeave={() => setPreviewId(null)}
                onFocus={showPreview}
                onBlur={() => setPreviewId(null)}
                onClick={() => onMove(index)}
              >
                {value ? (
                  <span>{value}</span>
                ) : effect || blocked ? (
                  <EffectIcon type={blocked ? "block" : effect.type} />
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
