## Objetivo
Mostrar redes sociales en las vistas SEMANA y MES, y reemplazar los emojis actuales de X (Twitter) e Instagram por logos reales en la vista DÍA (y en todos los lugares donde se use `SocialNetworkLink`).

## Cambios

### 1. `src/components/SocialNetworkLink.tsx`
- Reemplazar los `icon` tipo emoji (`𝕏`, `📷`) por logos reales:
  - X: ícono SVG oficial de X (usar `lucide-react` `Twitter` no aplica porque es el pájaro viejo). Usar un pequeño componente SVG inline de la X.
  - Instagram: usar el ícono `Instagram` de `lucide-react` (ya disponible).
  - El resto de plataformas (Facebook, YouTube, LinkedIn, Pinterest) se mantiene usando los íconos correspondientes de `lucide-react` (`Facebook`, `Youtube`, `Linkedin`) — reemplazar también sus emojis por consistencia.
- Cambiar la estructura `icon: string` a `icon: ReactNode` (o renderer function) para permitir componentes SVG.

### 2. `src/components/WeeklyCalendar.tsx` (vista SEMANA)
- Actualmente sólo muestra un icono `Globe` cuando hay `social_networks`. Reemplazar por la lista compacta de redes:
  - Si el guest tiene `twitter` y/o `instagram`, mostrar los logos X e IG como enlaces clicables (target `_blank`), con el `@username` opcional truncado.
  - Otras plataformas: mostrar sólo el logo enlazado (sin texto) para ahorrar espacio.
- Mismo tratamiento para el co-invitado (`renderCoGuestMini`).

### 3. `src/components/MonthView.tsx` (vista MES)
- Añadir en cada tarjeta de guest (después del nombre/topic) una fila compacta con los logos de las redes sociales presentes, enlazando a la URL (`https://twitter.com/...`, `https://instagram.com/...`, etc.). Sólo iconos, tamaño pequeño (`w-3 h-3`), para no romper el layout denso del mes.

### 4. `src/components/DayView.tsx` (vista DÍA)
- Ya renderiza `SocialNetworkLink`; los cambios se aplicarán automáticamente al reemplazar los emojis por logos en el componente compartido.

## Notas técnicas
- Todos los enlaces con `onClick={(e) => e.stopPropagation()}` para no disparar el click de la card.
- Sin cambios de datos ni de backend — sólo presentación.
- Sin cambios en modo EDIT/PRESENT: los enlaces siguen siendo clicables en ambos modos (comportamiento actual de `SocialNetworkLink`).