const DROPS = Array.from({ length: 90 }, (_, index) => {
  const near = index % 3 === 0;
  return {
    id: index,
    left: `${(index * 37) % 100}%`,
    delay: `${-((index % 13) * 0.16)}s`,
    duration: `${near ? 0.78 + (index % 5) * 0.07 : 1.25 + (index % 7) * 0.11}s`,
    height: near ? 28 + (index % 4) * 8 : 16 + (index % 3) * 5,
    opacity: near ? 0.85 : 0.55,
    width: near ? 2 : 1.4,
  };
});

export function RainBackdrop() {
  return (
    <div className="rain-field" aria-hidden>
      {DROPS.map((drop) => (
        <span
          key={drop.id}
          className="rain-drop"
          style={{
            left: drop.left,
            animationDelay: drop.delay,
            animationDuration: drop.duration,
            height: drop.height,
            opacity: drop.opacity,
            width: drop.width,
          }}
        />
      ))}
    </div>
  );
}
