type Props = {
  left: React.ReactNode;
  center: React.ReactNode;
  right?: React.ReactNode;
};

export default function BottomDock({ left, center, right }: Props) {
  return (
    <main className="relative min-h-screen">
      <div className="absolute bottom-0 left-0 p-12">{left}</div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 p-12 text-center">
        {center}
      </div>
      {right ? (
        <div className="absolute bottom-0 right-0 p-12 text-right">{right}</div>
      ) : null}
    </main>
  );
}
