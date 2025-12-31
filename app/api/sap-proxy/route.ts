import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const codigo = searchParams.get('code');

  if (!codigo) return NextResponse.json({ error: 'Falta código' }, { status: 400 });

  // TU IP REAL (La que confirmaste que funciona)
  const targetUrl = `http://172.16.1.206:3026/api/consultar-stock-item/${codigo}`;

  try {
    const res = await fetch(targetUrl, { 
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) throw new Error(`Error API: ${res.status}`);

    const data = await res.json();

    // --- CORRECCIÓN CLAVE: MANEJO DE ARRAY ---
    // Si SAP devuelve una lista [{}], tomamos el primero.
    let cleanData = data;
    if (Array.isArray(data)) {
        cleanData = data.length > 0 ? data[0] : {}; 
    }

    return NextResponse.json(cleanData);

  } catch (error: any) {
    console.error("Error Proxy:", error.message);
    return NextResponse.json({ error: 'Fallo conexión' }, { status: 500 });
  }
}