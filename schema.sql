-- ============================================================
-- LEALTAD PRO NFC — Schema v2
-- Proyecto Supabase: ktppukfiomhduvudiboj
-- Ejecutar en: Supabase → SQL Editor
-- IMPORTANTE: Activar extensión pgcrypto ANTES de ejecutar:
--   Database → Extensions → buscar "pgcrypto" → Enable
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLA: negocios
-- Cada fila es un tenant del sistema.
-- slug: identificador URL-friendly único por negocio (ej: "cafe-martin")
-- activo: kill-switch global — en false bloquea toda la app del negocio
-- color_principal: hex del tema dinámico de la interfaz del cajero
-- owner_id: referencia al usuario de Supabase Auth dueño del negocio
-- ============================================================
create table if not exists public.negocios (
  id              uuid        primary key default uuid_generate_v4(),
  nombre          text        not null,
  slug            text        not null unique,          -- URL: /app/cafe-martin
  color_principal text        not null default '#4f46e5',
  logo_url        text,
  activo          boolean     not null default true,
  owner_id        uuid        references auth.users(id) on delete set null,
  creado_en       timestamptz not null default now()
);

create index if not exists idx_negocios_owner on public.negocios(owner_id);
create index if not exists idx_negocios_slug  on public.negocios(slug);

-- ============================================================
-- TABLA: clientes
-- negocio_id: FK al tenant — un cliente pertenece a un solo negocio
-- nfc_id: UID físico de la tarjeta NFC (único a nivel global)
-- pin_hash: bcrypt del PIN de 4 dígitos — NUNCA se guarda el PIN plano
-- saldo: CHECK >= 0 a nivel BD para doble seguridad (además de la RPC)
-- ============================================================
create table if not exists public.clientes (
  id          uuid        primary key default uuid_generate_v4(),
  negocio_id  uuid        not null references public.negocios(id) on delete cascade,
  nombre      text        not null,
  telefono    text,
  nfc_id      text        unique,                       -- UID raw del chip NFC
  pin_hash    text,                                     -- bcrypt hash del PIN
  saldo       numeric(10,2) not null default 0
                check (saldo >= 0),                     -- imposible saldo negativo
  activo      boolean     not null default true,
  creado_en   timestamptz not null default now()
);

create index if not exists idx_clientes_negocio  on public.clientes(negocio_id);
create index if not exists idx_clientes_nfc_id   on public.clientes(nfc_id);
create index if not exists idx_clientes_telefono on public.clientes(telefono);

-- ============================================================
-- TABLA: transacciones
-- Registro INMUTABLE de cada operación financiera.
-- negocio_id: para filtrar por tenant sin JOIN costoso
-- tipo: 'recarga' (suma) | 'cobro' (resta)
-- saldo_anterior / saldo_posterior: snapshot de auditoría
-- creado_por: uuid del cajero (usuario Auth) que ejecutó la op
-- ============================================================
create table if not exists public.transacciones (
  id               uuid        primary key default uuid_generate_v4(),
  negocio_id       uuid        not null references public.negocios(id) on delete cascade,
  cliente_id       uuid        not null references public.clientes(id) on delete cascade,
  monto            numeric(10,2) not null check (monto > 0),
  tipo             text        not null check (tipo in ('recarga','cobro')),
  descripcion      text,
  saldo_anterior   numeric(10,2) not null,
  saldo_posterior  numeric(10,2) not null,
  creado_por       uuid        references auth.users(id),
  creado_en        timestamptz not null default now()
);

create index if not exists idx_tx_negocio   on public.transacciones(negocio_id);
create index if not exists idx_tx_cliente   on public.transacciones(cliente_id);
create index if not exists idx_tx_fecha     on public.transacciones(creado_en desc);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Cada owner solo puede ver/editar datos de SU negocio.
-- El filtro ocurre en la BD, no en el frontend — es seguro
-- aunque alguien manipule las requests.
-- ============================================================
alter table public.negocios      enable row level security;
alter table public.clientes      enable row level security;
alter table public.transacciones enable row level security;

-- Helper: ¿el usuario autenticado es dueño del negocio indicado?
create or replace function public.es_owner(nid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.negocios
    where id = nid and owner_id = auth.uid()
  );
$$;

-- -------- Políticas: negocios --------
create policy "owner_ver_negocio"
  on public.negocios for select
  using (owner_id = auth.uid());

create policy "owner_editar_negocio"
  on public.negocios for update
  using (owner_id = auth.uid());

create policy "crear_negocio"
  on public.negocios for insert
  with check (owner_id = auth.uid());

-- -------- Políticas: clientes --------
create policy "owner_ver_clientes"
  on public.clientes for select
  using (public.es_owner(negocio_id));

