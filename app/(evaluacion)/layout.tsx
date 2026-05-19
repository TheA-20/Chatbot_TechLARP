// El route group (evaluacion) hereda el layout raíz (html/body/Providers).
// No necesita un layout adicional — este archivo solo existe para que Next.js
// reconozca el grupo y no añada wrappers innecesarios.
export default function EvaluacionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
