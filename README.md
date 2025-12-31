# 🛠️ SCD: Sistema de Control de Desarmes e Inventario

![Estado del Proyecto](https://img.shields.io/badge/Estado-Producci%C3%B3n-success)
![Seguridad](https://img.shields.io/badge/Seguridad-SSL%20%26%20RLS-lock)
![Framework](https://img.shields.io/badge/Next.js-14-black)

## 📋 Resumen del Proyecto
El **Sistema de Control de Desarmes (SCD)** es una solución tecnológica diseñada específicamente para optimizar la logística interna de **Makita**. El proyecto centraliza la gestión de herramientas en proceso de desarme y mantenimiento, eliminando las brechas de información entre el taller (*Gemba*) y el inventario administrativo.

## 🚀 Funcionalidades Clave

### 1. Gestión Visual de Flujos (Mieruka)
* **Monitoreo de Estados:** Seguimiento en tiempo real de herramientas en estados: *En desarme*, *Desarmado*, *Rearmando* y *Rearmadas*.
* **Dashboard de Métricas:** Visualización de KPIs críticos como herramientas pendientes y volumen de trabajo en bodega.

### 2. Trazabilidad Inteligente mediante QR
* **Acceso Instantáneo:** Cada herramienta cuenta con una etiqueta única de 50x50mm con un código QR.
* **Consulta Móvil:** Al escanear el QR desde cualquier dispositivo, el sistema despliega automáticamente la ficha técnica (`ToolDetail`), mostrando repuestos faltantes y el historial de extracciones.

### 3. Prevención de Pérdidas y Errores (Poka-Yoke)
* **Validación de Historial:** El sistema detecta automáticamente si un repuesto ya ha sido extraído previamente para una misma herramienta, evitando duplicidad de solicitudes y pérdida de stock.
* **Carga Masiva:** Módulo para la importación de catálogos y herramientas desde archivos Excel para asegurar la integridad de los datos.

### 4. Puente Operativo SAP
* **Gestión de Solicitudes:** Módulo especializado para procesar Solicitudes de Traslado (SAP) con desglose de cantidades individuales para una trazabilidad unitaria.

## 🔐 Seguridad y Confidencialidad
Dada la sensibilidad de la información de la compañía, el sistema implementa:
* **Row Level Security (RLS):** Las políticas de base de datos garantizan que solo el personal autorizado pueda interactuar con los datos de inventario.
* **Cifrado de Extremo a Extremo:** Toda la comunicación se realiza bajo protocolo HTTPS (SSL).
* **Control de Auditoría:** Registro detallado de cada movimiento y cambio de estado en la bitácora de la herramienta.

## 💻 Stack Tecnológico
* **Frontend:** Next.js 14 (App Router) + Tailwind CSS + Lucide Icons.
* **Backend:** Supabase (PostgreSQL) con políticas de seguridad avanzadas.
* **Integraciones:** Generación de QR dinámica y lógica de escaneo nativo.

## ⚙️ Instalación y Puesta en Marcha

Si desea ejecutar este proyecto en un entorno local para pruebas o desarrollo, siga estos pasos:

### 1. Requisitos Previos
* **Node.js**: Versión 18 o superior instalada.
* **Git**: Para clonar el repositorio.
* **Cuenta en Supabase**: Para la base de datos y autenticación.

### 2. Clonar el Repositorio
```bash
git clone [https://github.com/JinZGG/Warehouse_Inventory.git](https://github.com/JinZGG/Warehouse_Inventory.git)
cd Warehouse_Inventory

---
Desarrollado para la optimización de procesos de **Servicio Técnico y Postventa**.
