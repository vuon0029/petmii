import { useState, useRef, useEffect } from "react";
import { PetVariant, SPECIES_DEFAULT_NAMES } from "../pet/petVariant";
import { PetAvatar } from "./PetAvatar";
import "../styles/name-pet.css";

interface NamePetScreenProps {
  variant: PetVariant;
  onNameSubmit: (name: string) => void;
}

export function NamePetScreen({ variant, onNameSubmit }: NamePetScreenProps) {
  const [name, setName] = useState(SPECIES_DEFAULT_NAMES[variant.species]);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Force focus on mount — more reliable than autoFocus on Linux/WSL
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      setError("A non-empty name is required");
      return;
    }

    if (trimmed.length > 20) {
      setError("Name must be 20 characters or fewer");
      return;
    }

    setError("");
    onNameSubmit(trimmed);
  }

  return (
    <div className="name-pet-screen">
      <h1>Name your new pet!</h1>
      <div className="name-pet-preview">
        <PetAvatar
          species={variant.species}
          variantId={variant.color}
          personality={variant.personality}
          lifeStage={variant.lifeStage}
          visualState="idle"
          static
        />
      </div>
      <form onSubmit={handleSubmit} className="name-pet-input-area">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder="Name your pet"
          maxLength={20}
          autoFocus
          aria-label="Pet name"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "name-error" : undefined}
        />
        {error && (
          <p className="name-pet-error" id="name-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="name-pet-confirm-btn">
          Confirm
        </button>
      </form>
    </div>
  );
}
