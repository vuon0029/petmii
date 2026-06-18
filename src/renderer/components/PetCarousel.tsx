// src/renderer/components/PetCarousel.tsx
// Navigation carousel for multi-pet system — shows one pet at a time with arrows.

import { PetState } from "../pet/petVariant";
import "../styles/pet-carousel.css";

interface PetCarouselProps {
  pets: PetState[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export function PetCarousel({ pets, currentIndex, onNavigate }: PetCarouselProps) {
  if (pets.length <= 1) return null;

  const handlePrev = () => {
    const newIndex = currentIndex <= 0 ? pets.length - 1 : currentIndex - 1;
    onNavigate(newIndex);
  };

  const handleNext = () => {
    const newIndex = currentIndex >= pets.length - 1 ? 0 : currentIndex + 1;
    onNavigate(newIndex);
  };

  return (
    <div className="pet-carousel">
      <button
        type="button"
        className="pet-carousel-arrow pet-carousel-arrow-left"
        onClick={handlePrev}
        aria-label="Previous pet"
      >
        ◀
      </button>

      <div className="pet-carousel-indicators">
        {pets.map((pet, i) => (
          <button
            key={pet.id}
            type="button"
            className={`pet-carousel-dot ${i === currentIndex ? "active" : ""}`}
            onClick={() => onNavigate(i)}
            aria-label={`Go to ${pet.name}`}
            title={pet.name}
          />
        ))}
      </div>

      <button
        type="button"
        className="pet-carousel-arrow pet-carousel-arrow-right"
        onClick={handleNext}
        aria-label="Next pet"
      >
        ▶
      </button>
    </div>
  );
}
