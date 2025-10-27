# Sistema de Gestión de Proyectos

Una aplicación web completa para la gestión de proyectos freelance con tracking de tareas, registro de horas trabajadas y generación de reportes en PDF.

## 🚀 Características Principales

- **Gestión de Proyectos**: Crea y administra múltiples proyectos con fechas de entrega y tarifas por hora
- **Control de Tareas**: Sistema de tareas con estados (pendiente, en progreso, completada) y arrastre para priorización
- **Registro Diario**: Bitácora diaria de trabajo con tracking de horas y mejora de notas con IA
- **Reportes PDF**: Generación automática de reportes detallados con gráficos y análisis
- **Dashboard Analítico**: Visualización de progreso, horas trabajadas y análisis de productividad
- **Autenticación**: Sistema completo de registro e inicio de sesión
- **Responsive Design**: Interfaz adaptable a todos los dispositivos

## 🛠️ Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Tailwind CSS + shadcn/ui
- **Backend**: Lovable Cloud (Supabase)
- **Base de Datos**: PostgreSQL con Row Level Security
- **Autenticación**: Supabase Auth
- **IA**: Lovable AI (Gemini Flash para mejora de notas)
- **Generación PDF**: html2pdf.js
- **Gráficos**: Recharts
- **Gestión de Estado**: React Query (TanStack Query)
- **Drag & Drop**: @dnd-kit

## 📦 Instalación

### Requisitos Previos

- Node.js 18+ y npm instalado ([instalar con nvm](https://github.com/nvm-sh/nvm#installing-and-updating))

### Pasos

```bash
# Clonar el repositorio
git clone <YOUR_GIT_URL>

# Navegar al directorio
cd <YOUR_PROJECT_NAME>

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## 📁 Estructura del Proyecto

```
├── src/
│   ├── components/          # Componentes React
│   │   ├── ui/             # Componentes base de shadcn/ui
│   │   ├── projects/       # Componentes de proyectos
│   │   └── project-detail/ # Componentes de detalle de proyecto
│   ├── pages/              # Páginas de la aplicación
│   │   ├── Auth.tsx        # Autenticación
│   │   ├── Home.tsx        # Dashboard principal
│   │   └── ProjectDetail.tsx # Detalle de proyecto
│   ├── lib/                # Utilidades y lógica de negocio
│   │   ├── ai.ts          # Integración con IA
│   │   ├── reports.ts     # Generación de reportes
│   │   └── validation.ts  # Validaciones
│   ├── integrations/       # Integraciones (auto-generado)
│   │   └── supabase/      # Cliente Supabase
│   └── hooks/             # Custom hooks
├── supabase/
│   ├── functions/         # Edge Functions
│   └── migrations/        # Migraciones de base de datos
└── ESPECIFICACION_TECNICA.md # Documentación técnica completa
```

## 💾 Base de Datos

El proyecto utiliza PostgreSQL con las siguientes tablas principales:

- **projects**: Información de proyectos
- **tasks**: Tareas asociadas a proyectos
- **daily_work_entries**: Registro diario de trabajo
- **task_hours**: Relación de horas trabajadas por tarea

Ver [ESPECIFICACION_TECNICA.md](./ESPECIFICACION_TECNICA.md) para el esquema completo.

## 🔐 Seguridad

- Row Level Security (RLS) habilitado en todas las tablas
- Políticas de acceso basadas en `auth.uid()`
- Autenticación obligatoria para todas las operaciones
- Validaciones en base de datos mediante triggers

## 📝 Desarrollo

### Editar en Lovable

Visita el [Proyecto en Lovable](https://lovable.dev/projects/b3cf0e83-fe9a-40ac-b1af-8d9d9bd73d48) para editar con IA.

### Editar Localmente

Puedes editar el código localmente y los cambios se sincronizarán automáticamente con Lovable.

### Variables de Entorno

Las variables de entorno se configuran automáticamente (`.env` es generado por Lovable Cloud):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

## 🚢 Despliegue

Abre [Lovable](https://lovable.dev/projects/b3cf0e83-fe9a-40ac-b1af-8d9d9bd73d48) y haz clic en Share → Publish.

### Dominio Personalizado

Puedes conectar un dominio personalizado en Project > Settings > Domains.

[Más información sobre dominios personalizados](https://docs.lovable.dev/features/custom-domain#custom-domain)

## 📚 Documentación

- [Especificación Técnica Completa](./ESPECIFICACION_TECNICA.md) - Documentación detallada de arquitectura, base de datos y funcionalidades
- [Documentación de Lovable](https://docs.lovable.dev/)
- [Guía de shadcn/ui](https://ui.shadcn.com/)

## 🤝 Contribuir

Este es un proyecto personal, pero si deseas contribuir:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia MIT.

## 🔗 Enlaces

- **Proyecto en Lovable**: https://lovable.dev/projects/b3cf0e83-fe9a-40ac-b1af-8d9d9bd73d48
- **Documentación Técnica**: [ESPECIFICACION_TECNICA.md](./ESPECIFICACION_TECNICA.md)
