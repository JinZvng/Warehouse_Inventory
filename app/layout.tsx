import "./globals.css";

export const metadata = {
  title: "Inventario Bodega",
  description: "Gestión de herramientas Makita",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased bg-slate-50">
        {children}
      </body>
    </html>
  );
}