create policy "owner_insertar_clientes"
  on public.clientes for insert
  with check (public.es_owner(negocio_id));

create policy "owner_editar_clientes"
  on public.clientes for update
  using (public.es_owner(negocio_id));

create policy "owner_borrar_clientes"
  on public.clientes for delete
  using (public.es_owner(negocio_id));

-- -------- Políticas: transacciones --------
create policy "owner_ver_transacciones"
  on public.transacciones for select
  using (public.es_owner(negocio_id));

create policy "owner_insertar_transacciones"
  on public.transacciones for insert
  with check (public.es_owner(negocio_id));

-- Sin UPDATE ni DELETE — las transacciones son inmutables

-- ============================================================
-- RPC: buscar_cliente_por_nfc
-- Busca un cliente usando el nfc_id de la tarjeta escaneada.
-- El cajero llama esto primero; devuelve datos del cliente
-- sin exponer pin_hash (se excluye explícitamente).
-- ============================================================
create or replace function public.buscar_cliente_por_nfc(
  p_nfc_id     text,
  p_negocio_id uuid
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_cliente public.clientes%rowtype;
begin
  select * into v_cliente
  from public.clientes
  where nfc_id = p_nfc_id
    and negocio_id = p_negocio_id
    and activo = true;

  if not found then
    return json_build_object('ok', false, 'error', 'Tarjeta no reconocida en este negocio');
  end if;

  -- Devuelve datos del cliente SIN el pin_hash
  return json_build_object(
    'ok',      true,
    'id',      v_cliente.id,
    'nombre',  v_cliente.nombre,
    'telefono',v_cliente.telefono,
    'saldo',   v_cliente.saldo,
    'nfc_id',  v_cliente.nfc_id
  );
end;
$$;

-- ============================================================
-- RPC: realizar_transaccion
-- Ejecuta recarga o cobro de forma ATÓMICA.
-- Seguridad por capas:
--   1. Verifica kill-switch del negocio (campo activo)
--   2. Para cobros: valida PIN con bcrypt antes de operar
--   3. SELECT ... FOR UPDATE previene race conditions de saldo
--   4. CHECK de saldo >= 0 en BD es la última línea de defensa
--   5. Todo ocurre en una sola transacción SQL — o todo pasa o nada
-- Parámetro p_nfc_id: identifica al cliente por su tarjeta física
-- ============================================================
create or replace function public.realizar_transaccion(
  p_nfc_id     text,         -- UID de la tarjeta NFC escaneada
  p_negocio_id uuid,
  p_tipo       text,         -- 'recarga' | 'cobro'
  p_monto      numeric,
  p_pin        text,         -- PIN en texto plano (solo para cobros)
  p_descripcion text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_negocio   public.negocios%rowtype;
  v_cliente   public.clientes%rowtype;
  v_saldo_ant numeric;
  v_saldo_nuevo numeric;
  v_tx_id     uuid;
begin
  -- 1. Validar tipo y monto
  if p_tipo not in ('recarga', 'cobro') then
    return json_build_object('ok', false, 'error', 'Tipo inválido');
  end if;
  if p_monto <= 0 then
    return json_build_object('ok', false, 'error', 'El monto debe ser mayor a cero');
  end if;

  -- 2. Kill-switch: verificar que el negocio esté activo
  select * into v_negocio
  from public.negocios where id = p_negocio_id for share;

  if not found then
    return json_build_object('ok', false, 'error', 'Negocio no encontrado');
  end if;
  if not v_negocio.activo then
    return json_build_object('ok', false, 'error', 'Negocio suspendido. Contacte al administrador');
  end if;

  -- 3. Obtener cliente por nfc_id con lock exclusivo
  --    FOR UPDATE bloquea la fila hasta que la transacción termine,
  --    impidiendo que dos cajeros operen el mismo saldo al mismo tiempo
  select * into v_cliente
  from public.clientes
  where nfc_id = p_nfc_id
    and negocio_id = p_negocio_id
    and activo = true
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'Tarjeta no reconocida o cliente inactivo');
  end if;

  -- 4. Verificar PIN (solo para cobros)
  if p_tipo = 'cobro' then
    if v_cliente.pin_hash is null then
      return json_build_object('ok', false, 'error', 'Cliente sin PIN configurado');
    end if;
    -- crypt() re-hashea el PIN recibido con la misma sal y compara
    if v_cliente.pin_hash <> crypt(p_pin, v_cliente.pin_hash) then
      return json_build_object('ok', false, 'error', 'PIN incorrecto');
    end if;
  end if;

  -- 5. Calcular nuevo saldo
  v_saldo_ant   := v_cliente.saldo;
  v_saldo_nuevo := case p_tipo
                     when 'recarga' then v_saldo_ant + p_monto
                     else                v_saldo_ant - p_monto
                   end;

  if v_saldo_nuevo < 0 then
    return json_build_object(
      'ok', false,
      'error', format('Saldo insuficiente. Disponible: $%s', v_saldo_ant)
    );
  end if;

  -- 6. Actualizar saldo
  update public.clientes
  set saldo = v_saldo_nuevo
  where id = v_cliente.id;

  -- 7. Registrar transacción inmutable
  insert into public.transacciones (
    negocio_id, cliente_id, monto, tipo,
    descripcion, saldo_anterior, saldo_posterior, creado_por
  ) values (
    p_negocio_id, v_cliente.id, p_monto, p_tipo,
    p_descripcion, v_saldo_ant, v_saldo_nuevo, auth.uid()
  )
  returning id into v_tx_id;

  -- 8. Resultado — incluye teléfono para notifyCustomer
  return json_build_object(
    'ok',             true,
    'tx_id',          v_tx_id,
    'nuevo_saldo',    v_saldo_nuevo,
    'saldo_anterior', v_saldo_ant,
    'cliente_id',     v_cliente.id,
    'cliente_nombre', v_cliente.nombre,
    'cliente_tel',    v_cliente.telefono,
    'tipo',           p_tipo,
    'monto',          p_monto
  );

exception
  when others then
    return json_build_object('ok', false, 'error', sqlerrm);
end;
$$;

-- ============================================================
-- RPC: registrar_cliente
-- Registra un cliente nuevo hasheando el PIN en el servidor.
-- El PIN en texto plano nunca toca la tabla directamente.
-- ============================================================
create or replace function public.registrar_cliente(
  p_negocio_id uuid,
  p_nombre     text,
  p_telefono   text,
  p_nfc_id     text,         -- UID de la tarjeta NFC a vincular
  p_pin        text          -- PIN de 4 dígitos en texto plano
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_cliente_id uuid;
begin
  if not public.es_owner(p_negocio_id) then
    return json_build_object('ok', false, 'error', 'No autorizado');
  end if;

  if p_pin !~ '^\d{4}$' then
    return json_build_object('ok', false, 'error', 'El PIN debe ser 4 dígitos numéricos');
  end if;

  if p_nfc_id is not null and exists (
    select 1 from public.clientes where nfc_id = p_nfc_id
  ) then
    return json_build_object('ok', false, 'error', 'Esta tarjeta NFC ya está registrada');
  end if;

  insert into public.clientes (negocio_id, nombre, telefono, nfc_id, pin_hash)
  values (
    p_negocio_id, p_nombre, p_telefono, p_nfc_id,
    crypt(p_pin, gen_salt('bf', 12))   -- bcrypt factor 12
  )
  returning id into v_cliente_id;

  return json_build_object('ok', true, 'cliente_id', v_cliente_id);

exception
  when others then
    return json_build_object('ok', false, 'error', sqlerrm);
end;
$$;

-- ============================================================
-- RPC: estadisticas_negocio
-- Agregados para el dashboard del admin: totales y desglose por día.
-- ============================================================
create or replace function public.estadisticas_negocio(
  p_negocio_id uuid,
  p_desde      timestamptz default now() - interval '30 days',
  p_hasta      timestamptz default now()
)
returns json
language plpgsql security definer set search_path = public
as $$
declare v_result json;
begin
  if not public.es_owner(p_negocio_id) then
    return json_build_object('ok', false, 'error', 'No autorizado');
  end if;

  select json_build_object(
    'ok',                 true,
    'total_cobros',       coalesce(sum(monto) filter (where tipo='cobro'),   0),
    'total_recargas',     coalesce(sum(monto) filter (where tipo='recarga'), 0),
    'num_transacciones',  count(*),
    'num_clientes_activos', (
      select count(*) from public.clientes
      where negocio_id = p_negocio_id and activo = true
    ),
    'por_dia', (
      select json_agg(row_to_json(d)) from (
        select
          date_trunc('day', creado_en)                       as dia,
          coalesce(sum(monto) filter (where tipo='cobro'),   0) as cobros,
          coalesce(sum(monto) filter (where tipo='recarga'), 0) as recargas,
          count(*)                                           as total_ops
        from public.transacciones
        where negocio_id = p_negocio_id
          and creado_en between p_desde and p_hasta
        group by 1 order by 1
      ) d
    )
  ) into v_result
  from public.transacciones
  where negocio_id = p_negocio_id
    and creado_en between p_desde and p_hasta;

  return v_result;
end;
$$;
