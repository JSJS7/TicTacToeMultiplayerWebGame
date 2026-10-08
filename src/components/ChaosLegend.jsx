import { CHAOS_EFFECTS } from "../../shared/chaosRules.js";
import EffectIcon from "./EffectIcon.jsx";
import PlayerText from "./PlayerText.jsx";

export default function ChaosLegend() {
  return (
    <aside className="chaos-legend" aria-label="Chaos power-up legend">
      <h3><span className="chaos-title">Chaos</span> field guide</h3>
      <p className="legend-intro">Five in a row wins. Both players see the same effects.</p>
      <ul>
        {Object.entries(CHAOS_EFFECTS).map(([type, effect]) => (
          <li key={type}>
            <span className={`legend-tile effect-${type}`}><EffectIcon type={type} /></span>
            <div><strong>{effect.name}</strong><p><PlayerText text={effect.description} /></p></div>
          </li>
        ))}
      </ul>
      <p className="legend-note">No effects during the first two moves. Up to two power-ups on the board. Collecting one restarts the four-turn countdown.</p>
      <p className="legend-note">Dead tile and extra marks use empty tiles without power-ups. Diagonals count as neighboring tiles.</p>
    </aside>
  );
}
