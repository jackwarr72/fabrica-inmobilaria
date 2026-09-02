# 📖 Manual de Usuario — Centinela (Fábrica Inmobiliaria)

Plataforma web de inteligencia comercial y captación inmobiliaria.

---

## 📑 Tabla de Contenido
1. [Visión General y Roles de Usuario](#1-visión-general-y-roles-de-usuario)
2. [Acceso al Sistema](#2-acceso-al-sistema)
3. [Radar y Detección de Inmuebles (Scraper)](#3-radar-y-detección-de-inmuebles-scraper)
4. [Gestión del Pipeline de Oportunidades](#4-gestión-del-pipeline-de-oportunidades)
5. [Directorio de Contactos y Seguimiento](#5-directorio-de-contactos-y-seguimiento)
6. [Agenda de Citas y Visitas](#6-agenda-de-citas-y-visitas)
7. [Administración de Usuarios y Roles](#7-administración-de-usuarios-y-roles)
8. [Metas de Negocio y KPIs](#8-metas-de-negocio-y-kpis)
9. [Guía Rápida de Comandos y Operación Local](#9-guía-rápida-de-comandos-y-operación-local)

---

## 1. Visión General y Roles de Usuario

Centinela estructura la prospección inmobiliaria en un flujo operativo medible:
$$\text{Detectar} \longrightarrow \text{Registrar} \longrightarrow \text{Validar} \longrightarrow \text{Calificar} \longrightarrow \text{Contactar} \longrightarrow \text{Cita} \longrightarrow \text{Inventario}$$

### 👥 Perfiles y Permisos

| Rol | Nombre en Español | Responsabilidades Principales |
|---|---|---|
| **`ADMIN`** | Administrador | Configura usuarios, administra accesos, supervisa metas y KPIs globales. |
| **`ANALYST`** | Analista | Revisa el radar del scraper, registra propiedades detectadas manualmente, valida datos y califica oportunidades. |
| **`ADVISOR`** | Asesor | Realiza el primer contacto comercial (< 24h), agenda citas y visitas, recopila documentación y da seguimiento a cierres. |

---

## 2. Acceso al Sistema

1. Ingresa a la URL de la plataforma: **[http://localhost:3000/login](http://localhost:3000/login)**
2. Introduce tu correo electrónico institucional y tu contraseña.
3. Haz clic en **"Iniciar sesión"**.

> **Credenciales de desarrollo por defecto:**
> - **Correo:** `admin@centinela.local`
> - **Contraseña:** `admin123`

---

## 3. Radar y Detección de Inmuebles (Scraper)

El módulo **Radar** es la pantalla de inicio ([/](http://localhost:3000/)) y el centro de monitoreo ([/scraper](http://localhost:3000/scraper)).

### 🔍 ¿Qué muestra este módulo?
- **Detectadas hoy:** Propiedades captadas durante la jornada actual.
- **En el radar:** Total acumulado de propiedades rastreadas en bases de datos.
- **Por validar:** Oportunidades que requieren revisión técnica de precio y zona.
- **Cobertura de fuentes:** Gráfico de distribución de captaciones por fuente (portales, agencias, alertas).
- **Últimas propiedades detectadas:** Listado en tiempo real con enlace directo a la publicación original.

### ⚙️ ¿Cómo actualizar el radar con nuevas propiedades?
Desde una consola PowerShell en el equipo:
```powershell
cd scraper
.\run_scraper.bat
```
El extractor recorrerá las fuentes configuradas y sincronizará automáticamente los nuevos anuncios con la plataforma web.

---

## 4. Gestión del Pipeline de Oportunidades

Acceso desde el menú lateral: **Oportunidades** ([/oportunidades](http://localhost:3000/oportunidades)).

### 4.1 Registrar una Oportunidad Manualmente
1. Haz clic en el botón **`+ Nueva oportunidad`** en la esquina superior derecha.
2. Completa los campos requeridos:
   - **Título:** Nombre descriptivo (ej. *"Casa en Fracc. San Carlos, 3 recámaras"*).
   - **Tipo de inmueble:** Casa, Departamento, Terreno, Local comercial, Bodega, Desarrollo, Inversión u Otro.
   - **Operación:** Venta o Renta.
   - **Precio (MXN):** Monto estimado o anunciado.
   - **Zona / Colonia / Municipio:** Ubicación geográfica (ej. *"Metepec Centro"*).
   - **Liga de la publicación:** URL de la fuente (portal, red social, anuncio).
   - **Contacto asociado:** Selecciona el propietario o broker si ya existe en el directorio.
   - **¿Cómo se detectó?:** Notas del canal de detección.
3. Haz clic en **"Registrar oportunidad"**. El inmueble entrará al pipeline con estatus **`Registrada`**.

---

### 4.2 Fases del Pipeline (Ciclo de Vida)

- **`Detectada`:** Encontrada automáticamente por el scraper.
- **`Registrada`:** Ingresada manualmente por un analista.
- **`Validando`:** En verificación de precio, ubicación real y no duplicidad.
- **`Calificada`:** Evaluada con prioridad comercial.
- **`Contactada`:** Primer contacto telefónico o mensaje realizado con el anunciante.
- **`Cita`:** Reunión o visita física/virtual agendada.
- **`Documentación`:** En revisión de escrituras, gravámenes o poderes.
- **`Inventario`:** Propiedad formalmente captada en cartera/exclusiva.
- **`Seguimiento`:** En promoción activa y atención a interesados.
- **`Descartada`:** Rechazada por precio fuera de mercado, duplicado o falta de respuesta.

---

### 4.3 Auditoría de SLA de Primer Contacto (< 24 Horas)
En la página de detalle de cada oportunidad ([/oportunidades/[id]](http://localhost:3000/oportunidades)):
- **Tarjeta "Contacto y SLA":**
  - Si la propiedad se contacta en $\le 24$ horas: aparece en **verde** con el tiempo exacto transcurrido.
  - Si transcurren $> 24$ horas sin contactar: se activa una alerta en **rojo** por vencimiento del tiempo objetivo comercial.

### 4.4 Calificación Comercial
En la columna lateral del detalle:
1. Selecciona la calificación:
   - **`Alta`:** Precio atractivo, propietario motivado a vender pronto, documentación en regla.
   - **`Media`:** Precio en mercado, requiere negociación o regularización menor.
   - **`Baja`:** Sobreprecio, poca disposición del propietario o documentación compleja.
2. Agrega notas justificativas y haz clic en **"Guardar calificación"**.
3. *Nota:* Si la oportunidad estaba en una etapa previa (`Detectada`, `Registrada` o `Validando`), avanzará automáticamente a **`Calificada`**.

### 4.5 Historial de Variaciones de Precio
Si el anunciante baja o sube el precio, la plataforma registrará el evento en la tarjeta **"Cambios de precio detectados"**, mostrando la tendencia (baja o alza) y la fecha de detección.

---

## 5. Directorio de Contactos y Seguimiento

Acceso desde el menú lateral: **Contactos** ([/contactos](http://localhost:3000/contactos)).

### 5.1 Registro y Clasificación
- Permite almacenar propietarios, brokers independientes, desarrolladores y aliados.
- Clasificación por tipo: **`Propietario`**, **`Broker`**, **`Aliado`**, **`Otro`**.
- Asignación a un Asesor responsable del seguimiento.

### 5.2 Botón "Marcar contactado hoy"
En la ficha del contacto ([/contactos/[id]](http://localhost:3000/contactos)):
- Al hacer clic en **"Marcar contactado hoy"**, el sistema estampa la fecha y hora actual en `Último contacto`, permitiendo auditar la cadencia de seguimiento sin tener que editar el formulario completo.

---

## 6. Agenda de Citas y Visitas

Acceso desde el menú lateral: **Citas** ([/citas](http://localhost:3000/citas)).

### 6.1 Agendar una Nueva Cita
1. Dirígete a **`+ Agendar cita`** ([/citas/nueva](http://localhost:3000/citas/nueva)).
2. Selecciona la **Oportunidad / Inmueble** (el sistema autocompletará el contacto asociado).
3. Ingresa la fecha, hora y lugar (o enlace de videollamada como Google Meet/Zoom).
4. Agrega notas u objetivos de la reunión.
5. Al hacer clic en **"Agendar cita"**:
   - La cita quedará programada en la agenda.
   - **Automatización:** Si la oportunidad asociada estaba en fases anteriores, **avanzará automáticamente a estatus `Cita`** en el pipeline y registrará la transición en su historial.

### 6.2 Gestión de Resultados de Cita
En la tabla de citas ([/citas](http://localhost:3000/citas)), cada cita programada cuenta con botones rápidos:
- **`✓` (Completada):** Se llevó a cabo la visita o llamada.
- **`✗` (No asistió):** El contacto no se presentó.
- **`Cancelar`:** La cita fue suspendida previo al encuentro.

---

## 7. Administración de Usuarios y Roles

Acceso exclusivo para administradores en: **Administración → Usuarios** ([/admin/usuarios](http://localhost:3000/admin/usuarios)).

- **Crear nuevos colaboradores:** Nombre, correo electrónico, rol (`ADMIN`, `ANALYST`, `ADVISOR`) y contraseña inicial.
- **Reactivar / Desactivar usuarios:** Control de acceso sin borrar el historial de oportunidades que hayan gestionado.

---

## 8. Metas de Negocio y KPIs

Centinela está calibrado para medir el cumplimiento de los 5 objetivos comerciales clave de la empresa:

| KPI Comercial | Meta Institucional | Cómo se Mide en el Sistema |
|---|:---:|---|
| **Propiedades nuevas captadas** | $\ge \mathbf{20\text{ / día}}$ | Inmuebles ingresados por scraper y registro manual en las últimas 24h. |
| **Nuevos contactos** | $\ge \mathbf{50\text{ / semana}}$ | Indicador en verde en el encabezado de [/contactos](http://localhost:3000/contactos). |
| **Tasa de calificación** | $\ge \mathbf{30\%}$ | Porcentaje de propiedades con calificación `Alta` o `Media` respecto al total. |
| **Citas agendadas** | $\ge \mathbf{10\text{ / semana}}$ | Contador en el encabezado de [/citas](http://localhost:3000/citas). |
| **Tiempo a primer contacto** | $<\mathbf{24\text{ horas}}$ | Semáforo de SLA en la ficha de cada oportunidad. |

---

## 9. Guía Rápida de Comandos y Operación Local

Para arrancar el sistema en una máquina de desarrollo:

### 1. Iniciar la Base de Datos (Docker)
```powershell
cd centinela
docker compose up -d
```

### 2. Iniciar el Servidor Web (Next.js)
```powershell
cd centinela
pnpm dev
```
*Abre tu navegador en [http://localhost:3000](http://localhost:3000).*

### 3. Ejecutar el Extractor (Scraper)
```powershell
cd scraper
.\run_scraper.bat
```

### 4. Restablecer Contraseña de un Usuario
```powershell
cd centinela
pnpm set-password correo@ejemplo.com nuevaContraseña123
```
