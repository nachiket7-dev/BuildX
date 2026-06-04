/**
 * React Bits–style crossing light beams over the grid (pure CSS).
 */
export function GridBeams() {
  return (
    <div className="grid-beams" aria-hidden>
      <div className="grid-beam grid-beam--1" />
      <div className="grid-beam grid-beam--2" />
      <div className="grid-beam grid-beam--3" />
      <div className="grid-beam grid-beam--4" />
      <div className="grid-beam grid-beam--5" />
    </div>
  );
}
