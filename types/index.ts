export interface Herramienta {
  id: string;
  id_corto: number;
  modelo: string;
  serie: string;
  pallet: string;
  estado: 'En desarme' | 'Rearmando' | 'Rearmadas' | 'Desarmado'; 
  created_at?: string;
  tiene_conflicto?: boolean;
  repuesto_objetivo?: string;
  updated_at?: string;
  descripcion_objetivo?: string;
  solicitante?: string;
}

export interface Repuesto {
  id: string;
  herramienta_id: string;
  repuesto: string;
  descripcion: string;
  created_at: string;
}