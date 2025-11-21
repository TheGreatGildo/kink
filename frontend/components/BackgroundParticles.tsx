'use client';

// Increased particle count for "fireflies" effect
const PARTICLE_POSITIONS = Array.from({ length: 40 }, () => ({
  left: Math.random() * 100,
  top: Math.random() * 100,
  duration: 15 + Math.random() * 20, // Slower movement
  flashDuration: 2 + Math.random() * 4, // Glimmer speed
  delay: Math.random() * 10,
  flashDelay: Math.random() * 5,
}));

export default function BackgroundParticles() {
  const particles = PARTICLE_POSITIONS;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 hidden dark:block">
      {particles.map((particle, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-cyan-400 rounded-full opacity-10 animate-float"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            animationDuration: `${particle.duration}s`, // Movement duration
            animationDelay: `-${particle.delay}s`, // Negative delay to start at random positions in cycle
          }}
        >
          {/* Inner glimmer effect to separate movement from flashing */}
          <div
            className="w-full h-full bg-[#00ffff] rounded-full animate-firefly-flash"
            style={{
               animationDuration: `${particle.flashDuration}s`,
               animationDelay: `-${particle.flashDelay}s`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

