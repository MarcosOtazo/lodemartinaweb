# Lo de Martina - Web de pedidos para rotisería

Web de pedidos online para la rotisería "Lo de Martina".
Catálogo de hamburguesas, tostadas, combos y bebidas. Los pedidos se guardan en Supabase
y llegan al WhatsApp del negocio. Incluye panel de administración.

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS v4
- **Backend/BD**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Hosting**: Netlify (gratis) + Supabase (gratis)

## Configuración inicial

### 1. Supabase

1. Crear una cuenta gratis en [supabase.com](https://supabase.com) y un proyecto nuevo.
2. En el panel: **SQL Editor** → *New query* → pegar el contenido de `supabase/schema.sql` → **Run**.
3. En **Project Settings → API** copiar:
   - `Project URL`
   - `anon public key`
4. Crear el archivo `.env` en la raíz (copiar de `.env.example`) y completar:
   ```
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=TU-ANON-KEY
   VITE_WHATSAPP_NUMBER=5491123456789
   ```

### 2. Crear tu cuenta de administrador

1. En la web, ir a **Iniciar sesión → Registrarse** y crear tu cuenta.
2. En Supabase **SQL Editor** ejecutar (con tu email):
   ```sql
   select public.make_admin('tu@email.com');
   ```
3. Listo: al iniciar sesión vas a ver "Panel Admin" en el menú.

### 3. Emails de registro y recuperación de contraseña

1. En Supabase: **Authentication → URL Configuration**:
   - **Site URL**: `https://lodemartinaweb.netlify.app` (o tu dominio)
   - **Redirect URLs**: agregar `https://lodemartinaweb.netlify.app` y `http://localhost:5173`
2. **Authentication → Email Templates**:
   - **Confirm signup**: pegar el contenido de `supabase/email_confirmar_cuenta.html`
     (asunto: "Confirmá tu cuenta — Lo de Martina 🍔")
   - **Reset password**: pegar el contenido de `supabase/email_recuperar_contrasena.html`
     (asunto: "Recuperá tu contraseña — Lo de Martina 🔑")

### 4. Netlify

1. Subir el repo a GitHub.
2. En [netlify.com](https://netlify.com): **Add new site → Import from Git**.
3. Build command: `npm run build` — Publish directory: `dist` (ya configurado en `netlify.toml`).
4. En **Site settings → Environment variables** agregar las 3 variables de `.env`.

## Desarrollo local

```bash
npm install
npm run dev
```

## Funcionalidades

**Clientes**
- Ver menú por categorías (hamburguesas, tostadas, combos, bebidas)
- Carrito con notas por producto y variantes/opcionales con precio
- Checkout: retiro/envío, efectivo con vuelto o transferencia con datos bancarios,
  envía el pedido a WhatsApp del negocio
- Registro/login (con confirmación por email), recuperación de contraseña
  y historial de pedidos con estado en tiempo real

**Admin** (Panel Admin)
- Dashboard: ventas de hoy y de la semana, gráfico de 7 días, productos más vendidos
- Productos: crear/editar/eliminar con fotos, opciones y variantes con precio extra
- Ventas: filtros por fecha/estado, exportar CSV, imprimir comanda, marcar entregados
  en lote, sonido cuando entra un pedido nuevo
- Clientes: listado de usuarios registrados con pedidos y total gastado
- Configuración: logo, colores, horarios por día, redes sociales, imagen principal,
  textos, costo de envío, pedido mínimo

**Tiempo real**: los pedidos nuevos aparecen al instante en el panel del admin
con aviso sonoro.
