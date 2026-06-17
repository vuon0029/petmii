import { PetState } from "../pet/petVariant";
import "../styles/death-screen.css";

interface DeathScreenProps {
  petState: PetState;
  onStartOver: () => void;
}

export function DeathScreen({ petState, onStartOver }: DeathScreenProps) {
  const diedDate = petState.diedAt
    ? new Date(petState.diedAt).toLocaleDateString()
    : "Unknown";

  const hatchedDate = new Date(petState.hatchedAt).toLocaleDateString();

  const ageMs = petState.diedAt
    ? new Date(petState.diedAt).getTime() - new Date(petState.hatchedAt).getTime()
    : Date.now() - new Date(petState.hatchedAt).getTime();

  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const ageHours = Math.floor((ageMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return (
    <div className="death-screen">
      <h1>💀</h1>
      <h2>Rest in peace</h2>

      <div className="death-screen-memorial">
        <p className="death-screen-name">{petState.name}</p>
        <p className="death-screen-info">
          {petState.species} · {petState.color} · {petState.personality}
          {petState.isShiny && " ✨"}
        </p>
        <div className="death-screen-dates">
          <p>Hatched: {hatchedDate}</p>
          <p>Died: {diedDate}</p>
          <p>Lived: {ageDays > 0 ? `${ageDays} day${ageDays !== 1 ? "s" : ""}` : ""} {ageHours} hour{ageHours !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <p className="death-screen-message">
        Your pet has been added to the graveyard.
      </p>

      <button type="button" className="death-screen-btn" onClick={onStartOver}>
        Start Over
      </button>
    </div>
  );
}
