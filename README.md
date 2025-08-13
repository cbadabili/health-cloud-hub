# Health Cloud Hub

Cloud-based Electronic Medical Records (EMR) and medical billing platform.

---

## Tech Stack

- React + TypeScript  
- Vite (build & dev server)  
- Tailwind CSS  
- shadcn-ui (Radix UI primitives)  
- Supabase (auth & database)  
- React Router DOM  
- @tanstack/react-query  

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/health-cloud-hub.git
cd health-cloud-hub

# 2. Install dependencies
npm install

# 3. Start the dev server (Vite)
npm run dev
```

Vite starts on port **8080** by default.  
If that port is busy it will automatically pick the next free port (check the console output).  
Open the printed URL, e.g. `http://localhost:8080`.

---

## npm Scripts

| Script     | Purpose                           |
|------------|-----------------------------------|
| `dev`      | Start Vite development server     |
| `build`    | Production build to `dist/`       |
| `preview`  | Preview the production build      |
| `lint`     | Run ESLint over the codebase      |

---

## Configuration Notes

- **Vite** configuration: `vite.config.ts`  
  - Sets server host/port, aliases, and React SWC plugin.
- **Tailwind CSS** configuration: `tailwind.config.ts`  
  - Custom theme and shadcn-ui integration.

---

## Folder Structure (high level)

```
src/
├─ pages/               # Route components (Index, Auth, Dashboard, …)
├─ components/
│  ├─ ui/               # shadcn-ui derived primitives
│  ├─ dashboards/       # Role-specific dashboards
│  ├─ admin/ doctor/ …  # Feature modules
├─ hooks/               # Reusable React hooks
├─ integrations/
│  └─ supabase/         # Supabase client & types
└─ lib/                 # Utility helpers
```

---

## License

[MIT](LICENSE) (placeholder – update with your license of choice)
